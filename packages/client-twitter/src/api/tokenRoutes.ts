import express, { Router } from 'express';
import { TokenMetadata } from '../models/TokenMetadata';
import { connectDB } from '../db/connection';
import { Creator } from '../models/Creator';

// Ensure database connection
connectDB();

const router: Router = express.Router();

// GET all tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await (TokenMetadata as any).find({})
      .sort({ mintTimestamp: -1 }) // Sort by newest first
      .lean(); // Convert to plain JavaScript objects
    
    // Transform the data to match the format expected by the frontend
    const formattedTokens = tokens.map((token: any) => ({
      id: token._id.toString(),
      name: token.creatorName,
      symbol: token.creatorName.split(' ').map((word: string) => word[0]).join('').toUpperCase(),
      price: token.currentPrice || 1.0, // Default price if not set
      priceChange: 0, // Default value, would be calculated in a real app
      imageUrl: token.imageUrl,
      subscribers: token.subscribers,
      views: token.views,
      tokenAddress: token.tokenAddress,
      channelUrl: token.channelUrl,
      videoCount: token.videoCount,
      mintTimestamp: token.mintTimestamp,
      isListedForTrading: token.isListedForTrading,
      priceDiscoveryCompleted: token.priceDiscoveryCompleted,
      hasLiquidity: token.hasLiquidity
    }));
    
    res.json(formattedTokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// GET trending creators (top 5 by subscriber count)
router.get('/trending-creators', async (req, res) => {
  try {
    console.log('Fetching trending creators...');
    
    // Get query parameters
    const region = req.query.region as string || 'global';
    const timeframe = req.query.timeframe as string || '24h';
    
    console.log(`Filtering by region: ${region}, timeframe: ${timeframe}`);
    
    // Calculate the timestamp for 24 hours ago
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Build the query based on parameters
    let creatorQuery: any = { isTracking: true };
    
    // Add region filter if specified
    if (region !== 'global') {
      creatorQuery.region = region;
    }
    
    // Add timeframe filter for 24h
    if (timeframe === '24h') {
      creatorQuery['metrics.lastUpdated24h'] = { $gte: twentyFourHoursAgo };
    }
    
    // First try to get from Creator model with engagement score
    const creators = await (Creator as any).find(creatorQuery)
      .sort({ engagementScore: -1 }) // Sort by engagement score in descending order
      .limit(5)
      .lean();
    
    console.log(`Found ${creators.length} trending creators matching criteria`);
    
    // Format creators with enhanced data
    const formattedResults = creators.map((creator: any) => {
      // Generate a token symbol from creator name
      const symbol = creator.tokenSymbol || 
                    creator.name.split(' ')
                      .map((word: string) => word[0])
                      .join('')
                      .toUpperCase();
      
      return {
        id: creator._id.toString(),
        channelId: creator.channelId,
        name: creator.name,
        symbol: symbol,
        price: creator.tokenPrice || 1.0,
        priceChange: creator.tokenPriceChange24h || 0,
        imageUrl: creator.imageUrl || 
                 `https://i.ytimg.com/vi/${creator.metrics?.lastVideoId || 'default'}/hqdefault.jpg`,
        subscribers: creator.metrics?.subscribers || 0,
        views: creator.metrics?.views || 0,
        likes: creator.metrics?.likes || 0,
        tokenAddress: creator.tokenAddress || '',
        channelUrl: creator.channelUrl || `https://www.youtube.com/channel/${creator.channelId}`,
        videoCount: creator.videoCount || 0,
        region: creator.region || 'global',
        engagementScore: creator.engagementScore || 0,
        category: creator.category || '',
        hasToken: creator.hasToken || false,
        lastUpdated: creator.lastUpdated
      };
    });
    
    // If we don't have enough creators from the Creator model, supplement with TokenMetadata
    if (formattedResults.length < 5) {
      console.log('Not enough creators, fetching from TokenMetadata model...');
      
      // Get creators from TokenMetadata that aren't already in our results
      const existingChannelIds = formattedResults.map(c => c.channelId);
      
      const tokenCreators = await (TokenMetadata as any).find({
        channelId: { $nin: existingChannelIds }
      })
        .sort({ subscribers: -1 })
        .limit(5 - formattedResults.length)
        .lean();
      
      // Format token creators
      const tokenResults = tokenCreators.map((token: any) => ({
        id: token._id.toString(),
        channelId: token.channelId,
        name: token.creatorName,
        symbol: token.creatorName.split(' ').map((word: string) => word[0]).join('').toUpperCase(),
        price: token.currentPrice || 1.0,
        priceChange: 0,
        imageUrl: token.imageUrl,
        subscribers: token.subscribers,
        views: token.views,
        likes: 0,
        tokenAddress: token.tokenAddress,
        channelUrl: token.channelUrl,
        videoCount: token.videoCount,
        region: 'global', // Default region
        engagementScore: 0, // Default engagement score
        category: '',
        hasToken: true,
        lastUpdated: token.lastUpdated
      }));
      
      // Combine both lists
      formattedResults.push(...tokenResults);
    }
    
    console.log(`Returning ${formattedResults.length} trending creators`);
    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching trending creators:', error);
    res.status(500).json({ error: 'Failed to fetch trending creators' });
  }
});

// GET token by ID
router.get('/tokens/:id', async (req, res) => {
  try {
    const token = await (TokenMetadata as any).findById(req.params.id).lean();
    
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Format the token data
    const formattedToken = {
      id: token._id.toString(),
      name: token.creatorName,
      symbol: token.creatorName.split(' ').map((word: string) => word[0]).join('').toUpperCase(),
      price: token.currentPrice || 1.0,
      priceChange: 0,
      imageUrl: token.imageUrl,
      subscribers: token.subscribers,
      views: token.views,
      tokenAddress: token.tokenAddress,
      channelUrl: token.channelUrl,
      videoCount: token.videoCount,
      mintTimestamp: token.mintTimestamp,
      isListedForTrading: token.isListedForTrading,
      priceDiscoveryCompleted: token.priceDiscoveryCompleted,
      hasLiquidity: token.hasLiquidity
    };
    
    res.json(formattedToken);
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

export default router; 