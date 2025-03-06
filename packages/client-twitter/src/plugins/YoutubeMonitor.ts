import { 
    type IAgentRuntime,
    stringToUuid,
    getEmbeddingZeroVector,
    type Memory,
    type Content,
    type UUID
} from "@elizaos/core";
import type { ClientBase } from "../base";
import { sendTweet } from "../utils";
import axios from 'axios';
import { Creator } from '../models/Creator';
import { connectDB } from '../db/connection';
import { ethers, providers, utils } from 'ethers';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TokenMetadata } from '../models/TokenMetadata';
import mongoose from 'mongoose';

// Add CreatorTokenABI definition
const CreatorTokenABI = {
    abi: [
        // Basic ERC20 functions
        "function mintToken(address owner, string memory creatorName, string memory imageUrl, string memory channelUrl, uint256 initialSupply) external returns (address)",
        "function isTokenMinted(string memory channelUrl) external view returns (bool)",
        "function getCreatorToken(string memory channelUrl) external view returns (address)",
        // Add other functions as needed
    ]
};

const THRESHOLDS = {
    VIEWS_CHANGE: parseFloat(process.env.THRESHOLD_VIEWS || '0.0005'),
    LIKES_CHANGE: parseFloat(process.env.THRESHOLD_LIKES || '0.001'),
    SUBS_CHANGE: parseFloat(process.env.THRESHOLD_SUBS || '0.0005'),
};
interface CreatorMetrics {
    channelId: string;
    name: string;
    metrics: {
        views: number;
        likes: number;
        subscribers: number;
        lastVideoId: string;
        lastVideoTimestamp: number;
        lastUpdated24h?: number; // Track 24-hour metrics
    };
}

interface YouTubeVideo {
    id: string;
    snippet: {
        channelId: string;
        channelTitle: string;
        title: string;
        publishedAt: string;
    };
    statistics: {
        viewCount: string;
        likeCount: string;
    };
}

interface YouTubeChannel {
    id: string;
    snippet: {
        title: string;
        description: string;
        thumbnails?: {
            default?: {
                url: string;
            };
            medium?: {
                url: string;
            };
            high?: {
                url: string;
            };
        };
    };
    statistics: {
        viewCount: string;
        subscriberCount: string;
        videoCount: string;
        likeCount?: string;
    };
    brandingSettings?: {
        image?: {
            bannerExternalUrl?: string;
        };
    };
}

export class YoutubeMonitor {
    private runtime: IAgentRuntime;
    private client: ClientBase;
    private apiKey: string;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';
    private trendingCheckInterval: NodeJS.Timeout | null = null;
    private metricsCheckInterval: NodeJS.Timeout | null = null;
    private lastTrendingUpdate: number = 0;
    private postedVideoIds: Set<string> = new Set();
    private provider: providers.JsonRpcProvider;
    private contract: ethers.Contract;
    private signer: ethers.Wallet;
    private creatorLifespan: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        // Load environment variables at the start
        dotenv.config(); // This will load from root .env

        // Log environment status
        console.log('Environment variables status:', {
            cwd: process.cwd(),
            hasRpcUrl: !!process.env.SONIC_RPC_URL,
            hasPrivateKey: !!process.env.SONIC_PRIVATE_KEY,
            hasContractAddress: !!process.env.CONTRACT_ADDRESS,
            hasYoutubeKey: !!process.env.YOUTUBE_API_KEY // For comparison
        });

        this.runtime = runtime;
        this.client = client;
        this.apiKey = process.env.YOUTUBE_API_KEY || '';
        
        if (!this.apiKey) {
            throw new Error('YouTube API key is required');
        }
        
        // Check blockchain config before initialization
        if (!process.env.SONIC_RPC_URL || !process.env.SONIC_PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
            console.error('Missing blockchain environment variables:', {
                SONIC_RPC_URL: !!process.env.SONIC_RPC_URL,
                SONIC_PRIVATE_KEY: !!process.env.SONIC_PRIVATE_KEY,
                CONTRACT_ADDRESS: !!process.env.CONTRACT_ADDRESS
            });
        }

        this.initializeBlockchain().catch(error => {
            console.error('Failed to initialize blockchain connection. Detailed error:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            // Initialize empty instances to prevent undefined errors
            this.provider = new providers.JsonRpcProvider();
            this.signer = new ethers.Wallet('0x0000000000000000000000000000000000000000000000000000000000000001');
            this.contract = new ethers.Contract('0x0000000000000000000000000000000000000000', [], this.provider);
        });
    }

    private async initializeBlockchain() {
        const rpcUrl = process.env.SONIC_RPC_URL;
        const privateKey = process.env.SONIC_PRIVATE_KEY;
        const contractAddress = process.env.CONTRACT_ADDRESS;

        // Log environment variables (be careful not to log the full private key)
        console.log('Blockchain config:', {
            rpcUrl,
            contractAddress,
            hasPrivateKey: !!privateKey,
            privateKeyLength: privateKey?.length
        });

        if (!rpcUrl || !privateKey || !contractAddress) {
            throw new Error(`Missing blockchain configuration: 
                RPC URL: ${!!rpcUrl}, 
                Private Key: ${!!privateKey}, 
                Contract: ${!!contractAddress}`);
        }

        try {
            this.provider = new providers.JsonRpcProvider(rpcUrl);
            console.log('Provider initialized successfully');
        } catch (providerError) {
            throw new Error(`Provider initialization failed: ${providerError.message}`);
        }

        try {
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            this.signer = new ethers.Wallet(formattedKey, this.provider);
            console.log('Signer initialized successfully');
        } catch (signerError) {
            throw new Error(`Signer initialization failed: ${signerError.message}`);
        }

        try {
            this.contract = new ethers.Contract(
                contractAddress,
                CreatorTokenABI.abi,
                this.signer
            );
            console.log('Contract initialized successfully');

            // Test contract connection with isTokenMinted instead of owner
            await this.contract.isTokenMinted("test").then(() => {
                console.log('Contract connection verified successfully');
            }).catch((err) => {
                throw new Error(`Contract connection test failed: ${err.message}`);
            });

        } catch (contractError) {
            throw new Error(`Contract initialization failed: ${contractError.message}`);
        }
    }

    async start() {
        console.log("Starting YouTube monitor...");
        
        try {
            // Connect to MongoDB
            await connectDB();
            
            // Initial run
            await this.getTrendingCreators();
            await this.debugStoredCreators();
            
            // Schedule monitoring tasks
            this.scheduleTasks();

        } catch (error) {
            console.error("Error starting YouTube monitor:", error);
            throw error;
        }
    }

    private scheduleTasks() {
        // Schedule metrics check every 30 minutes
        const scheduleMetricsCheck = () => {
            console.log("Scheduling next metrics check in 30 minutes...");
            setTimeout(async () => {
                console.log("Running scheduled metrics check...");
                try {
                    await this.monitorCreatorMetrics();
                    
                    // Check for expired creators (older than 24 hours) and remove from tracking
                    await this.cleanupExpiredCreators();
                } catch (error) {
                    console.error("Error in metrics check:", error);
                }
                scheduleMetricsCheck(); // Schedule next check
            }, 30 * 60 * 1000);
        };

        // Schedule trending check every 24 hours
        const scheduleTrendingCheck = () => {
            console.log("Scheduling next trending check in 24 hours...");
            setTimeout(async () => {
                console.log("Running scheduled trending check...");
                try {
                    await this.getTrendingCreators();
                } catch (error) {
                    console.error("Error in trending check:", error);
                }
                scheduleTrendingCheck(); // Schedule next check
            }, 24 * 60 * 60 * 1000);
        };

        // Schedule daily leaderboard with initial delay
        const scheduleLeaderboard = () => {
            const INITIAL_DELAY = 24 * 60 * 60 * 1000; // 24 hours initial delay
            
            console.log("Scheduling first leaderboard post in 24 hours to collect growth data...");
            setTimeout(() => {
                // First post after 24 hours
                this.postDailyLeaderboard().catch(error => {
                    console.error("Error in leaderboard post:", error);
                });

                // Then schedule regular 24-hour posts
                setInterval(() => {
                    console.log("Posting daily leaderboard...");
                    this.postDailyLeaderboard().catch(error => {
                        console.error("Error in leaderboard post:", error);
                    });
                }, 24 * 60 * 60 * 1000);
            }, INITIAL_DELAY);
        };

        // Start all schedules
        scheduleMetricsCheck();
        scheduleTrendingCheck();
        scheduleLeaderboard();
    }

    private async getTrendingCreators(): Promise<void> {
        try {
            console.log("Fetching trending YouTube creators from US region...");
            
            // First get the most popular videos in last 24 hours
            const trendingResponse = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,statistics',
                    chart: 'mostPopular',
                    regionCode: 'US', // Specifically targeting US region
                    maxResults: 50,  // Get more videos to find truly trending creators
                    videoCategoryId: '0', // All categories
                    key: this.apiKey
                }
            });

            // Extract channel IDs from trending videos
            const channelIds = [...new Set(trendingResponse.data.items
                .map((item: any) => item.snippet.channelId))];

            console.log(`Found ${channelIds.length} channels with trending videos in US region`);

            // Get detailed channel information
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet,statistics,contentDetails,brandingSettings',
                    id: channelIds.join(','),
                    key: this.apiKey
                }
            });

            // Calculate engagement score for each channel with more sophisticated algorithm
            const channelsWithScore = channelResponse.data.items.map((channel: YouTubeChannel) => {
                const views = Number(channel.statistics.viewCount);
                const subs = Number(channel.statistics.subscriberCount);
                const videos = Number(channel.statistics.videoCount);
                
                // Enhanced engagement score that considers recent activity, overall popularity, and video efficiency
                const viewsPerVideo = views / (videos || 1);
                const subsToViewsRatio = subs / (views || 1);
                const engagementScore = viewsPerVideo * Math.log10(subs + 1) * (1 + subsToViewsRatio);
                
                // Get channel image for better display
                const imageUrl = channel.snippet.thumbnails?.default?.url || 
                               channel.brandingSettings?.image?.bannerExternalUrl || 
                               "";
                
                return { 
                    ...channel, 
                    engagementScore,
                    imageUrl
                };
            });

            // Get top 5 most engaging channels
            const topCreators = channelsWithScore
                .sort((a, b) => b.engagementScore - a.engagementScore)
                .slice(0, 5);

            console.log(`Selected top ${topCreators.length} trending creators from US region`);

            // Format numbers for better display
            const formatNumber = (num: number): string => {
                if (num >= 1000000) {
                    return `${(num / 1000000).toFixed(1)}M`;
                }
                if (num >= 1000) {
                    return `${(num / 1000).toFixed(1)}K`;
                }
                return num.toString();
            };

            // Truncate channel names if they're too long
            const truncateName = (name: string, maxLength: number = 20): string => {
                return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
            };

            // Create a more compact format for each creator
            const creatorEntries = topCreators.map((creator, i) => {
                const name = truncateName(creator.snippet.title);
                const subs = formatNumber(Number(creator.statistics.subscriberCount));
                const views = formatNumber(Number(creator.statistics.viewCount));
                const videos = formatNumber(Number(creator.statistics.videoCount));
                
                // Use a more compact format to save characters
                return `${i + 1}. ${name}\n• ${subs} subs • ${views} views • ${videos} vids`;
            });
            
            // Create a more compact tweet format
            const date = new Date().toLocaleDateString();
            const headerText = `🔥 Top 5 Trending US Creators (${date})!\n\n`;
            const footerText = `\n📈 These creators are on fire! 🔥`;
            
            // Check if the tweet is within Twitter's character limit (280 chars)
            const TWITTER_CHAR_LIMIT = 280;
            let tweetText = headerText + creatorEntries.join('\n\n') + footerText;
            
            // If the tweet is too long, use a more compact format
            if (tweetText.length > TWITTER_CHAR_LIMIT) {
                console.log(`Tweet too long (${tweetText.length} chars), using more compact format`);
                
                // Use an even more compact format for each creator
                const compactCreatorEntries = topCreators.map((creator, i) => {
                    const name = truncateName(creator.snippet.title, 15);
                    const subs = formatNumber(Number(creator.statistics.subscriberCount));
                    const views = formatNumber(Number(creator.statistics.viewCount));
                    
                    // Extremely compact format
                    return `${i + 1}. ${name}: ${subs} subs, ${views} views`;
                });
                
                tweetText = headerText + compactCreatorEntries.join('\n') + footerText;
                
                // If still too long, reduce the number of creators shown
                if (tweetText.length > TWITTER_CHAR_LIMIT) {
                    console.log(`Tweet still too long (${tweetText.length} chars), showing fewer creators`);
                    
                    // Show only top 3 creators
                    const reducedCreatorEntries = compactCreatorEntries.slice(0, 3);
                    tweetText = headerText + reducedCreatorEntries.join('\n') + '\n+ more...' + footerText;
                }
            }
            
            // Create the tweet content
            const creatorContent: Content = {
                text: tweetText,
                source: 'youtube'
            };
            
            // Send the tweet
            await sendTweet(this.client, creatorContent, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

            console.log("Trending creators tweet posted successfully");
            
            // Store creators for monitoring with 24-hour lifespan
            for (const creator of topCreators) {
                await this.storeCreatorMetrics(creator, true);
            }

            this.lastTrendingUpdate = Date.now();
            
            // Post trending videos separately
            await this.postTrendingVideos();
            
        } catch (error) {
            console.error("Error posting trending creators:", error);
            throw error;
        }
    }

    // Separate method for trending videos
    private async postTrendingVideos(): Promise<void> {
        try {
            console.log("Fetching trending videos...");
            const response = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,statistics',
                    chart: 'mostPopular',
                    regionCode: 'US',
                    maxResults: 50,
                    key: this.apiKey
                }
            });

            // Post top 5 trending videos
            const trendingVideos = response.data.items.slice(0, 5);
            const videoContent: Content = {
                text: `🔥 Top 5 Trending Videos!\n\n` +
                      trendingVideos.map((video: any, i: number) => 
                          `${i + 1}. "${video.snippet.title}"\n` +
                          `   • ${Number(video.statistics.viewCount).toLocaleString()} views\n` +
                          `   • By: ${video.snippet.channelTitle}\n`
                      ).join('\n') +
                      `\n📈 Stay tuned for creator updates!`,
                source: 'youtube'
            };

            await sendTweet(this.client, videoContent, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

        } catch (error) {
            console.error("Error posting trending videos:", error);
        }
    }

    private async monitorCreatorMetrics(): Promise<void> {
        console.log("Starting metrics monitoring cycle...");
        try {
            const creators = await (Creator as any).find({ isTracking: true });
            console.log(`Found ${creators.length} creators to monitor`);

            for (const creator of creators) {
                console.log(`Checking metrics for: ${creator.name}`);
                
                try {
                    const response = await axios.get(`${this.baseUrl}/channels`, {
                        params: {
                            part: 'snippet,statistics',
                            id: creator.channelId,
                            key: this.apiKey
                        }
                    });

                    if (response.data.items?.[0]) {
                        const channel = response.data.items[0];
                        const totalLikes = await this.getTotalChannelLikes(channel.id);
                        
                        const currentMetrics = {
                            views: Number(channel.statistics.viewCount),
                            likes: totalLikes,
                            subscribers: Number(channel.statistics.subscriberCount)
                        };

                        const stored = creator.metrics;
                        const viewsChange = Math.abs((currentMetrics.views - stored.views) / stored.views);
                        const subsChange = Math.abs((currentMetrics.subscribers - stored.subscribers) / stored.subscribers);
                        const likesChange = Math.abs((currentMetrics.likes - stored.likes) / (stored.likes || 1));

                        // Add direction indicators
                        const viewsDirection = currentMetrics.views > stored.views ? '📈' : '📉';
                        const subsDirection = currentMetrics.subscribers > stored.subscribers ? '⬆️' : '⬇️';
                        const likesDirection = currentMetrics.likes > stored.likes ? '💫' : '〽️';

                        if (viewsChange > THRESHOLDS.VIEWS_CHANGE || 
                            subsChange > THRESHOLDS.SUBS_CHANGE || 
                            likesChange > THRESHOLDS.LIKES_CHANGE) {
                            
                            console.log(`Significant changes detected for ${creator.name} - posting update`);
                            
                            const timestamp = new Date().toLocaleTimeString();
                            const content: Content = {
                                text: `📊 Creator Metrics Update (${timestamp})\n\n` +
                                      `${channel.snippet.title}\n` +
                                      `• Subscribers: ${Number(currentMetrics.subscribers).toLocaleString()} ${subsDirection} (${(subsChange * 100).toFixed(2)}% change)\n` +
                                      `• Views: ${Number(currentMetrics.views).toLocaleString()} ${viewsDirection} (${(viewsChange * 100).toFixed(2)}% change)\n` +
                                      `• Likes: ${Number(currentMetrics.likes).toLocaleString()} ${likesDirection} (${(likesChange * 100).toFixed(2)}% change)\n\n` +
                                      `#YouTubeCreator #Analytics`,
                                source: 'youtube'
                            };

                            await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
                                this.client.twitterConfig.TWITTER_USERNAME, '');

                            // Update stored metrics
                            creator.metrics = {
                                ...creator.metrics,
                                views: currentMetrics.views,
                                likes: currentMetrics.likes,
                                subscribers: currentMetrics.subscribers
                            };
                            creator.lastUpdated = new Date();
                            await creator.save();
                        }

                        // Check for new videos
                        await this.checkNewVideos(creator, channel);
                    }
                } catch (error) {
                    console.error(`Error checking metrics for ${creator.name}:`, error);
                }
            }
        } catch (error) {
            console.error("Error monitoring creator metrics:", error);
        }
    }
    
    async debugStoredCreators(): Promise<void> {
        try {
            const creators = await this.getStoredCreators(); // Retrieve all stored creators
            console.log("🔍 Stored Creator Data:", JSON.stringify(creators, null, 2));
        } catch (error) {
            console.error("⚠️ Error retrieving stored creators:", error);
        }
    }
    


    private async storeCreatorMetrics(channel: YouTubeChannel, postInitialMetrics: boolean = false): Promise<void> {
        try {
            // Get total likes for the channel
            const totalLikes = await this.getTotalChannelLikes(channel.id);

            const metrics = {
                views: Number(channel.statistics.viewCount),
                likes: totalLikes,
                subscribers: Number(channel.statistics.subscriberCount),
                lastVideoId: '',
                lastVideoTimestamp: 0,
                lastUpdated24h: Date.now() // Track when this creator was added/updated for 24h lifespan
            };

            // Find or create creator
            let creator = await (Creator as any).findOne({ channelId: channel.id });
            
            if (creator) {
                // Check for significant changes
                const stored = creator.metrics;
                const viewsChange = Math.abs((metrics.views - stored.views) / stored.views);
                const subsChange = Math.abs((metrics.subscribers - stored.subscribers) / stored.subscribers);
                const likesChange = Math.abs((metrics.likes - stored.likes) / (stored.likes || 1));

                if (viewsChange > THRESHOLDS.VIEWS_CHANGE || 
                    subsChange > THRESHOLDS.SUBS_CHANGE || 
                    likesChange > THRESHOLDS.LIKES_CHANGE) {
                    
                    // Update metrics with preserved video data
                    const updatedMetrics = {
                        views: metrics.views,
                        likes: metrics.likes,
                        subscribers: metrics.subscribers,
                        lastVideoId: creator.metrics.lastVideoId,
                        lastVideoTimestamp: creator.metrics.lastVideoTimestamp,
                        lastUpdated24h: metrics.lastUpdated24h
                    };
                    
                    creator.metrics = updatedMetrics;
                    creator.lastUpdated = new Date();
                    await creator.save();

                    // Post update tweet
                    await this.postMetricsUpdateTweet(channel, stored, metrics);
                }
            } else {
                // Create new creator with 24-hour tracking
                creator = await (Creator as any).create({
                    channelId: channel.id,
                    name: channel.snippet.title,
                    description: channel.snippet.description || '',
                    imageUrl: channel.snippet.thumbnails?.default?.url || '',
                    channelUrl: `https://youtube.com/channel/${channel.id}`,
                    videoCount: Number(channel.statistics.videoCount),
                    metrics,
                    isTracking: true,
                    lastUpdated: new Date()
                });

                // Mint token for new creator
                await this.mintCreatorToken(channel);

                if (postInitialMetrics) {
                    await this.postInitialMetricsTweet(channel, metrics);
                }
            }
        } catch (error) {
            console.error(`Error storing creator metrics for ${channel.snippet.title}:`, error);
        }
    }

    private async getStoredCreators(): Promise<CreatorMetrics[]> {
        try {
            const creators = await (Creator as any).find({ isTracking: true });
            console.log(`Retrieved ${creators.length} creators from MongoDB`);
            
            return creators.map(creator => ({
                channelId: creator.channelId,
                name: creator.name,
                metrics: creator.metrics
            }));
        } catch (error) {
            console.error("Error retrieving creators:", error);
            return [];
        }
    }

    private async checkNewVideos(
        creator: any,
        channel: YouTubeChannel
    ): Promise<void> {
        try {
            console.log(`Checking for new videos from ${creator.name}...`);
            
            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    part: 'snippet',
                    channelId: channel.id,
                    order: 'date',
                    maxResults: 1,
                    type: 'video',
                    key: this.apiKey
                }
            });

            const latestVideo = response.data.items?.[0];
            if (!latestVideo) {
                console.log(`No videos found for ${creator.name}`);
                return;
            }

            const videoId = latestVideo.id.videoId;
            if (!videoId) {
                console.log(`No video ID found for latest video from ${creator.name}`);
                return;
            }

            const videoTimestamp = new Date(latestVideo.snippet.publishedAt).getTime();
            console.log(`Latest video from ${creator.name}:`, {
                currentVideoId: videoId,
                storedVideoId: creator.metrics.lastVideoId,
                videoTimestamp,
                storedTimestamp: creator.metrics.lastVideoTimestamp,
                title: latestVideo.snippet.title
            });

            // Check if this is a new video we haven't posted about
            if (videoId !== creator.metrics.lastVideoId && 
                videoTimestamp > creator.metrics.lastVideoTimestamp && 
                !this.postedVideoIds.has(videoId)) {
                
                console.log(`New video detected from ${creator.name}: ${latestVideo.snippet.title}`);
                await this.postNewVideoUpdate(channel, latestVideo);
                
                // Update stored metrics
                creator.metrics.lastVideoId = videoId;
                creator.metrics.lastVideoTimestamp = videoTimestamp;
                await creator.save();
                
                this.postedVideoIds.add(videoId);
            }
        } catch (error) {
            console.error(`Error checking new videos for ${creator.name}:`, error);
        }
    }

    private async postNewVideoUpdate(
        channel: YouTubeChannel,
        video: any
    ): Promise<void> {
        const content: Content = {
            text: `🎥 New Drop Alert! ${channel.snippet.title} just released a new video: "${video.snippet.title}"! Watch it here: https://youtu.be/${video.id.videoId} 🔥`,
            source: 'youtube'
        };

        await sendTweet(
            this.client,
            content,
            stringToUuid('youtube-monitor'),
            this.client.twitterConfig.TWITTER_USERNAME,
            ''
        );
    }

    private async postMetricsUpdateTweet(
        channel: YouTubeChannel,
        stored: { views: number; likes: number; subscribers: number },
        current: { views: number; likes: number; subscribers: number }
    ): Promise<void> {
        const timestamp = new Date().toLocaleTimeString();
        const viewsDirection = current.views > stored.views ? '📈' : '📉';
        const subsDirection = current.subscribers > stored.subscribers ? '⬆️' : '⬇️';
        const likesDirection = current.likes > stored.likes ? '💫' : '〽️';
        
        const content: Content = {
            text: `📊 Creator Metrics Update (${timestamp})\n\n` +
                  `${channel.snippet.title}\n` +
                  `• Subscribers: ${Number(current.subscribers).toLocaleString()} ${subsDirection} (${(Math.abs((current.subscribers - stored.subscribers) / stored.subscribers) * 100).toFixed(2)}% change)\n` +
                  `• Views: ${Number(current.views).toLocaleString()} ${viewsDirection} (${(Math.abs((current.views - stored.views) / stored.views) * 100).toFixed(2)}% change)\n` +
                  `• Likes: ${Number(current.likes).toLocaleString()} ${likesDirection} (${(Math.abs((current.likes - stored.likes) / (stored.likes || 1)) * 100).toFixed(2)}% change)\n\n` +
                  `#YouTubeCreator #Analytics`,
            source: 'youtube'
        };

        await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
            this.client.twitterConfig.TWITTER_USERNAME, '');
    }

    private async postInitialMetricsTweet(
        channel: YouTubeChannel,
        metrics: { views: number; likes: number; subscribers: number }
    ): Promise<void> {
        const content: Content = {
            text: `📊 Initial Metrics for ${channel.snippet.title}:\n` +
                  `• Subscribers: ${Number(metrics.subscribers).toLocaleString()}\n` +
                  `• Total Views: ${Number(metrics.views).toLocaleString()}\n` +
                  `• Total Likes: ${Number(metrics.likes).toLocaleString()}\n` +
                  `Will monitor for changes every 30 minutes! 🔍`,
            source: 'youtube'
        };

        await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
            this.client.twitterConfig.TWITTER_USERNAME, '');
    }

    private async mintCreatorToken(creator: YouTubeChannel): Promise<void> {
        try {
            const channelLink = `https://youtube.com/channel/${creator.id}`;
            
            // Check if token is already minted
            const isMinted = await this.contract.isTokenMinted(channelLink);
            if (isMinted) {
                const existingTokenAddress = await this.contract.getCreatorToken(channelLink);
                console.log(`Token already exists for ${creator.snippet.title}:
                    Channel: ${channelLink}
                    Token Address: ${existingTokenAddress}
                    Subscribers: ${Number(creator.statistics.subscriberCount).toLocaleString()}
                `);
                
                // Update metadata even if token exists
                await (TokenMetadata.findOneAndUpdate as Function)(
                    { tokenAddress: existingTokenAddress },
                    {
                        subscribers: Number(creator.statistics.subscriberCount),
                        views: Number(creator.statistics.viewCount),
                        videoCount: Number(creator.statistics.videoCount),
                        lastUpdated: new Date()
                    },
                    { new: true }
                );
                
                return;
            }

            // Get detailed channel information including branding
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet,statistics,brandingSettings',
                    id: creator.id,
                    key: this.apiKey
                }
            });
            
            const channelData = channelResponse.data.items[0];
            const imageUrl = channelData.snippet.thumbnails?.default?.url || 
                           channelData.brandingSettings?.image?.bannerExternalUrl ||
                           creator.snippet.thumbnails?.default?.url || 
                           "";

            console.log(`Starting token mint for ${creator.snippet.title}:
                Channel: ${channelLink}
                Subscribers: ${Number(creator.statistics.subscriberCount).toLocaleString()}
                Initial Supply: ${creator.statistics.subscriberCount} tokens
                Image URL: ${imageUrl}
            `);

            // Mint token
            const tx = await this.contract.mintToken(
                this.signer.address,
                creator.snippet.title,
                imageUrl,
                channelLink,
                creator.statistics.subscriberCount
            );
            
            const receipt = await tx.wait();
            
            // Calculate gas used
            const gasPrice = tx.gasPrice || await this.provider.getGasPrice();
            const gasCost = receipt.gasUsed.mul(gasPrice);
            console.log(`Gas Used for Mint: ${receipt.gasUsed.toString()} (${utils.formatEther(gasCost)} ETH)`);

            if (receipt.status !== 1) {
                throw new Error(`Minting failed for ${creator.snippet.title}`);
            }

            // Get token address
            const tokenAddress = await this.contract.getCreatorToken(channelLink);
            
            // Store token metadata with price discovery fields
            await (TokenMetadata.create as Function)({
                creatorName: creator.snippet.title,
                channelId: creator.id,
                tokenAddress: tokenAddress,
                subscribers: Number(creator.statistics.subscriberCount),
                views: Number(creator.statistics.viewCount),
                imageUrl: imageUrl,
                mintTimestamp: new Date(),
                channelUrl: channelLink,
                videoCount: Number(creator.statistics.videoCount),
                lastUpdated: new Date(),
                // Price discovery and trading fields
                isListedForTrading: false,
                priceDiscoveryCompleted: false,
                hasLiquidity: false,
                currentPrice: 0,
                priceHistory: [],
                tradingVolume24h: 0
            });

            // Update creator record with token information
            await (Creator as any).findOneAndUpdate(
                { channelId: creator.id },
                { 
                    hasToken: true,
                    tokenAddress: tokenAddress
                }
            );

            // Log mint event
            const mintEvent = receipt.logs.find(log => 
                log.topics.includes(utils.keccak256(utils.toUtf8Bytes("CreatorTokenMinted(address,string,string)")))
            );
            if (mintEvent) {
                console.log(`Token minted event: ${mintEvent.topics}`);
            }

            console.log(`Token minted and metadata stored:
                Creator: ${creator.snippet.title}
                Token Address: ${tokenAddress}
                Image: ${imageUrl}
            `);

            // Post mint success tweet
            const content: Content = {
                text: `🎉 New Creator Token Minted!\n\n` +
                      `Creator: ${creator.snippet.title}\n` +
                      `Subscribers: ${Number(creator.statistics.subscriberCount).toLocaleString()}\n` +
                      `Views: ${Number(creator.statistics.viewCount).toLocaleString()}\n` +
                      `Channel: ${channelLink}\n\n` +
                      `🪙 Token Address: ${tokenAddress}\n` +
                      `#CreatorTokens #Web3`,
                source: 'youtube'
            };

            await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

            // Initiate price discovery and liquidity process
            await this.initiatePriceDiscoveryAndLiquidity(tokenAddress, creator);

        } catch (error) {
            console.error(`Error in mintCreatorToken for ${creator.snippet.title}:`, error);
        }
    }

    // New method to handle price discovery and liquidity
    private async initiatePriceDiscoveryAndLiquidity(tokenAddress: string, creator: YouTubeChannel): Promise<void> {
        try {
            console.log(`Initiating price discovery and liquidity for ${creator.snippet.title}`);
            
            // Calculate initial price based on creator metrics
            const subscribers = Number(creator.statistics.subscriberCount);
            const views = Number(creator.statistics.viewCount);
            const videos = Number(creator.statistics.videoCount);
            
            // Enhanced price discovery formula based on creator metrics
            const initialPrice = (Math.log10(subscribers + 1) * 0.1) + 
                               (Math.log10(views + 1) * 0.05) + 
                               (Math.log10(videos + 1) * 0.02);
            
            const roundedPrice = Math.max(0.1, Math.round(initialPrice * 100) / 100);
            
            console.log(`Calculated initial price for ${creator.snippet.title}: $${roundedPrice}`);
            
            // Update token metadata with initial price
            await (TokenMetadata.findOneAndUpdate as Function)(
                { tokenAddress },
                { 
                    currentPrice: roundedPrice,
                    priceHistory: [{ price: roundedPrice, timestamp: new Date() }],
                    priceDiscoveryCompleted: true
                },
                { new: true }
            );
            
            // Add real liquidity to DEX using contract interactions
            try {
                console.log(`Adding real liquidity for ${creator.snippet.title} token at address ${tokenAddress}`);
                
                // Contract addresses - these should be in environment variables or config
                const CORAL_TOKEN_ADDRESS = process.env.CORAL_TOKEN_ADDRESS;
                const LIQUIDITY_MANAGER_ADDRESS = process.env.SARA_LIQUIDITY_MANAGER_ADDRESS;
                const SARA_DEX_ADDRESS = process.env.SARA_DEX_ADDRESS;
                const SARA_ROUTER_ADDRESS = process.env.SARA_TOKEN_ROUTER_ADDRESS;
                
                if (!CORAL_TOKEN_ADDRESS || !LIQUIDITY_MANAGER_ADDRESS || !SARA_DEX_ADDRESS || !SARA_ROUTER_ADDRESS) {
                    throw new Error("Missing contract addresses in environment variables");
                }
                
                console.log("Attaching to contracts...");
                
                // Attach to contracts
                const coralToken = new ethers.Contract(
                    CORAL_TOKEN_ADDRESS,
                    [
                        "function balanceOf(address owner) view returns (uint256)",
                        "function approve(address spender, uint256 amount) returns (bool)",
                        "function transfer(address to, uint256 amount) returns (bool)"
                    ],
                    this.signer
                );
                
                const creatorERC20 = new ethers.Contract(
                    tokenAddress,
                    [
                        "function balanceOf(address owner) view returns (uint256)",
                        "function approve(address spender, uint256 amount) returns (bool)",
                        "function transfer(address to, uint256 amount) returns (bool)",
                        "function getCreatorMetadata() view returns (string _name, string _symbol, string _creatorName, uint256 _subscribers)"
                    ],
                    this.signer
                );
                
                const liquidityManager = new ethers.Contract(
                    LIQUIDITY_MANAGER_ADDRESS,
                    [
                        "function addLiquidity(address tokenAddress, uint256 tokenAmount, uint256 coralAmount) returns (uint256 liquidity)",
                        "function getReserves(address tokenAddress) view returns (uint256 tokenReserve, uint256 coralReserve)",
                        "function isTrackedPool(address tokenAddress) view returns (bool)",
                        "function addPoolToTracking(address tokenAddress) returns (bool)"
                    ],
                    this.signer
                );
                
                const saraDex = new ethers.Contract(
                    SARA_DEX_ADDRESS,
                    [
                        "function LIQUIDITY_MANAGER_ROLE() view returns (bytes32)",
                        "function hasRole(bytes32 role, address account) view returns (bool)",
                        "function grantRole(bytes32 role, address account) returns (bool)"
                    ],
                    this.signer
                );
                
                const tokenRouter = new ethers.Contract(
                    SARA_ROUTER_ADDRESS,
                    [
                        "function listedTokens(address tokenAddress) view returns (bool)",
                        "function listNewCreatorToken(address tokenAddress) returns (bool)"
                    ],
                    this.signer
                );
                
                console.log("Checking balances...");
                
                // Check balances
                const signerAddress = await this.signer.getAddress();
                const coralBalance = await coralToken.balanceOf(signerAddress);
                const creatorTokenBalance = await creatorERC20.balanceOf(signerAddress);
                
                console.log(`Signer CORAL balance: ${utils.formatEther(coralBalance)}`);
                console.log(`Signer creator token balance: ${utils.formatEther(creatorTokenBalance)}`);
                
                // Ensure we have enough tokens for liquidity
                const minLiquidityAmount = utils.parseEther("20"); // 20 tokens minimum for liquidity
                
                if (coralBalance.lt(minLiquidityAmount)) {
                    console.log("Insufficient CORAL balance for liquidity addition");
                    throw new Error(`Insufficient CORAL balance for liquidity. Have: ${utils.formatEther(coralBalance)}, Need: ${utils.formatEther(minLiquidityAmount)}`);
                }
                
                if (creatorTokenBalance.lt(minLiquidityAmount)) {
                    console.log("Insufficient creator token balance for liquidity addition");
                    throw new Error(`Insufficient creator token balance for liquidity. Have: ${utils.formatEther(creatorTokenBalance)}, Need: ${utils.formatEther(minLiquidityAmount)}`);
                }
                
                // Step 1: Check if pool is already tracked
                console.log("Checking if pool is already tracked...");
                const isTracked = await liquidityManager.isTrackedPool(tokenAddress);
                console.log(`Is pool already tracked: ${isTracked}`);
                
                // Step 2: Add pool to tracking if not already tracked
                if (!isTracked) {
                    console.log("Adding pool to tracking...");
                    const addPoolTx = await liquidityManager.addPoolToTracking(tokenAddress);
                    await addPoolTx.wait();
                    console.log(`Pool added to tracking, transaction hash: ${addPoolTx.hash}`);
                }
                
                // Step 3: Approve tokens for liquidity manager
                console.log("Approving CORAL tokens for liquidity manager...");
                const approveCoralTx = await coralToken.approve(LIQUIDITY_MANAGER_ADDRESS, minLiquidityAmount);
                await approveCoralTx.wait();
                console.log(`CORAL approval transaction hash: ${approveCoralTx.hash}`);
                
                console.log("Approving creator tokens for liquidity manager...");
                const approveCreatorTx = await creatorERC20.approve(LIQUIDITY_MANAGER_ADDRESS, minLiquidityAmount);
                await approveCreatorTx.wait();
                console.log(`Creator token approval transaction hash: ${approveCreatorTx.hash}`);
                
                // Step 4: Add liquidity
                console.log("Adding liquidity...");
                try {
                    const addLiqTx = await liquidityManager.addLiquidity(
                        tokenAddress,
                        minLiquidityAmount, // Creator tokens
                        minLiquidityAmount  // CORAL tokens
                    );
                    
                    console.log("Waiting for transaction confirmation...");
                    const receipt = await addLiqTx.wait();
                    console.log(`Liquidity addition successful, transaction hash: ${addLiqTx.hash}`);
                    
                    // Check reserves
                    const reserves = await liquidityManager.getReserves(tokenAddress);
                    console.log("Reserves after liquidity addition:", {
                        creatorTokens: utils.formatEther(reserves[0]),
                        coralTokens: utils.formatEther(reserves[1])
                    });
                    
                    // Step 5: List token on router
                    console.log("Checking if token is already listed on router...");
                    const isListed = await tokenRouter.listedTokens(tokenAddress);
                    console.log(`Is token already listed on router: ${isListed}`);
                    
                    if (!isListed) {
                        console.log("Listing token on the router...");
                        const listTx = await tokenRouter.listNewCreatorToken(tokenAddress);
                        await listTx.wait();
                        console.log(`Token successfully listed on the router, transaction hash: ${listTx.hash}`);
                    } else {
                        console.log("Token is already listed on the router.");
                    }
                    
                    // Update token metadata to reflect liquidity status
                    await (TokenMetadata.findOneAndUpdate as Function)(
                        { tokenAddress },
                        { 
                            hasLiquidity: true, 
                            isListedForTrading: true,
                            initialLiquidityAmount: utils.formatEther(minLiquidityAmount),
                            liquidityAddedAt: new Date(),
                            creatorTokenReserve: utils.formatEther(reserves[0]),
                            coralTokenReserve: utils.formatEther(reserves[1])
                        },
                        { new: true }
                    );
                    
                    // Post liquidity addition tweet
                    const content: Content = {
                        text: `💧 Liquidity Added for ${creator.snippet.title} Token!\n\n` +
                              `Initial Price: $${roundedPrice}\n` +
                              `Token Address: ${tokenAddress}\n\n` +
                              `Now available for trading on our platform!\n` +
                              `#CreatorTokens #Web3 #DeFi`,
                        source: 'youtube'
                    };
                    
                    await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
                        this.client.twitterConfig.TWITTER_USERNAME, '');
                    
                } catch (error) {
                    console.error("Error in liquidity addition:", error);
                    
                    // Try with fallback amounts if initial attempt fails
                    console.log("Trying fallback with different amounts...");
                    
                    // Get available balances
                    const availableCreator = await creatorERC20.balanceOf(signerAddress);
                    const availableCoral = await coralToken.balanceOf(signerAddress);
                    
                    console.log("Available balances for liquidity:", {
                        creatorTokens: utils.formatEther(availableCreator),
                        coralTokens: utils.formatEther(availableCoral)
                    });
                    
                    // Use 90% of available balances (to account for gas)
                    const creatorAmount = availableCreator.mul(9).div(10);
                    const coralAmount = availableCoral.mul(9).div(10);
                    
                    if (creatorAmount.lt(utils.parseEther("1")) || coralAmount.lt(utils.parseEther("1"))) {
                        throw new Error("Insufficient token balances for fallback liquidity addition");
                    }
                    
                    console.log("Using amounts for fallback liquidity:", {
                        creatorTokens: utils.formatEther(creatorAmount),
                        coralTokens: utils.formatEther(coralAmount)
                    });
                    
                    // Approve tokens again with new amounts
                    const approveCoralFallbackTx = await coralToken.approve(LIQUIDITY_MANAGER_ADDRESS, coralAmount);
                    await approveCoralFallbackTx.wait();
                    
                    const approveCreatorFallbackTx = await creatorERC20.approve(LIQUIDITY_MANAGER_ADDRESS, creatorAmount);
                    await approveCreatorFallbackTx.wait();
                    
                    // Try adding liquidity with fallback amounts
                    const fallbackTx = await liquidityManager.addLiquidity(
                        tokenAddress,
                        creatorAmount,
                        coralAmount
                    );
                    
                    console.log("Waiting for fallback transaction confirmation...");
                    await fallbackTx.wait();
                    console.log(`Fallback liquidity addition successful, transaction hash: ${fallbackTx.hash}`);
                    
                    // Check reserves after fallback
                    const fallbackReserves = await liquidityManager.getReserves(tokenAddress);
                    console.log("Reserves after fallback liquidity addition:", {
                        creatorTokens: utils.formatEther(fallbackReserves[0]),
                        coralTokens: utils.formatEther(fallbackReserves[1])
                    });
                    
                    // Update token metadata with fallback values
                    await (TokenMetadata.findOneAndUpdate as Function)(
                        { tokenAddress },
                        { 
                            hasLiquidity: true, 
                            isListedForTrading: true,
                            initialLiquidityAmount: utils.formatEther(Math.min(
                                Number(utils.formatEther(creatorAmount)),
                                Number(utils.formatEther(coralAmount))
                            )),
                            liquidityAddedAt: new Date(),
                            creatorTokenReserve: utils.formatEther(fallbackReserves[0]),
                            coralTokenReserve: utils.formatEther(fallbackReserves[1]),
                            priceDiscoveryCompleted: true
                        },
                        { new: true }
                    );
                }
                
            } catch (error) {
                console.error(`Error adding liquidity for ${creator.snippet.title}:`, error);
                
                // Even if contract interaction fails, update the database with price discovery
                await (TokenMetadata.findOneAndUpdate as Function)(
                    { tokenAddress },
                    { 
                        priceDiscoveryCompleted: true,
                        currentPrice: roundedPrice,
                        priceHistory: [{ price: roundedPrice, timestamp: new Date() }]
                    },
                    { new: true }
                );
                
                // Post price discovery tweet even if liquidity failed
                const fallbackContent: Content = {
                    text: `💰 Price Discovery Completed for ${creator.snippet.title} Token!\n\n` +
                          `Initial Price: $${roundedPrice}\n` +
                          `Token Address: ${tokenAddress}\n\n` +
                          `#CreatorTokens #Web3 #PriceDiscovery`,
                    source: 'youtube'
                };
                
                await sendTweet(this.client, fallbackContent, stringToUuid('youtube-monitor'),
                    this.client.twitterConfig.TWITTER_USERNAME, '');
            }
            
        } catch (error) {
            console.error(`Error in price discovery for ${creator.snippet.title}:`, error);
        }
    }

    // New method to clean up expired creators (older than 24 hours)
    private async cleanupExpiredCreators(): Promise<void> {
        try {
            const now = Date.now();
            const creators = await (Creator as any).find({ isTracking: true });
            
            for (const creator of creators) {
                const lastUpdated24h = creator.metrics.lastUpdated24h || 0;
                const age = now - lastUpdated24h;
                
                // If creator is older than 24 hours, stop tracking
                if (age > this.creatorLifespan) {
                    console.log(`Creator ${creator.name} has expired (${Math.round(age / (60 * 60 * 1000))} hours old). Stopping tracking.`);
                    creator.isTracking = false;
                    await creator.save();
                }
            }
        } catch (error) {
            console.error("Error cleaning up expired creators:", error);
        }
    }

    private async getTotalChannelLikes(channelId: string): Promise<number> {
        try {
            // Get channel's uploaded videos playlist
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'contentDetails',
                    id: channelId,
                    key: this.apiKey
                }
            });

            const uploadsPlaylistId = channelResponse.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) return 0;

            // Get videos from the playlist
            const videosResponse = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    part: 'id',
                    channelId: channelId,
                    maxResults: 50,  // Get more videos to find top ones
                    order: 'viewCount', // Sort by views to likely get most liked videos
                    type: 'video',
                    key: this.apiKey
                }
            });

            // Get video IDs
            const videoIds = videosResponse.data.items
                .map((item: any) => item.id.videoId)
                .slice(0, 10); // Take top 10

            // Get video statistics
            const videoStatsResponse = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'statistics',
                    id: videoIds.join(','),
                    key: this.apiKey
                }
            });

            // Sum up likes from top 10 most viewed videos
            const totalLikes = videoStatsResponse.data.items.reduce((sum: number, video: any) => {
                return sum + Number(video.statistics.likeCount || 0);
            }, 0);

            return totalLikes;
        } catch (error) {
            console.error(`Error getting total likes for channel ${channelId}:`, error);
            return 0;
        }
    }

    private async postDailyLeaderboard(): Promise<void> {
        try {
            console.log("Preparing daily creator leaderboard...");

            // Get all tracked creators with their metadata
            const tokenMetadata = await (TokenMetadata.find as Function)({})
                .sort({ subscribers: -1 }) // Sort by subscriber count
                .limit(10); // Get top 10 to analyze growth

            // Get fresh data for these creators
            const channelIds = tokenMetadata.map(meta => meta.channelId);
            const response = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet,statistics',
                    id: channelIds.join(','),
                    key: this.apiKey
                }
            });

            // Calculate growth rates
            const creatorsWithGrowth = response.data.items.map((channel: YouTubeChannel) => {
                const stored = tokenMetadata.find(meta => meta.channelId === channel.id);
                if (!stored) return null;

                const currentSubs = Number(channel.statistics.subscriberCount);
                const storedSubs = stored.subscribers;
                const growthRate = ((currentSubs - storedSubs) / storedSubs) * 100;

                return {
                    name: channel.snippet.title,
                    subscribers: currentSubs,
                    growth: growthRate,
                    channelId: channel.id
                };
            }).filter(Boolean);

            // Sort by growth rate and get top 3
            const topGrowers = creatorsWithGrowth
                .sort((a, b) => b.growth - a.growth)
                .slice(0, 3);

            // Format subscriber counts
            const formatSubs = (subs: number) => {
                if (subs >= 1000000) {
                    return `${(subs / 1000000).toFixed(1)}M`;
                }
                if (subs >= 1000) {
                    return `${(subs / 1000).toFixed(1)}K`;
                }
                return subs.toString();
            };
            
            // Truncate channel names if they're too long
            const truncateName = (name: string, maxLength: number = 20): string => {
                return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
            };

            // Create leaderboard tweet
            const date = new Date().toLocaleDateString();
            const headerText = `🏆 Daily Creator Leaderboard (${date})\n\n`;
            const footerText = `\n🔥 Keep growing creators!`;
            
            // Create creator entries with a compact format
            const creatorEntries = topGrowers.map((creator, i) => {
                const name = truncateName(creator.name);
                const subs = formatSubs(creator.subscribers);
                const growthSymbol = creator.growth > 0 ? '📈' : '📉';
                const growthText = Math.abs(creator.growth).toFixed(2);
                
                return `${i + 1}. ${name}\n   • ${subs} Subs\n   • ${growthSymbol} ${growthText}% change`;
            });
            
            // Check if the tweet is within Twitter's character limit (280 chars)
            const TWITTER_CHAR_LIMIT = 280;
            let tweetText = headerText + creatorEntries.join('\n\n') + footerText;
            
            // If the tweet is too long, use a more compact format
            if (tweetText.length > TWITTER_CHAR_LIMIT) {
                console.log(`Leaderboard tweet too long (${tweetText.length} chars), using more compact format`);
                
                // Use an even more compact format for each creator
                const compactCreatorEntries = topGrowers.map((creator, i) => {
                    const name = truncateName(creator.name, 15);
                    const subs = formatSubs(creator.subscribers);
                    const growthSymbol = creator.growth > 0 ? '📈' : '📉';
                    const growthText = Math.abs(creator.growth).toFixed(1);
                    
                    // Extremely compact format
                    return `${i + 1}. ${name}: ${subs} subs, ${growthSymbol}${growthText}%`;
                });
                
                tweetText = headerText + compactCreatorEntries.join('\n') + footerText;
            }
            
            const content: Content = {
                text: tweetText,
                source: 'youtube'
            };

            await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

            console.log("Daily leaderboard posted successfully");

        } catch (error) {
            console.error("Error posting daily leaderboard:", error);
        }
    }
}