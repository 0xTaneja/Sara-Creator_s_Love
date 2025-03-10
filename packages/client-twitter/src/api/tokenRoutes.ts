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
      subscribers: token.subscribers || 0, // Ensure subscribers is never null or undefined
      views: token.views || 0, // Ensure views is never null or undefined
      likes: token.likes || Math.max(Math.round((token.subscribers || 0) * 0.02), Math.round((token.views || 0) * 0.03)) || 1000, // Ensure likes is never null or undefined, use estimation if zero
      tokenAddress: token.tokenAddress,
      channelUrl: token.channelUrl,
      videoCount: token.videoCount || 0, // Ensure videoCount is never null or undefined
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
      
      // Ensure likes are never null or undefined
      const likes = creator.metrics?.likes || 0;
      
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
        likes: likes,
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
      const tokenResults = tokenCreators.map((token: any) => {
        // Estimate likes based on subscribers and views if not available
        let estimatedLikes = 0;
        if (token.subscribers && token.views) {
          // Typical like-to-subscriber ratio is around 1-5%
          // Typical like-to-view ratio is around 2-8%
          estimatedLikes = Math.max(
            Math.round(token.subscribers * 0.02), // 2% of subscribers
            Math.round(token.views * 0.03)        // 3% of views
          );
        }
        
        return {
          id: token._id.toString(),
          channelId: token.channelId,
          name: token.creatorName,
          symbol: token.creatorName.split(' ').map((word: string) => word[0]).join('').toUpperCase(),
          price: token.currentPrice || 1.0,
          priceChange: 0,
          imageUrl: token.imageUrl,
          subscribers: token.subscribers,
          views: token.views,
          likes: estimatedLikes,
          tokenAddress: token.tokenAddress,
          channelUrl: token.channelUrl,
          videoCount: token.videoCount,
          region: 'global', // Default region
          engagementScore: 0, // Default engagement score
          category: '',
          hasToken: true,
          lastUpdated: token.lastUpdated
        };
      });
      
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
      subscribers: token.subscribers || 0, // Ensure subscribers is never null or undefined
      views: token.views || 0, // Ensure views is never null or undefined
      likes: token.likes || Math.max(Math.round((token.subscribers || 0) * 0.02), Math.round((token.views || 0) * 0.03)) || 1000, // Ensure likes is never null or undefined, use estimation if zero
      tokenAddress: token.tokenAddress,
      channelUrl: token.channelUrl,
      videoCount: token.videoCount || 0, // Ensure videoCount is never null or undefined
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

// GET token price history
router.get('/tokens/:id/price-history', async (req, res) => {
  try {
    const token = await (TokenMetadata as any).findById(req.params.id).lean();
    
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Get the timeframe from query params (default to 7d)
    const timeframe = req.query.timeframe || '7d';
    
    // If the token has price history, use it
    if (token.priceHistory && token.priceHistory.length > 0) {
      // Filter based on timeframe
      const now = new Date();
      let startDate = new Date();
      
      switch(timeframe) {
        case '24h':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'all':
          // No filtering needed
          break;
        default:
          startDate.setDate(now.getDate() - 7); // Default to 7 days
      }
      
      // Filter and format the price history
      const filteredHistory = token.priceHistory
        .filter((entry: any) => new Date(entry.timestamp) >= startDate)
        .map((entry: any) => ({
          price: entry.price,
          timestamp: entry.timestamp
        }));
      
      return res.json(filteredHistory);
    }
    
    // If no price history, generate mock data
    const mockPriceHistory = generateMockPriceHistory(token.currentPrice || 1.0, timeframe);
    res.json(mockPriceHistory);
  } catch (error) {
    console.error('Error fetching token price history:', error);
    res.status(500).json({ error: 'Failed to fetch token price history' });
  }
});

// Helper function to generate mock price history data
function generateMockPriceHistory(currentPrice: number, timeframe: string | any) {
  const now = new Date();
  let dataPoints = 0;
  let interval = 0;
  
  // Determine number of data points and interval based on timeframe
  switch(timeframe) {
    case '24h':
      dataPoints = 24;
      interval = 60 * 60 * 1000; // 1 hour in milliseconds
      break;
    case '7d':
      dataPoints = 7 * 24;
      interval = 60 * 60 * 1000; // 1 hour in milliseconds
      break;
    case '30d':
      dataPoints = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      break;
    case 'all':
      dataPoints = 90;
      interval = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      break;
    default:
      dataPoints = 7 * 24;
      interval = 60 * 60 * 1000; // 1 hour in milliseconds
  }
  
  // Generate price data with some randomness but trending toward current price
  const priceHistory = [];
  let price = currentPrice * 0.7; // Start at 70% of current price
  
  for (let i = 0; i < dataPoints; i++) {
    // Calculate timestamp for this data point
    const timestamp = new Date(now.getTime() - (dataPoints - i) * interval);
    
    // Add some randomness to the price
    const randomFactor = 1 + (Math.random() * 0.1 - 0.05); // Random factor between 0.95 and 1.05
    price = price * randomFactor;
    
    // Trend toward current price
    const trendFactor = 1 + ((currentPrice - price) / price) * 0.1;
    price = price * trendFactor;
    
    priceHistory.push({
      price: parseFloat(price.toFixed(6)),
      timestamp: timestamp
    });
  }
  
  // Ensure the last price matches the current price
  if (priceHistory.length > 0) {
    priceHistory[priceHistory.length - 1].price = currentPrice;
  }
  
  return priceHistory;
}

export default router; 