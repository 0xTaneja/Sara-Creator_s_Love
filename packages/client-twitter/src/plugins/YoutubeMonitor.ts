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
import CreatorTokenABI from './abi/CreatorToken.json';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TokenMetadata } from '../models/TokenMetadata';

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
        thumbnails?: {
            default?: {
                url: string;
            };
        };
    };
    statistics: {
        viewCount: string;
        subscriberCount: string;
        videoCount: string;
        likeCount: string;
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
            console.log("Fetching trending YouTube creators...");
            
            // First get the most popular videos in last 24 hours
            const trendingResponse = await axios.get(`${this.baseUrl}/videos`, {
                params: {
                    part: 'snippet,statistics',
                    chart: 'mostPopular',
                    regionCode: 'US',
                    maxResults: 50,  // Get more videos to find truly trending creators
                    videoCategoryId: '0', // All categories
                    key: this.apiKey
                }
            });

            // Extract channel IDs from trending videos
            const channelIds = [...new Set(trendingResponse.data.items
                .map((item: any) => item.snippet.channelId))];

            console.log(`Found ${channelIds.length} channels with trending videos`);

            // Get detailed channel information
            const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                params: {
                    part: 'snippet,statistics,contentDetails',
                    id: channelIds.join(','),
                    key: this.apiKey
                }
            });

            // Calculate engagement score for each channel
            const channelsWithScore = channelResponse.data.items.map((channel: YouTubeChannel) => {
                const views = Number(channel.statistics.viewCount);
                const subs = Number(channel.statistics.subscriberCount);
                const videos = Number(channel.statistics.videoCount);
                
                // Engagement score considers recent activity and overall popularity
                const engagementScore = (views / (videos || 1)) * Math.log10(subs + 1);
                
                return { ...channel, engagementScore };
            });

            // Get top 5 most engaging channels
            const topCreators = channelsWithScore
                .sort((a, b) => b.engagementScore - a.engagementScore)
                .slice(0, 5);

            console.log(`Selected top ${topCreators.length} trending creators`);

            // Post trending creators tweet
            const date = new Date().toLocaleDateString();
            const creatorContent: Content = {
                text: `🔥 Top 5 Trending Creators (${date})!\n\n` +
                      topCreators.map((creator, i) => 
                          `${i + 1}. ${creator.snippet.title}\n` +
                          `   • ${(Number(creator.statistics.subscriberCount) / 1000000).toFixed(1)}M subscribers\n` +
                          `   • ${(Number(creator.statistics.viewCount) / 1000000).toFixed(1)}M views\n` +
                          `   • ${Number(creator.statistics.videoCount).toLocaleString()} videos\n`
                      ).join('\n') +
                      `\n📈 These creators are on fire! 🔥`,
                source: 'youtube'
            };

            await sendTweet(this.client, creatorContent, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

            // Store creators for monitoring
            for (const creator of topCreators) {
                await this.storeCreatorMetrics(creator, true);
            }

            this.lastTrendingUpdate = Date.now();
            console.log("Successfully posted trending creators update");

            // Post trending videos separately
            await this.postTrendingVideos();

        } catch (error) {
            console.error("Error fetching trending creators:", error);
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
            const creators = await Creator.find({ isTracking: true });
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
                lastVideoTimestamp: 0
            };

            // Find or create creator
            let creator = await Creator.findOne({ channelId: channel.id });
            
            if (creator) {
                // Check for significant changes
                const stored = creator.metrics;
                const viewsChange = Math.abs((metrics.views - stored.views) / stored.views);
                const subsChange = Math.abs((metrics.subscribers - stored.subscribers) / stored.subscribers);
                const likesChange = Math.abs((metrics.likes - stored.likes) / (stored.likes || 1));

                if (viewsChange > THRESHOLDS.VIEWS_CHANGE || 
                    subsChange > THRESHOLDS.SUBS_CHANGE || 
                    likesChange > THRESHOLDS.LIKES_CHANGE) {
                    
                    // Update metrics
                    creator.metrics = metrics;
                    creator.lastUpdated = new Date();
                    await creator.save();

                    // Post update tweet
                    await this.postMetricsUpdateTweet(channel, stored, metrics);
                }
            } else {
                // Create new creator
                creator = await Creator.create({
                    channelId: channel.id,
                    name: channel.snippet.title,
                    metrics,
                    isTracking: true
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
            const creators = await Creator.find({ isTracking: true });
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

    // private async checkMetricsChanges(
    //     storedMetrics: CreatorMetrics,
    //     currentChannel: YouTubeChannel
    // ): Promise<void> {
    //     const stored = storedMetrics.metrics;
    //     const currentViews = Number(currentChannel.statistics.viewCount);
    //     const currentSubs = Number(currentChannel.statistics.subscriberCount);
    //     const currentLikes = Number(currentChannel.statistics.likeCount || 0);

    //     const viewsChange = Math.abs((currentViews - stored.views) / stored.views);
    //     const subsChange = Math.abs((currentSubs - stored.subscribers) / stored.subscribers);
    //     const likesChange = Math.abs((currentLikes - stored.likes) / (stored.likes || 1));

    //     // Add direction indicators
    //     const viewsDirection = currentViews > stored.views ? '📈' : '📉';
    //     const subsDirection = currentSubs > stored.subscribers ? '⬆️' : '⬇️';
    //     const likesDirection = currentLikes > stored.likes ? '💫' : '〽️';

    //     if (viewsChange > THRESHOLDS.VIEWS_CHANGE || 
    //         subsChange > THRESHOLDS.SUBS_CHANGE || 
    //         likesChange > THRESHOLDS.LIKES_CHANGE) {
            
    //         const viewsChangePercent = (viewsChange * 100).toFixed(2);
    //         const subsChangePercent = (subsChange * 100).toFixed(2);
    //         const likesChangePercent = (likesChange * 100).toFixed(2);
            
    //         // Add timestamp to make each tweet unique
    //         const timestamp = new Date().toLocaleTimeString();
            
    //         const content: Content = {
    //             text: `📊 Creator Metrics Update (${timestamp})\n\n` +
    //                   `${currentChannel.snippet.title}\n` +
    //                   `• Subscribers: ${Number(currentSubs).toLocaleString()} ${subsDirection} (${subsChangePercent}% change)\n` +
    //                   `• Views: ${Number(currentViews).toLocaleString()} ${viewsDirection} (${viewsChangePercent}% change)\n` +
    //                   `• Likes: ${Number(currentLikes).toLocaleString()} ${likesDirection} (${likesChangePercent}% change)\n\n` +
    //                   `#YouTubeCreator #Analytics`,
    //             source: 'youtube'
    //         };

    //         await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
    //             this.client.twitterConfig.TWITTER_USERNAME, '');

    //         // Store new metrics
    //         await this.storeCreatorMetrics(currentChannel, false);
    //     }
    // }

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
                await TokenMetadata.findOneAndUpdate(
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
            
            // Store token metadata
            await TokenMetadata.create({
                creatorName: creator.snippet.title,
                channelId: creator.id,
                tokenAddress: tokenAddress,
                subscribers: Number(creator.statistics.subscriberCount),
                views: Number(creator.statistics.viewCount),
                imageUrl: imageUrl,
                mintTimestamp: new Date(),
                channelUrl: channelLink,
                videoCount: Number(creator.statistics.videoCount),
                lastUpdated: new Date()
            });

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

        } catch (error) {
            console.error(`Error in mintCreatorToken for ${creator.snippet.title}:`, error);
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
            const tokenMetadata = await TokenMetadata.find({})
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

            // Create leaderboard tweet
            const date = new Date().toLocaleDateString();
            const content: Content = {
                text: `🏆 Daily Creator Leaderboard (${date})\n\n` +
                      topGrowers.map((creator, i) => 
                          `${i + 1}. ${creator.name}\n` +
                          `   • ${formatSubs(creator.subscribers)} Subs\n` +
                          `   • ${creator.growth > 0 ? '📈' : '📉'} ${Math.abs(creator.growth).toFixed(2)}% change\n`
                      ).join('\n') +
                      `\n🔥 Keep growing creators!`,
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
