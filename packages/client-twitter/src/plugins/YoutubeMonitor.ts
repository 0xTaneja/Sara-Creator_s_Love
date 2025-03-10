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
    // These are now base thresholds that will be adjusted based on creator size
    VIEWS_CHANGE: parseFloat(process.env.THRESHOLD_VIEWS || '0.001'),
    LIKES_CHANGE: parseFloat(process.env.THRESHOLD_LIKES || '0.002'),
    SUBS_CHANGE: parseFloat(process.env.THRESHOLD_SUBS || '0.001'),
};

// Helper function to get adaptive thresholds based on creator size
function getAdaptiveThreshold(metricType: string, count: number): number {
    const baseThreshold = THRESHOLDS[metricType];
    
    // Scale thresholds based on creator size
    if (metricType === 'SUBS_CHANGE') {
        if (count < 10000) return baseThreshold * 2;       // More sensitive for small creators
        if (count < 100000) return baseThreshold * 1.5;    // Slightly more sensitive for medium creators
        if (count < 1000000) return baseThreshold;         // Base threshold for large creators
        return baseThreshold * 0.5;                        // Less sensitive for very large creators
    } 
    else if (metricType === 'VIEWS_CHANGE') {
        if (count < 100000) return baseThreshold * 2;      // More sensitive for small creators
        if (count < 1000000) return baseThreshold * 1.5;   // Slightly more sensitive for medium creators
        if (count < 10000000) return baseThreshold;        // Base threshold for large creators
        return baseThreshold * 0.5;                        // Less sensitive for very large creators
    }
    else if (metricType === 'LIKES_CHANGE') {
        if (count < 10000) return baseThreshold * 2;       // More sensitive for small creators
        if (count < 100000) return baseThreshold * 1.5;    // Slightly more sensitive for medium creators
        if (count < 1000000) return baseThreshold;         // Base threshold for large creators
        return baseThreshold * 0.5;                        // Less sensitive for very large creators
    }
    
    // Default fallback
    return baseThreshold;
}

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
    private apiKeys: string[] = [];
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
        
        // Initialize API keys array with all available keys
        this.apiKeys = [
            process.env.YOUTUBE_API_KEY || '',
            process.env.YOUTUBE_API_KEY_2 || '',
            process.env.YOUTUBE_API_KEY_3 || ''
        ].filter(key => key); // Filter out empty keys
        
        if (this.apiKeys.length === 0) {
            throw new Error('At least one YouTube API key is required');
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
        // Schedule metrics check with tiered approach
        const scheduleMetricsCheck = () => {
            console.log("Scheduling next metrics check...");
            
            setTimeout(async () => {
                console.log("Running scheduled metrics check...");
                try {
                    // Get current hour and minute for scheduling tiers
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    
                    // Check Tier 1 creators (every 30 minutes)
                    const tier1Creators = await (Creator as any).find({ 
                        isTracking: true, 
                        monitoringTier: 1 
                    });
                    
                    if (tier1Creators.length > 0) {
                        console.log(`Checking ${tier1Creators.length} Tier 1 creators (current trending)`);
                        await this.checkCreatorsMetrics(tier1Creators);
                    }
                    
                    // Check Tier 2 creators (every 2 hours)
                    if (currentMinute < 30 && currentHour % 2 === 0) {
                        const tier2Creators = await (Creator as any).find({ 
                            isTracking: true, 
                            monitoringTier: 2 
                        });
                        
                        if (tier2Creators.length > 0) {
                            console.log(`Checking ${tier2Creators.length} Tier 2 creators (recently trending)`);
                            await this.checkCreatorsMetrics(tier2Creators);
                        }
                    }
                    
                    // Check Tier 3 creators (once daily at midnight)
                    if (currentHour === 0 && currentMinute < 30) {
                        const tier3Creators = await (Creator as any).find({ 
                            isTracking: true, 
                            monitoringTier: 3 
                        });
                        
                        if (tier3Creators.length > 0) {
                            console.log(`Checking ${tier3Creators.length} Tier 3 creators (previously trending)`);
                            await this.checkCreatorsMetrics(tier3Creators);
                        }
                    }
                    
                    // Check for expired creators
                    await this.cleanupExpiredCreators();
                } catch (error) {
                    console.error("Error in metrics check:", error);
                }
                
                // Schedule next check in 30 minutes
                scheduleMetricsCheck();
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

                // Then schedule daily
                setInterval(() => {
                    this.postDailyLeaderboard().catch(error => {
                        console.error("Error in leaderboard post:", error);
                    });
                }, 24 * 60 * 60 * 1000);
            }, INITIAL_DELAY);
        };

        // Start all scheduled tasks
        scheduleMetricsCheck();
        scheduleTrendingCheck();
        scheduleLeaderboard();
    }

    private async getTrendingCreators(): Promise<void> {
        try {
            console.log("Fetching trending YouTube creators from US region...");
            
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            // First get the most popular videos in last 24 hours
            let trendingResponse;
            while (attempts < maxAttempts) {
                try {
                    trendingResponse = await axios.get(`${this.baseUrl}/videos`, {
                        params: {
                            part: 'snippet,statistics',
                            chart: 'mostPopular',
                            regionCode: 'US', // Specifically targeting US region
                            maxResults: 50,  // Get more videos to find truly trending creators
                            videoCategoryId: '0', // All categories
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching trending videos:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, throw an error
                    if (attempts >= maxAttempts) {
                        throw new Error(`All API keys failed when fetching trending videos after ${attempts} attempts.`);
                    }
                }
            }

            // Extract channel IDs from trending videos
            const channelIds = [...new Set(trendingResponse.data.items
                .map((item: any) => item.snippet.channelId))];

            console.log(`Found ${channelIds.length} channels with trending videos in US region`);

            // Reset attempts for the next API call
            attempts = 0;
            
            // Get detailed channel information
            let channelResponse;
            while (attempts < maxAttempts) {
                try {
                    channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                        params: {
                            part: 'snippet,statistics,contentDetails,brandingSettings',
                            id: channelIds.join(','),
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching channel details:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, throw an error
                    if (attempts >= maxAttempts) {
                        throw new Error(`All API keys failed when fetching channel details after ${attempts} attempts.`);
                    }
                }
            }

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

            // Create a more detailed format for each creator with clear separation
            const creatorEntries = topCreators.map((creator, i) => {
                const name = creator.snippet.title; // Don't truncate names
                const subs = formatNumber(Number(creator.statistics.subscriberCount));
                const views = formatNumber(Number(creator.statistics.viewCount));
                const videos = formatNumber(Number(creator.statistics.videoCount));
                
                // Use a detailed format with all information and clear paragraph structure
                return `${i + 1}. ${name}\n• ${subs} subscribers\n• ${views} views\n• ${videos} videos\n• Channel: https://www.youtube.com/channel/${creator.id}`;
            });
            
            // Create a detailed tweet format with clear separation between creators
            const date = new Date().toLocaleDateString();
            const headerText = `🔥 Top 5 Trending US Creators (${date})!\n\n`;
            const footerText = `\n📈 These creators are on fire! Follow them for great content! 🔥\n#YouTube #Trending #Creators`;
            
            // Join with double line breaks to ensure clear separation in the thread
            const tweetText = headerText + creatorEntries.join('\n\n') + footerText;
            
            console.log(`Tweet length: ${tweetText.length} characters`);
            console.log(`Tweet content preview: ${tweetText.substring(0, 100)}...`);
            
            // Create the tweet content
            const creatorContent: Content = {
                text: tweetText,
                source: 'youtube'
            };
            
            // Send the tweet - it will be automatically split into a thread if too long
            await sendTweet(this.client, creatorContent, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');

            console.log("Trending creators tweet posted successfully");
            
            // Store creators for monitoring with 24-hour lifespan
            for (const creator of topCreators) {
                // Store creator metrics and set lastTrendingDate to now
                await this.storeCreatorMetrics(creator, true);
                
                // Update any existing creator to set lastTrendingDate and monitoringTier
                const existingCreator = await (Creator as any).findOne({ channelId: creator.id });
                if (existingCreator) {
                    await (Creator as any).findByIdAndUpdate(existingCreator._id, {
                        lastTrendingDate: new Date(),
                        monitoringTier: 1 // Set to tier 1 (current trending)
                    });
                }
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
            
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            let response;
            while (attempts < maxAttempts) {
                try {
                    response = await axios.get(`${this.baseUrl}/videos`, {
                        params: {
                            part: 'snippet,statistics',
                            chart: 'mostPopular',
                            regionCode: 'US',
                            maxResults: 50,
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching trending videos:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, throw an error
                    if (attempts >= maxAttempts) {
                        throw new Error(`All API keys failed when fetching trending videos after ${attempts} attempts.`);
                    }
                }
            }

            // Post top 5 trending videos with full details and clear separation
            const trendingVideos = response.data.items.slice(0, 5);
            const date = new Date().toLocaleDateString();
            
            // Format each video with clear structure and separation
            const videoEntries = trendingVideos.map((video: any, i: number) => {
                const publishDate = new Date(video.snippet.publishedAt).toLocaleDateString();
                return `${i + 1}. "${video.snippet.title}"\n` +
                       `• ${Number(video.statistics.viewCount).toLocaleString()} views\n` +
                       `• ${Number(video.statistics.likeCount || 0).toLocaleString()} likes\n` +
                       `• Published: ${publishDate}\n` +
                       `• By: ${video.snippet.channelTitle}\n` +
                       `• Watch: https://www.youtube.com/watch?v=${video.id}`;
            });
            
            const headerText = `🔥 Top 5 Trending Videos on YouTube (${date})!\n\n`;
            const footerText = `\n📈 Check out these trending videos and stay tuned for more updates! #YouTube #TrendingVideos`;
            
            // Join with double line breaks to ensure clear separation in the thread
            const tweetText = headerText + videoEntries.join('\n\n') + footerText;
            
            console.log(`Tweet length: ${tweetText.length} characters`);
            console.log(`Tweet content preview: ${tweetText.substring(0, 100)}...`);
            
            const videoContent: Content = {
                text: tweetText,
                source: 'youtube'
            };

            // Send the tweet - it will be automatically split into a thread if too long
            await sendTweet(this.client, videoContent, stringToUuid('youtube-monitor'),
                this.client.twitterConfig.TWITTER_USERNAME, '');
                
            console.log("Trending videos tweet posted successfully");

        } catch (error) {
            console.error("Error posting trending videos:", error);
        }
    }

    // Helper method to get the next available API key with rotation
    private async getNextApiKey(): Promise<string> {
        // Simply return the first key without rotating
        return this.apiKeys[0];
    }

    // New method to rotate to the next API key when the current one fails
    private async rotateToNextApiKey(): Promise<string> {
        // If we have multiple keys, rotate to the next one
        if (this.apiKeys.length > 1) {
            // Move the first key to the end of the array for rotation
            const currentKey = this.apiKeys.shift() as string;
            this.apiKeys.push(currentKey);
            console.log(`Rotating to next YouTube API key due to failure: ${this.apiKeys[0].substring(0, 5)}...`);
            return this.apiKeys[0];
        }
        
        // If we only have one key, just return it
        console.log(`Only one YouTube API key available, cannot rotate.`);
        return this.apiKeys[0];
    }

    // Helper method to check metrics for a list of creators
    private async checkCreatorsMetrics(creators: any[]): Promise<void> {
        for (const creator of creators) {
            try {
                // Start with the current API key
                let currentApiKey = await this.getNextApiKey();
                let attempts = 0;
                const maxAttempts = this.apiKeys.length; // Try each key at most once
                
                // Get fresh channel data
                let response;
                while (attempts < maxAttempts) {
                    try {
                        response = await axios.get(`${this.baseUrl}/channels`, {
                            params: {
                                part: 'snippet,statistics',
                                id: creator.channelId,
                                key: currentApiKey
                            }
                        });
                        break; // If successful, break out of the loop
                    } catch (error) {
                        console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching channel metrics for ${creator.name}:`, error.message);
                        
                        // Rotate to the next API key only on failure
                        currentApiKey = await this.rotateToNextApiKey();
                        attempts++;
                        
                        // If we've tried all keys, log error and continue to next creator
                        if (attempts >= maxAttempts) {
                            console.error(`All API keys failed when fetching metrics for ${creator.name} after ${attempts} attempts.`);
                            break;
                        }
                    }
                }

                if (response && response.data.items?.[0]) {
                    const channel = response.data.items[0];
                    
                    // Process metrics for this creator
                    await this.processCreatorMetrics(creator, channel);
                }
            } catch (error) {
                console.error(`Error checking metrics for ${creator.name}:`, error);
            }
        }
    }
    
    // Process metrics for a single creator
    private async processCreatorMetrics(creator: any, channel: YouTubeChannel): Promise<void> {
        try {
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

            // Check if any metric has a significant change
            const viewsThreshold = getAdaptiveThreshold('VIEWS_CHANGE', currentMetrics.views);
            const subsThreshold = getAdaptiveThreshold('SUBS_CHANGE', currentMetrics.subscribers);
            const likesThreshold = getAdaptiveThreshold('LIKES_CHANGE', currentMetrics.likes);
            
            const hasSignificantViewsChange = viewsChange > viewsThreshold;
            const hasSignificantSubsChange = subsChange > subsThreshold;
            const hasSignificantLikesChange = likesChange > likesThreshold;
            
            // Only post if at least one metric has a significant change
            if (hasSignificantViewsChange || hasSignificantSubsChange || hasSignificantLikesChange) {
                console.log(`Significant changes detected for ${creator.name} - posting update`);
                console.log(`Views change: ${viewsChange.toFixed(4)} (threshold: ${viewsThreshold})`);
                console.log(`Subscribers change: ${subsChange.toFixed(4)} (threshold: ${subsThreshold})`);
                console.log(`Likes change: ${likesChange.toFixed(4)} (threshold: ${likesThreshold})`);
                
                // Update metrics
                const updatedMetrics = {
                    ...creator.metrics,
                    views: currentMetrics.views,
                    likes: currentMetrics.likes,
                    subscribers: currentMetrics.subscribers,
                    lastUpdated24h: Date.now()
                };
                
                await (Creator as any).findByIdAndUpdate(creator._id, { 
                    metrics: updatedMetrics
                });
                
                // Post metrics update tweet
                const timestamp = new Date().toLocaleTimeString();
                const content: Content = {
                    text: `📊 Creator Metrics Update (${timestamp})\n\n` +
                          `${channel.snippet.title}\n` +
                          `${viewsDirection} Views: ${currentMetrics.views.toLocaleString()} ${hasSignificantViewsChange ? `(${(viewsChange * 100).toFixed(2)}% change)` : ''}\n` +
                          `${subsDirection} Subscribers: ${currentMetrics.subscribers.toLocaleString()} ${hasSignificantSubsChange ? `(${(subsChange * 100).toFixed(2)}% change)` : ''}\n` +
                          `${likesDirection} Total Likes: ${currentMetrics.likes.toLocaleString()} ${hasSignificantLikesChange ? `(${(likesChange * 100).toFixed(2)}% change)` : ''}\n\n` +
                          `#CreatorMetrics #YouTubeAnalytics`,
                    source: 'youtube'
                };

                await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
                    this.client.twitterConfig.TWITTER_USERNAME, '');
            } else {
                console.log(`No significant changes detected for ${creator.name} - skipping tweet`);
                console.log(`Views change: ${viewsChange.toFixed(4)} (threshold: ${viewsThreshold})`);
                console.log(`Subscribers change: ${subsChange.toFixed(4)} (threshold: ${subsThreshold})`);
                console.log(`Likes change: ${likesChange.toFixed(4)} (threshold: ${likesThreshold})`);
                
                // Still update the metrics in the database
                const updatedMetrics = {
                    ...creator.metrics,
                    views: currentMetrics.views,
                    likes: currentMetrics.likes,
                    subscribers: currentMetrics.subscribers,
                    lastUpdated24h: Date.now()
                };
                
                await (Creator as any).findByIdAndUpdate(creator._id, { 
                    metrics: updatedMetrics
                });
            }
            
            // Check for new videos regardless of metrics changes
            await this.checkNewVideos(creator, channel);
            
        } catch (error) {
            console.error(`Error processing metrics for ${creator.name}:`, error);
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
            // Get total likes for the channel with improved error handling
            let totalLikes = await this.getTotalChannelLikes(channel.id);
            console.log(`Total likes for ${channel.snippet.title}: ${totalLikes}`);

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
                // Check for significant changes using adaptive thresholds
                const stored = creator.metrics;
                const viewsChange = Math.abs((metrics.views - stored.views) / stored.views);
                const subsChange = Math.abs((metrics.subscribers - stored.subscribers) / stored.subscribers);
                
                // Handle the case where likes might be 0 or estimated
                let likesChange = 0;
                if (stored.likes > 0 && metrics.likes > 0) {
                    likesChange = Math.abs((metrics.likes - stored.likes) / stored.likes);
                } else if (metrics.likes > 0 && stored.likes === 0) {
                    // If we now have likes data but didn't before, consider it a significant change
                    likesChange = 1; // 100% change
                } else {
                    // If both are 0 or we lost likes data, don't consider it a change
                    likesChange = 0;
                }

                // Check if enough time has passed since the last update (at least 1 hour)
                const lastUpdateTime = creator.metrics.lastUpdated24h || 0;
                const hoursSinceLastUpdate = (Date.now() - lastUpdateTime) / (60 * 60 * 1000);
                const hasEnoughTimePassed = hoursSinceLastUpdate >= 1;

                // Use adaptive thresholds based on creator size
                const hasSignificantChange = 
                    viewsChange > getAdaptiveThreshold('VIEWS_CHANGE', metrics.views) || 
                    subsChange > getAdaptiveThreshold('SUBS_CHANGE', metrics.subscribers) || 
                    likesChange > getAdaptiveThreshold('LIKES_CHANGE', metrics.likes);
                
                // Only post update if there's a significant change AND enough time has passed
                if (hasSignificantChange && hasEnoughTimePassed) {
                    console.log(`Significant changes detected for ${channel.snippet.title} after ${hoursSinceLastUpdate.toFixed(1)} hours`);
                    console.log(`Changes: Views ${viewsChange.toFixed(4)}, Subs ${subsChange.toFixed(4)}, Likes ${likesChange.toFixed(4)}`);
                    
                    // Update metrics with preserved video data
                    const updatedMetrics = {
                        views: metrics.views,
                        likes: metrics.likes,
                        subscribers: metrics.subscribers,
                        lastVideoId: creator.metrics.lastVideoId,
                        lastVideoTimestamp: creator.metrics.lastVideoTimestamp,
                        lastUpdated24h: metrics.lastUpdated24h
                    };
                    
                    // Update creator with new metrics and set trending date if this is from trending check
                    await (Creator as any).findByIdAndUpdate(creator._id, { 
                        metrics: updatedMetrics,
                        lastTrendingDate: postInitialMetrics ? new Date() : creator.lastTrendingDate,
                        monitoringTier: postInitialMetrics ? 1 : creator.monitoringTier // Set to tier 1 if trending
                    });
                    
                    // Post metrics update tweet
                    await this.postMetricsUpdateTweet(channel, stored, metrics);
                } else {
                    // Still update the metrics in the database without posting
                    console.log(`No significant changes or too soon for ${channel.snippet.title} - updating DB only`);
                    if (!hasSignificantChange) {
                        console.log(`Changes: Views ${viewsChange.toFixed(4)}, Subs ${subsChange.toFixed(4)}, Likes ${likesChange.toFixed(4)}`);
                    }
                    if (!hasEnoughTimePassed) {
                        console.log(`Only ${hoursSinceLastUpdate.toFixed(1)} hours since last update`);
                    }
                    
                    // Preserve likes data if the new value is 0 but we had a non-zero value before
                    // This prevents API rate limiting from causing likes to disappear
                    if (metrics.likes === 0 && stored.likes > 0) {
                        console.log(`Preserving previous likes data (${stored.likes}) for ${channel.snippet.title} due to API limitations`);
                        metrics.likes = stored.likes;
                    }
                    
                    const updatedMetrics = {
                        views: metrics.views,
                        likes: metrics.likes,
                        subscribers: metrics.subscribers,
                        lastVideoId: creator.metrics.lastVideoId,
                        lastVideoTimestamp: creator.metrics.lastVideoTimestamp,
                        lastUpdated24h: creator.metrics.lastUpdated24h // Keep the original timestamp
                    };
                    
                    await (Creator as any).findByIdAndUpdate(creator._id, { 
                        metrics: updatedMetrics,
                        lastTrendingDate: postInitialMetrics ? new Date() : creator.lastTrendingDate,
                        monitoringTier: postInitialMetrics ? 1 : creator.monitoringTier
                    });
                }
                
                // Check for new videos regardless of metrics changes
                await this.checkNewVideos(creator, channel);
                
                // Check if token needs to be minted
                if (!creator.hasToken && !creator.tokenAddress) {
                    console.log(`Creator ${channel.snippet.title} doesn't have a token yet - starting token creation process...`);
                    
                    // Mint token, which will also trigger price discovery and liquidity addition
                    await this.mintCreatorToken(channel);
                    
                    // Update creator record to reflect token creation
                    const tokenAddress = await this.contract.getCreatorToken(`https://youtube.com/channel/${channel.id}`);
                    if (tokenAddress) {
                        await (Creator as any).findByIdAndUpdate(creator._id, {
                            hasToken: true,
                            tokenAddress: tokenAddress
                        });
                        console.log(`Updated creator record with token address: ${tokenAddress}`);
                    }
                }
                
            } else {
                // Create new creator entry
                creator = await (Creator as any).create({
                    channelId: channel.id,
                    name: channel.snippet.title,
                    metrics: metrics,
                    isTracking: true,
                    lastTrendingDate: new Date(), // Track when this creator was first trending
                    monitoringTier: 1, // Start at tier 1 (current trending)
                    hasToken: false,
                    tokenAddress: ''
                });
                
                console.log(`Created new creator: ${channel.snippet.title}`);
                
                // Post initial metrics tweet only if explicitly requested and not in testing mode
                if (postInitialMetrics && process.env.TWITTER_DRY_RUN !== 'true') {
                    await this.postInitialMetricsTweet(channel, metrics);
                    
                    // Start the complete token creation process for new creator
                    console.log(`Starting complete token creation process for new creator: ${channel.snippet.title}`);
                    
                    try {
                        // Step 1: Mint token
                        await this.mintCreatorToken(channel);
                        
                        // The mintCreatorToken function will automatically:
                        // 1. Mint the token
                        // 2. Call initiatePriceDiscoveryAndLiquidity which:
                        //    - Calculates initial price
                        //    - Adds liquidity
                        //    - Lists the token for trading
                        
                        // Update creator record with token information
                        const tokenAddress = await this.contract.getCreatorToken(`https://youtube.com/channel/${channel.id}`);
                        if (tokenAddress) {
                            await (Creator as any).findByIdAndUpdate(creator._id, {
                                hasToken: true,
                                tokenAddress: tokenAddress
                            });
                            console.log(`Updated new creator record with token address: ${tokenAddress}`);
                        }
                    } catch (error) {
                        console.error(`Error in token creation process for ${channel.snippet.title}:`, error);
                    }
                } else {
                    console.log(`Skipping initial metrics tweet and token creation for ${channel.snippet.title} (postInitialMetrics=${postInitialMetrics}, TWITTER_DRY_RUN=${process.env.TWITTER_DRY_RUN})`);
                }
            }
        } catch (error) {
            console.error(`Error storing metrics for ${channel.snippet.title}:`, error);
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
            
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            let response;
            while (attempts < maxAttempts) {
                try {
                    response = await axios.get(`${this.baseUrl}/search`, {
                        params: {
                            part: 'snippet',
                            channelId: channel.id,
                            order: 'date',
                            maxResults: 1,
                            type: 'video',
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when checking new videos for ${creator.name}:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, log error and return
                    if (attempts >= maxAttempts) {
                        console.error(`All API keys failed when checking new videos for ${creator.name} after ${attempts} attempts.`);
                        return;
                    }
                }
            }

            if (!response) return;
            
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
        
        // Calculate percentage changes
        const subsChange = stored.subscribers > 0 ? 
            (Math.abs((current.subscribers - stored.subscribers) / stored.subscribers) * 100).toFixed(2) : '0.00';
        
        const viewsChange = stored.views > 0 ? 
            (Math.abs((current.views - stored.views) / stored.views) * 100).toFixed(2) : '0.00';
        
        // Handle the case where likes might be 0 or estimated
        let likesChangeText = '';
        if (stored.likes > 0 && current.likes > 0) {
            const likesChangePercent = (Math.abs((current.likes - stored.likes) / stored.likes) * 100).toFixed(2);
            likesChangeText = `(${likesChangePercent}% change)`;
        } else if (current.likes > 0 && stored.likes === 0) {
            likesChangeText = '(new data)';
        }
        
        const content: Content = {
            text: `📊 Creator Metrics Update (${timestamp})\n\n` +
                  `${channel.snippet.title}\n` +
                  `${subsDirection} Subscribers: ${Number(current.subscribers).toLocaleString()} ${subsChange !== '0.00' ? `(${subsChange}% change)` : ''}\n` +
                  `${viewsDirection} Views: ${Number(current.views).toLocaleString()} ${viewsChange !== '0.00' ? `(${viewsChange}% change)` : ''}\n` +
                  `${likesDirection} Total Likes: ${Number(current.likes).toLocaleString()} ${likesChangeText}\n\n` +
                  `#CreatorMetrics #YouTubeAnalytics`,
            source: 'youtube'
        };

        await sendTweet(this.client, content, stringToUuid('youtube-monitor'),
            this.client.twitterConfig.TWITTER_USERNAME, '');
    }

    private async postInitialMetricsTweet(
        channel: YouTubeChannel,
        metrics: { views: number; likes: number; subscribers: number }
    ): Promise<void> {
        // Format the likes text based on whether we have real data or an estimate
        let likesText = `• Total Likes: ${Number(metrics.likes).toLocaleString()}`;
        if (metrics.likes === 0) {
            likesText = `• Total Likes: Data not available`;
        } else if (metrics.likes % 10 === 0 && metrics.likes >= 1000) {
            // If the likes value is a round number and large, it's likely an estimate
            likesText = `• Est. Total Likes: ${Number(metrics.likes).toLocaleString()}`;
        }

        const content: Content = {
            text: `📊 Initial Metrics for ${channel.snippet.title}:\n` +
                  `• Subscribers: ${Number(metrics.subscribers).toLocaleString()}\n` +
                  `• Total Views: ${Number(metrics.views).toLocaleString()}\n` +
                  `${likesText}\n` +
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
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            let channelResponse;
            while (attempts < maxAttempts) {
                try {
                    channelResponse = await axios.get(`${this.baseUrl}/channels`, {
                        params: {
                            part: 'snippet,statistics,brandingSettings',
                            id: creator.id,
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching channel details for token minting:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, throw an error
                    if (attempts >= maxAttempts) {
                        throw new Error(`All API keys failed when fetching channel details for token minting after ${attempts} attempts.`);
                    }
                }
            }
            
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
                
                // ========= NEW CODE: Direct DEX Liquidity Transfer =========
                // Check if DEX has creator tokens for direct swaps (separate from liquidity pool)
                console.log("Checking if DEX has enough tokens for direct swaps...");
                const dexCreatorBalance = await creatorERC20.balanceOf(SARA_DEX_ADDRESS);
                const dexCoralBalance = await coralToken.balanceOf(SARA_DEX_ADDRESS);
                
                console.log(`DEX creator token balance: ${utils.formatEther(dexCreatorBalance)}`);
                console.log(`DEX CORAL token balance: ${utils.formatEther(dexCoralBalance)}`);
                
                // Transfer creator tokens directly to DEX if needed (for direct swap functionality)
                const minDexAmount = utils.parseEther("5"); // At least 5 tokens for DEX
                
                if (dexCreatorBalance.lt(minDexAmount) && creatorTokenBalance.gte(minDexAmount.mul(2))) {
                    console.log("Transferring creator tokens to DEX for direct swaps...");
                    try {
                        const transferAmount = utils.parseEther("10"); // Transfer 10 tokens to ensure enough liquidity
                        const transferTx = await creatorERC20.transfer(SARA_DEX_ADDRESS, transferAmount);
                        await transferTx.wait();
                        console.log(`Transferred creator tokens to DEX, tx hash: ${transferTx.hash}`);
                        
                        // Verify transfer
                        const newDexBalance = await creatorERC20.balanceOf(SARA_DEX_ADDRESS);
                        console.log(`DEX creator token balance after transfer: ${utils.formatEther(newDexBalance)}`);
                    } catch (error) {
                        console.error(`Error transferring creator tokens to DEX: ${error.message}`);
                        // Continue with the process even if this fails
                    }
                } else if (dexCreatorBalance.lt(minDexAmount)) {
                    console.log("Not enough creator tokens available to transfer to DEX");
                } else {
                    console.log("DEX already has sufficient creator tokens for direct swaps");
                }
                
                // Transfer CORAL tokens to DEX if needed (for direct swap functionality)
                if (dexCoralBalance.lt(minDexAmount) && coralBalance.gte(minDexAmount.mul(2))) {
                    console.log("Transferring CORAL tokens to DEX for direct swaps...");
                    try {
                        const transferAmount = utils.parseEther("10"); // Transfer 10 tokens to ensure enough liquidity
                        const transferTx = await coralToken.transfer(SARA_DEX_ADDRESS, transferAmount);
                        await transferTx.wait();
                        console.log(`Transferred CORAL tokens to DEX, tx hash: ${transferTx.hash}`);
                        
                        // Verify transfer
                        const newDexBalance = await coralToken.balanceOf(SARA_DEX_ADDRESS);
                        console.log(`DEX CORAL token balance after transfer: ${utils.formatEther(newDexBalance)}`);
                    } catch (error) {
                        console.error(`Error transferring CORAL tokens to DEX: ${error.message}`);
                        // Continue with the process even if this fails
                    }
                } else if (dexCoralBalance.lt(minDexAmount)) {
                    console.log("Not enough CORAL tokens available to transfer to DEX");
                } else {
                    console.log("DEX already has sufficient CORAL tokens for direct swaps");
                }
                
                // Check final DEX balances for swap functionality
                const finalDexCreatorBalance = await creatorERC20.balanceOf(SARA_DEX_ADDRESS);
                const finalDexCoralBalance = await coralToken.balanceOf(SARA_DEX_ADDRESS);
                
                console.log("\n=== Final DEX Token Balances (for swap functionality) ===");
                console.log(`Creator token: ${utils.formatEther(finalDexCreatorBalance)}`);
                console.log(`CORAL token: ${utils.formatEther(finalDexCoralBalance)}`);
                
                if (finalDexCreatorBalance.gte(minDexAmount) && finalDexCoralBalance.gte(minDexAmount)) {
                    console.log("\n✅ DEX has enough tokens for direct swaps. The swap should work in the UI.");
                } else {
                    console.log("\n⚠️ DEX may not have enough tokens for direct swaps. Swaps might fail until more tokens are added.");
                }
                // ========== END NEW CODE ==========
                
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
            console.log("Checking for expired creators...");
            
            // Get monitoring duration from environment variable or use default (7 days)
            const monitoringDays = parseInt(process.env.CREATOR_MONITORING_DAYS || '7');
            const now = Date.now();
            
            // Get all tracked creators
            const creators = await (Creator as any).find({ isTracking: true });
            console.log(`Found ${creators.length} tracked creators to check for expiration`);
            
            for (const creator of creators) {
                // Calculate days since last trending update
                const daysSinceLastTrending = creator.lastTrendingDate 
                    ? (now - new Date(creator.lastTrendingDate).getTime()) / (24 * 60 * 60 * 1000)
                    : (now - creator.metrics.lastUpdated24h) / (24 * 60 * 60 * 1000);
                
                // Determine if creator should be expired based on monitoring days
                if (daysSinceLastTrending > monitoringDays) {
                    // Stop tracking after configured days
                    await (Creator as any).findByIdAndUpdate(creator._id, { 
                        isTracking: false 
                    });
                    console.log(`Stopped tracking ${creator.name} after ${daysSinceLastTrending.toFixed(1)} days`);
                } else {
                    // Update monitoring tier based on days since trending
                    let monitoringTier = 1; // Current trending (0-1 day)
                    
                    if (daysSinceLastTrending >= 1 && daysSinceLastTrending < 3) {
                        monitoringTier = 2; // Recently trending (1-3 days)
                    } else if (daysSinceLastTrending >= 3) {
                        monitoringTier = 3; // Previously trending (3+ days)
                    }
                    
                    // Update the monitoring tier
                    await (Creator as any).findByIdAndUpdate(creator._id, { 
                        monitoringTier 
                    });
                    
                    console.log(`Updated ${creator.name} to monitoring tier ${monitoringTier} (${daysSinceLastTrending.toFixed(1)} days since trending)`);
                }
            }
        } catch (error) {
            console.error("Error cleaning up expired creators:", error);
        }
    }

    private async getTotalChannelLikes(channelId: string): Promise<number> {
        try {
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            while (attempts < maxAttempts) {
                try {
                    // Get top 10 videos from channel
                    const videosResponse = await axios.get(`${this.baseUrl}/search`, {
                        params: {
                            part: 'snippet',
                            channelId: channelId,
                            maxResults: 10,
                            order: 'viewCount',
                            type: 'video',
                            key: currentApiKey
                        }
                    });

                    // Extract video IDs
                    const videoIds = videosResponse.data.items.map((item: any) => item.id.videoId);
                    
                    if (videoIds.length === 0) {
                        console.log(`No videos found for channel ${channelId}`);
                        return this.estimateLikesFromSubscribers(channelId);
                    }

                    // Get video statistics
                    const videoStatsResponse = await axios.get(`${this.baseUrl}/videos`, {
                        params: {
                            part: 'statistics',
                            id: videoIds.join(','),
                            key: currentApiKey
                        }
                    });

                    // Sum up likes from top 10 most viewed videos
                    const totalLikes = videoStatsResponse.data.items.reduce((sum: number, video: any) => {
                        return sum + Number(video.statistics.likeCount || 0);
                    }, 0);

                    console.log(`Successfully fetched likes for channel ${channelId}: ${totalLikes}`);
                    return totalLikes;
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed for channel ${channelId}:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, break out of the loop
                    if (attempts >= maxAttempts) {
                        console.error(`All API keys failed for channel ${channelId} after ${attempts} attempts.`);
                        break;
                    }
                }
            }

            // If all API keys failed, use the fallback method
            console.error(`All API keys failed for channel ${channelId}. Falling back to estimation.`);
            return this.estimateLikesFromSubscribers(channelId);
        } catch (error) {
            console.error(`Error getting total likes for channel ${channelId}:`, error);
            return this.estimateLikesFromSubscribers(channelId);
        }
    }

    // Fallback method to estimate likes based on subscribers and views
    private async estimateLikesFromSubscribers(channelId: string): Promise<number> {
        try {
            // Try to get the creator from the database
            const creator = await (Creator as any).findOne({ channelId });
            
            if (creator && creator.metrics && creator.metrics.likes > 0) {
                // If we have previous likes data, use that
                console.log(`Using stored likes data for channel ${channelId}: ${creator.metrics.likes}`);
                return creator.metrics.likes;
            }
            
            // If we have the channel data, estimate based on subscribers and views
            if (creator && creator.metrics) {
                const subscribers = creator.metrics.subscribers || 0;
                const views = creator.metrics.views || 0;
                
                // Typical like-to-subscriber ratio is around 1-5%
                // Typical like-to-view ratio is around 2-8%
                // We'll use a conservative estimate
                const estimatedLikes = Math.max(
                    Math.round(subscribers * 0.02), // 2% of subscribers
                    Math.round(views * 0.03)        // 3% of views
                );
                
                console.log(`Estimated likes for channel ${channelId}: ${estimatedLikes} (based on ${subscribers} subscribers and ${views} views)`);
                return estimatedLikes;
            }
            
            // If we don't have any data, return a default value
            return 1000; // Default fallback value
        } catch (error) {
            console.error(`Error estimating likes for channel ${channelId}:`, error);
            return 1000; // Default fallback value
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
            
            // Start with the current API key
            let currentApiKey = await this.getNextApiKey();
            let attempts = 0;
            const maxAttempts = this.apiKeys.length; // Try each key at most once
            
            let response;
            while (attempts < maxAttempts) {
                try {
                    response = await axios.get(`${this.baseUrl}/channels`, {
                        params: {
                            part: 'snippet,statistics',
                            id: channelIds.join(','),
                            key: currentApiKey
                        }
                    });
                    break; // If successful, break out of the loop
                } catch (error) {
                    console.warn(`API key ${currentApiKey.substring(0, 5)}... failed when fetching leaderboard data:`, error.message);
                    
                    // Rotate to the next API key only on failure
                    currentApiKey = await this.rotateToNextApiKey();
                    attempts++;
                    
                    // If we've tried all keys, throw an error
                    if (attempts >= maxAttempts) {
                        throw new Error(`All API keys failed when fetching leaderboard data after ${attempts} attempts.`);
                    }
                }
            }

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