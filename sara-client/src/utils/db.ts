import { CandleData } from '../api/server';

// LocalStorage key for swap events
const SWAP_EVENTS_KEY = 'sara_swap_events';

// Define the SwapEvent interface locally to avoid server dependencies
export interface SwapEvent {
  txHash: string;
  timestamp: number;
  tokenAddress: string;
  coralAmount: string;
  tokenAmount: string;
  sender: string;
  isCoralToCT: boolean;
  price: number;
  block?: number;
  createdAt?: Date;
}

// In-memory cache for swap events to avoid repeated localStorage access
let sessionSwapEvents: SwapEvent[] = [];

// Initialize from localStorage if available
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const storedEvents = localStorage.getItem(SWAP_EVENTS_KEY);
    if (storedEvents) {
      const parsedEvents = JSON.parse(storedEvents);
      
      // Process each event to ensure proper data types
      sessionSwapEvents = parsedEvents.map((event: any) => {
        // Parse numeric values
        const parsedCoralAmount = typeof event.coralAmount === 'string' 
          ? parseFloat(event.coralAmount) || 0 
          : typeof event.coralAmount === 'number' 
            ? event.coralAmount 
            : 0;
            
        const parsedTokenAmount = typeof event.tokenAmount === 'string' 
          ? parseFloat(event.tokenAmount) || 0 
          : typeof event.tokenAmount === 'number' 
            ? event.tokenAmount 
            : 0;
            
        const parsedPrice = typeof event.price === 'number' 
          ? event.price 
          : parseFloat(String(event.price) || '0') || 0;
        
        // Return a new event with properly typed values
        return {
          ...event,
          coralAmount: parsedCoralAmount.toString(),
          tokenAmount: parsedTokenAmount.toString(),
          price: isNaN(parsedPrice) ? 0 : parsedPrice
        };
      });
      
      console.log(`Loaded and processed ${sessionSwapEvents.length} events from localStorage`);
      if (sessionSwapEvents.length > 0) {
        console.log('Sample event after processing:', sessionSwapEvents[0]);
      }
    }
  } catch (error) {
    console.error('Error loading events from localStorage:', error);
  }
}

// Helper function to save to localStorage
const saveToLocalStorage = (events: SwapEvent[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SWAP_EVENTS_KEY, JSON.stringify(events));
      console.log(`Saved ${events.length} events to localStorage`);
    }
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

/**
 * Save a swap event to localStorage
 */
export const saveSwapEvent = async (swapEvent: SwapEvent): Promise<boolean> => {
  try {
    console.log('Saving swap event to localStorage:', swapEvent);
    
    // Validate required fields
    if (!swapEvent.txHash) {
      console.error('Missing txHash in swap event');
      return false;
    }
    
    if (!swapEvent.tokenAddress) {
      console.error('Missing tokenAddress in swap event');
      return false;
    }
    
    // Parse the numeric values first to ensure they're valid
    const parsedCoralAmount = typeof swapEvent.coralAmount === 'string'
      ? parseFloat(swapEvent.coralAmount) 
      : typeof swapEvent.coralAmount === 'number'
        ? swapEvent.coralAmount
        : 0;
    
    const parsedTokenAmount = typeof swapEvent.tokenAmount === 'string'
      ? parseFloat(swapEvent.tokenAmount)
      : typeof swapEvent.tokenAmount === 'number'
        ? swapEvent.tokenAmount
        : 0;
    
    const parsedPrice = typeof swapEvent.price === 'number'
      ? swapEvent.price
      : parseFloat(String(swapEvent.price) || '0') || 0;
    
    console.log('Parsed values for saving:', {
      coralAmount: parsedCoralAmount,
      tokenAmount: parsedTokenAmount,
      price: parsedPrice
    });
    
    // Normalize the event data
    const normalizedEvent: SwapEvent = {
      ...swapEvent,
      txHash: swapEvent.txHash,
      tokenAddress: swapEvent.tokenAddress.toLowerCase(),
      sender: (swapEvent.sender || '').toLowerCase(),
      // Ensure timestamp is in milliseconds
      timestamp: typeof swapEvent.timestamp === 'number' 
        ? (swapEvent.timestamp < 2000000000 ? swapEvent.timestamp * 1000 : swapEvent.timestamp)
        : Date.now(),
      // Store the parsed values as strings
      coralAmount: parsedCoralAmount.toString(),
      tokenAmount: parsedTokenAmount.toString(),
      // Store the price as a number
      price: isNaN(parsedPrice) ? 0 : parsedPrice
    };
    
    // Check if this event already exists
    const exists = sessionSwapEvents.some(event => event.txHash === normalizedEvent.txHash);
    if (!exists) {
      // Add to in-memory cache
      sessionSwapEvents.push(normalizedEvent);
      
      // Sort by timestamp (newest first)
      sessionSwapEvents.sort((a, b) => b.timestamp - a.timestamp);
      
      // Cap the cache size
      if (sessionSwapEvents.length > 100) {
        sessionSwapEvents.pop(); // Remove oldest
      }
      
      // Save to localStorage
      saveToLocalStorage(sessionSwapEvents);
      console.log(`Added swap event to localStorage: ${normalizedEvent.txHash}`);
    } else {
      console.log(`Swap event already exists: ${normalizedEvent.txHash}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving swap event:', error);
    return false;
  }
};

/**
 * Get swap events for a token from localStorage
 */
export const getSwapEvents = async (tokenAddress: string, limit: number = 100): Promise<SwapEvent[]> => {
  try {
    console.log(`Fetching swap events from localStorage for token: ${tokenAddress}`);
    
    if (!tokenAddress) {
      console.warn('No tokenAddress provided to getSwapEvents');
      return [];
    }
    
    // Normalize token address
    const normalizedTokenAddress = tokenAddress.toLowerCase();
    
    // Filter by token address
    const filteredEvents = sessionSwapEvents.filter(
      event => event.tokenAddress.toLowerCase() === normalizedTokenAddress
    );
    
    // Sort by timestamp (newest first)
    const sortedEvents = [...filteredEvents].sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit if specified
    const limitedEvents = limit ? sortedEvents.slice(0, limit) : sortedEvents;
    
    // Ensure all numeric values are properly parsed
    const processedEvents = limitedEvents.map(event => {
      // Parse numeric values
      const parsedCoralAmount = typeof event.coralAmount === 'string' 
        ? parseFloat(event.coralAmount) || 0 
        : typeof event.coralAmount === 'number' 
          ? event.coralAmount 
          : 0;
          
      const parsedTokenAmount = typeof event.tokenAmount === 'string' 
        ? parseFloat(event.tokenAmount) || 0 
        : typeof event.tokenAmount === 'number' 
          ? event.tokenAmount 
          : 0;
          
      const parsedPrice = typeof event.price === 'number' 
        ? event.price 
        : parseFloat(String(event.price) || '0') || 0;
      
      // Create a new event with parsed values
      return {
        ...event,
        coralAmount: parsedCoralAmount.toString(),
        tokenAmount: parsedTokenAmount.toString(),
        price: isNaN(parsedPrice) ? 0 : parsedPrice
      };
    });
    
    console.log(`Found ${processedEvents.length} events in localStorage for token ${normalizedTokenAddress}`);
    console.log('Sample event after processing:', processedEvents[0]);
    
    return processedEvents;
  } catch (error) {
    console.error('Error getting swap events from localStorage:', error);
    return [];
  }
};

/**
 * Get the latest price for a token
 */
export const getLatestPrice = async (tokenAddress: string): Promise<number | null> => {
  try {
    if (!tokenAddress) return null;
    
    // Get the latest swap for this token
    const events = await getSwapEvents(tokenAddress, 1);
    
    if (events.length > 0) {
      return events[0].price;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting latest price:', error);
    return null;
  }
};

/**
 * Generate a deterministic but realistic mock price change for a token
 * @param tokenAddress The token address
 * @returns A mock price change percentage between -5% and +15%
 */
export const generateMockPriceChange = (tokenAddress: string): number => {
  if (!tokenAddress) return 0;
  
  // Create a simple hash from the token address to generate a deterministic value
  const hash = tokenAddress.split('').reduce((sum, char, index) => {
    return sum + char.charCodeAt(0) * (index + 1);
  }, 0);
  
  // Generate a value between -5 and +15 to give a bias toward positive changes
  // but still show some tokens with negative price action
  const min = -5;
  const max = 15;
  const range = max - min;
  
  // Use hash to generate a value between min and max
  const percentage = min + (hash % range);
  
  // Add some decimal precision (1-2 decimal places)
  const decimalPart = (hash % 100) / 100;
  const result = percentage + decimalPart;
  
  console.log(`Generated mock price change for ${tokenAddress}: ${result.toFixed(2)}%`);
  
  return result;
};

/**
 * Calculate price change percentage over a time period
 * @param tokenAddress The token address
 * @param timeframe Time period in hours (default 24 hours)
 * @returns Price change percentage or null if not enough data
 */
export const calculatePriceChange = async (tokenAddress: string, timeframe: number = 24): Promise<number | null> => {
  try {
    if (!tokenAddress) {
      console.log('No token address provided for price change calculation');
      return 0; // Return 0 instead of null to avoid NaN
    }
    
    const normalizedTokenAddress = tokenAddress.toLowerCase();
    console.log(`Calculating price change for token: ${normalizedTokenAddress}`);
    
    // Get all swap events for this token
    const events = await getSwapEvents(normalizedTokenAddress, 100);
    console.log(`Found ${events.length} events for token ${normalizedTokenAddress}`);
    
    if (events.length === 0) {
      console.log('No swap events found, using mock price change');
      // Generate a mock change for tokens without trading history
      return generateMockPriceChange(normalizedTokenAddress);
    }
    
    // Debug all events to see their timestamps and prices
    console.log('All swap events (newest first):');
    events.slice(0, 5).forEach((event, index) => {
      console.log(`[${index}] Time: ${new Date(event.timestamp).toLocaleString()}, Price: ${event.price}, TX: ${event.txHash.substring(0, 8)}...`);
    });
    
    // Get first and last event for simplest calculation
    if (events.length >= 2) {
      const newestEvent = events[0];
      const oldestEvent = events[events.length - 1];
      
      // Make sure prices are valid numbers and greater than zero
      const newestPrice = typeof newestEvent.price === 'number' ? newestEvent.price : 0;
      const oldestPrice = typeof oldestEvent.price === 'number' ? oldestEvent.price : 0;
      
      console.log('Price values for calculation:', { newestPrice, oldestPrice });
      
      // Validate price values to prevent NaN
      if (!newestPrice || !oldestPrice || isNaN(newestPrice) || isNaN(oldestPrice)) {
        console.log('Invalid price values detected, using mock price change');
        return generateMockPriceChange(normalizedTokenAddress);
      }
      
      // Prevent division by zero
      if (oldestPrice <= 0) {
        console.log('Oldest price is zero or negative, using mock price change to avoid NaN');
        return generateMockPriceChange(normalizedTokenAddress);
      }
      
      // Calculate price change percentage
      const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
      
      // Final validation to catch any NaN results
      if (isNaN(priceChange)) {
        console.log('Price change calculation resulted in NaN, using mock price change');
        return generateMockPriceChange(normalizedTokenAddress);
      }
      
      console.log(`Simple price change calculation:`, {
        newestTime: new Date(newestEvent.timestamp).toLocaleString(),
        oldestTime: new Date(oldestEvent.timestamp).toLocaleString(),
        newestPrice,
        oldestPrice,
        priceChange: priceChange.toFixed(2) + '%'
      });
      
      return priceChange;
    }
    
    console.log('Only one event found, using mock price change');
    return generateMockPriceChange(normalizedTokenAddress);
    
    /* Time-based calculation commented out for now
    // Calculate the cutoff time (e.g., 24 hours ago)
    const now = Date.now();
    const cutoffTime = now - (timeframe * 60 * 60 * 1000);
    console.log(`Current time: ${new Date(now).toLocaleString()}`);
    console.log(`Cutoff time (${timeframe} hours ago): ${new Date(cutoffTime).toLocaleString()}`);
    
    // Latest price
    const latestEvent = events[0];
    const latestPrice = latestEvent.price;
    console.log(`Latest price: ${latestPrice} at ${new Date(latestEvent.timestamp).toLocaleString()}`);
    
    // If we only have one data point, we can't calculate change
    if (events.length === 1) {
      console.log('Only one event found, returning 0% change');
      return 0;
    }
    
    // Sort events by timestamp (newest to oldest)
    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    
    // Find the closest event to our timeframe
    let previousEvent = null;
    for (const event of sortedEvents) {
      if (event.timestamp <= cutoffTime) {
        previousEvent = event;
        break;
      }
    }
    
    // If we didn't find an event old enough, use the oldest available
    if (previousEvent === null) {
      previousEvent = sortedEvents[sortedEvents.length - 1];
      console.log(`No event found before cutoff time, using oldest event from ${new Date(previousEvent.timestamp).toLocaleString()}`);
    } else {
      console.log(`Found event before cutoff time: ${new Date(previousEvent.timestamp).toLocaleString()}`);
    }
    
    const previousPrice = previousEvent.price;
    
    // Calculate percentage change
    if (previousPrice <= 0) {
      console.log('Previous price is zero or negative, returning 0% change');
      return 0; // Avoid division by zero
    }
    
    const priceChange = ((latestPrice - previousPrice) / previousPrice) * 100;
    
    console.log(`Price change calculation for ${normalizedTokenAddress}:`, {
      latestPrice,
      previousPrice,
      timeframe,
      priceChange: priceChange.toFixed(2) + '%'
    });
    
    return priceChange;
    */
  } catch (error) {
    console.error('Error calculating price change:', error);
    return null;
  }
};

/**
 * Get candle data for charts (simplified implementation)
 */
export const getCandleData = async (
  tokenAddress: string, 
  timeframe: string = '1h',
  limit: number = 100
): Promise<CandleData[]> => {
  try {
    if (!tokenAddress) {
      console.log('No token address provided, returning fallback data');
      return generateMockCandleData('0x0', timeframe, limit);
    }
    
    console.log(`Fetching candle data for ${tokenAddress} with timeframe ${timeframe}`);
    const normalizedAddress = tokenAddress.toLowerCase();
    
    // Get all swaps for this token
    const events = await getSwapEvents(normalizedAddress, 1000); // Get more events for accurate candles
    console.log(`Got ${events.length} swap events for candle data for token ${normalizedAddress}`);
    
    // If we have no events, create simulated data
    if (events.length === 0) {
      console.log(`No swap events found for ${normalizedAddress}, returning fallback data`);
      return generateMockCandleData(normalizedAddress, timeframe, limit);
    }
    
    // If we have only a few events, enhance them with generated data
    if (events.length < 5) {
      console.log(`Only ${events.length} swap events found for ${normalizedAddress}, enhancing with generated data`);
      return generateEnhancedCandleData(events, timeframe, limit);
    }
    
    // Group events by time buckets based on timeframe
    const timeframeMs = timeframe === '1h' ? 3600000 : // 1 hour
                       timeframe === '1d' ? 86400000 : // 1 day
                       timeframe === '1w' ? 604800000 : // 1 week
                       300000; // 5 min default
    
    // Group prices by time buckets
    const buckets: Record<string, number[]> = {};
    
    // Track min and max prices for all events
    let minPrice = Number.MAX_VALUE;
    let maxPrice = Number.MIN_VALUE;
    
    // Process each event
    events.forEach(event => {
      // Skip events with invalid timestamps
      if (!event.timestamp || isNaN(event.timestamp)) return;
      
      // Calculate bucket time
      const bucketTime = Math.floor(event.timestamp / timeframeMs) * timeframeMs;
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = [];
      }
      
      // Get price from event
      let price = 0;
      if (typeof event.price === 'number' && !isNaN(event.price) && event.price > 0) {
        // Use provided price if valid
        price = event.price;
      } else {
        // Calculate price from amounts
        const coralAmount = parseFloat(event.coralAmount);
        const tokenAmount = parseFloat(event.tokenAmount);
        if (tokenAmount > 0 && !isNaN(tokenAmount) && !isNaN(coralAmount)) {
          price = coralAmount / tokenAmount;
        }
      }
      
      // Only add valid prices
      if (price > 0 && !isNaN(price)) {
        buckets[bucketTime].push(price);
        
        // Update min and max prices
        minPrice = Math.min(minPrice, price);
        maxPrice = Math.max(maxPrice, price);
      }
    });
    
    // If we don't have any valid price data, use fallback
    if (Object.keys(buckets).length === 0) {
      console.log(`No valid price data found for ${normalizedAddress}, using fallback data`);
      return generateMockCandleData(normalizedAddress, timeframe, limit);
    }
    
    // Convert to candle data format
    const candleData: CandleData[] = [];
    
    Object.keys(buckets)
      .sort((a, b) => parseInt(a) - parseInt(b)) // Sort by time ascending
      .forEach(timeKey => {
        const prices = buckets[parseInt(timeKey)];
        if (!prices || prices.length === 0) return; // Skip empty buckets
        
        const open = prices[0]; // First price in bucket
        const close = prices[prices.length - 1]; // Last price in bucket
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        
        candleData.push({
          time: new Date(parseInt(timeKey)),
          open,
          high,
          low,
          close
        });
      });
    
    console.log(`Created ${candleData.length} real candles from ${events.length} events`);
    
    // If we don't have enough candles, add generated ones
    if (candleData.length < 5) {
      console.log(`Not enough real candles (${candleData.length}), padding with generated data`);
      return padWithGeneratedCandles(candleData, normalizedAddress, timeframe, limit, minPrice, maxPrice);
    }
    
    // Sort candles and limit to requested amount
    const sortedCandles = candleData
      .sort((a, b) => a.time.getTime() - b.time.getTime())
      .slice(-limit);
    
    console.log(`Returning ${sortedCandles.length} candles for chart`);
    return sortedCandles;
  } catch (error) {
    console.error('Error creating candle data:', error);
    return generateMockCandleData(tokenAddress || '0x0', timeframe, limit);
  }
};

/**
 * Generate enhanced candle data from a few real events
 */
const generateEnhancedCandleData = (
  events: SwapEvent[],
  timeframe: string = '1h',
  limit: number = 100
): CandleData[] => {
  if (events.length === 0) {
    return generateMockCandleData('0x0', timeframe, limit);
  }
  
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const tokenAddress = sortedEvents[0].tokenAddress;
  
  // Calculate a realistic price range based on actual events
  let minPrice = Number.MAX_VALUE;
  let maxPrice = 0;
  let latestPrice = 0;
  
  sortedEvents.forEach(event => {
    let price = 0;
    
    // Get price either from event.price or calculate from amounts
    if (typeof event.price === 'number' && !isNaN(event.price) && event.price > 0) {
      price = event.price;
    } else {
      const coralAmount = parseFloat(event.coralAmount);
      const tokenAmount = parseFloat(event.tokenAmount);
      if (tokenAmount > 0 && !isNaN(tokenAmount) && !isNaN(coralAmount)) {
        price = coralAmount / tokenAmount;
      }
    }
    
    if (price > 0) {
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
      latestPrice = price; // Keep track of the most recent price
    }
  });
  
  // Fallback if we couldn't determine a valid price range
  if (minPrice === Number.MAX_VALUE || maxPrice === 0) {
    minPrice = 0.5;
    maxPrice = 2.0;
    latestPrice = 1.0;
  }
  
  // Make sure max and min are different
  if (minPrice === maxPrice) {
    minPrice = maxPrice * 0.9;
    maxPrice = maxPrice * 1.1;
  }
  
  // Get the time range for the candles
  const firstEventTime = sortedEvents[0].timestamp;
  const lastEventTime = sortedEvents[sortedEvents.length - 1].timestamp;
  const now = Date.now();
  
  // Calculate the timeframe in milliseconds
  const timeframeMs = timeframe === '1h' ? 3600000 : // 1 hour
                      timeframe === '1d' ? 86400000 : // 1 day
                      timeframe === '1w' ? 604800000 : // 1 week
                      300000; // 5 min default
  
  // Generate candles
  const candles: CandleData[] = [];
  
  // Add some candles before the first event
  const numPastCandles = Math.min(Math.floor(limit / 3), 10);
  for (let i = numPastCandles; i > 0; i--) {
    const time = new Date(firstEventTime - i * timeframeMs);
    
    // Create a gradual price movement leading up to the first event
    const priceRange = maxPrice - minPrice;
    const priceFactor = 0.5 + (i / numPastCandles) * 0.5; // 0.5 to 1.0
    const midPrice = minPrice + priceFactor * priceRange;
    
    // Add some randomness but keep within the general trend
    const volatility = priceRange * 0.1; // 10% of price range
    const open = midPrice * (1 - volatility/2 + Math.random() * volatility);
    const close = midPrice * (1 - volatility/2 + Math.random() * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    
    candles.push({ time, open, high, low, close });
  }
  
  // Add actual event data where available
  sortedEvents.forEach(event => {
    const time = new Date(event.timestamp);
    let price = 0;
    
    if (typeof event.price === 'number' && !isNaN(event.price) && event.price > 0) {
      price = event.price;
    } else {
      const coralAmount = parseFloat(event.coralAmount);
      const tokenAmount = parseFloat(event.tokenAmount);
      if (tokenAmount > 0 && !isNaN(tokenAmount) && !isNaN(coralAmount)) {
        price = coralAmount / tokenAmount;
      }
    }
    
    if (price > 0) {
      // Create candle data for this event - all OHLC values are the same price
      // This is simplified, in reality you'd want to combine events in the same timeframe
      candles.push({
        time,
        open: price,
        high: price,
        low: price,
        close: price
      });
    }
  });
  
  // Add candles after the last event up to now
  const remainingCandles = limit - candles.length;
  if (remainingCandles > 0) {
    const startTime = lastEventTime + timeframeMs;
    const endTime = Math.min(now, startTime + remainingCandles * timeframeMs);
    
    for (let time = startTime; time <= endTime; time += timeframeMs) {
      // Use the latest real price as base, and add some random walk
      const randomWalk = latestPrice * (Math.random() * 0.06 - 0.03); // -3% to +3%
      const newPrice = latestPrice + randomWalk;
      latestPrice = newPrice; // Update for next candle
      
      // Add some small variations for OHLC
      const volatility = newPrice * 0.02;
      const open = newPrice;
      const close = newPrice * (1 - volatility/2 + Math.random() * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      candles.push({ time: new Date(time), open, high, low, close });
    }
  }
  
  // Sort the final candles by time
  const sortedCandles = candles.sort((a, b) => a.time.getTime() - b.time.getTime());
  
  // Limit to requested number of candles
  return sortedCandles.slice(-limit);
};

/**
 * Pad existing candles with generated ones to reach the desired count
 */
const padWithGeneratedCandles = (
  existingCandles: CandleData[],
  tokenAddress: string,
  timeframe: string = '1h',
  limit: number = 100,
  minPrice: number = 0.5,
  maxPrice: number = 2.0
): CandleData[] => {
  if (existingCandles.length === 0) {
    return generateMockCandleData(tokenAddress, timeframe, limit);
  }
  
  // Sort existing candles
  const sortedCandles = [...existingCandles].sort((a, b) => a.time.getTime() - b.time.getTime());
  
  // Calculate timeframe in ms
  const timeframeMs = timeframe === '1h' ? 3600000 : // 1 hour
                      timeframe === '1d' ? 86400000 : // 1 day
                      timeframe === '1w' ? 604800000 : // 1 week
                      300000; // 5 min default
  
  // Get the first and last candle time
  const firstCandleTime = sortedCandles[0].time.getTime();
  const lastCandleTime = sortedCandles[sortedCandles.length - 1].time.getTime();
  
  // Make sure we have valid price info
  if (minPrice === Number.MAX_VALUE || maxPrice === 0 || minPrice >= maxPrice) {
    // Extract from existing candles if needed
    if (existingCandles.length > 0) {
      minPrice = Math.min(...existingCandles.map(c => c.low));
      maxPrice = Math.max(...existingCandles.map(c => c.high));
      
      // Add some margin
      const range = maxPrice - minPrice;
      minPrice = Math.max(0.1, minPrice - range * 0.1);
      maxPrice = maxPrice + range * 0.1;
    } else {
      // Use token address to seed a deterministic price range
      const seed = parseInt(tokenAddress.slice(-8), 16) || 12345;
      minPrice = 0.5 + (seed % 10) / 10;
      maxPrice = minPrice * (1.5 + (seed % 5) / 10);
    }
  }
  
  // Make a map of existing candle times for easy lookup
  const existingTimes = new Set(sortedCandles.map(c => c.time.getTime()));
  
  // Generate candles before the first real candle
  const allCandles: CandleData[] = [];
  
  // How many past candles to generate
  const numPastCandles = Math.min(Math.floor(limit / 3), 10);
  
  for (let i = numPastCandles; i > 0; i--) {
    const time = new Date(firstCandleTime - i * timeframeMs);
    
    // Base price is between min and max, trending toward the first real candle's open
    const targetPrice = sortedCandles[0].open;
    const priceFactor = i / numPastCandles; // 1.0 to 0.0 as we approach the first real candle
    const basePrice = targetPrice + priceFactor * (minPrice - targetPrice);
    
    // Add some randomness
    const volatility = (maxPrice - minPrice) * 0.1;
    const open = basePrice * (1 - volatility/4 + Math.random() * volatility/2);
    const close = basePrice * (1 - volatility/4 + Math.random() * volatility/2);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    allCandles.push({ time, open, high, low, close });
  }
  
  // Add the real candles
  allCandles.push(...sortedCandles);
  
  // How many future candles to generate
  const now = Date.now();
  const numFutureCandles = Math.min(limit - allCandles.length, 20);
  
  // Generate future candles
  if (numFutureCandles > 0) {
    let lastPrice = sortedCandles[sortedCandles.length - 1].close;
    
    for (let i = 1; i <= numFutureCandles; i++) {
      const time = new Date(lastCandleTime + i * timeframeMs);
      
      // Don't generate candles in the future
      if (time.getTime() > now) break;
      
      // Skip if a candle already exists at this time
      if (existingTimes.has(time.getTime())) continue;
      
      // Random walk from previous price
      const randomWalk = lastPrice * (Math.random() * 0.06 - 0.03); // -3% to +3%
      const basePrice = lastPrice + randomWalk;
      
      // Constrain to price range
      const constrainedPrice = Math.max(minPrice, Math.min(maxPrice, basePrice));
      
      // Add some variation for OHLC
      const volatility = constrainedPrice * 0.02;
      const open = constrainedPrice;
      const close = constrainedPrice * (1 - volatility/2 + Math.random() * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      allCandles.push({ time, open, high, low, close });
      lastPrice = close; // Update for next candle
    }
  }
  
  // Sort by time and limit to requested number
  return allCandles
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .slice(-limit);
};

/**
 * Generate completely mock candle data for a token
 */
const generateMockCandleData = (
  tokenAddress: string,
  timeframe: string = '1h',
  limit: number = 100
): CandleData[] => {
  console.log(`Generating ${limit} mock candles for ${tokenAddress}`);
  
  // Use token address to create deterministic price patterns
  const seed = parseInt(tokenAddress.slice(-8), 16) || 12345;
  
  // Calculate starting parameters based on token address
  const basePrice = 0.5 + (seed % 100) / 40; // Range: 0.5 to 3.0
  const volatility = 0.02 + (seed % 10) / 100; // Range: 0.02 to 0.12
  const trend = ((seed % 10) - 5) / 1000; // Range: -0.005 to 0.005 (small daily trend)
  
  // Calculate the timeframe in milliseconds
  const timeframeMs = timeframe === '1h' ? 3600000 : // 1 hour
                      timeframe === '1d' ? 86400000 : // 1 day
                      timeframe === '1w' ? 604800000 : // 1 week
                      300000; // 5 min default
  
  // Current timestamp
  const now = Date.now();
  
  // Generate candles
  const candles: CandleData[] = [];
  let currentPrice = basePrice;
  
  for (let i = 0; i < limit; i++) {
    // Calculate time for this candle (going backwards from now)
    const time = new Date(now - (limit - i) * timeframeMs);
    
    // Random walk with trend
    const randomWalk = currentPrice * (Math.random() * volatility * 2 - volatility) + trend;
    currentPrice = Math.max(0.1, currentPrice + randomWalk);
    
    // Create candle with realistic OHLC values
    const openFactor = 1 + (Math.random() * volatility * 0.5 - volatility * 0.25);
    const closeFactor = 1 + (Math.random() * volatility * 0.5 - volatility * 0.25);
    
    const open = currentPrice * openFactor;
    const close = currentPrice * closeFactor;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    
    candles.push({ time, open, high, low, close });
  }
  
  return candles;
}; 