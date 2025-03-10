import axios from 'axios';
import { API_URL } from '../config.js';

export interface Creator {
  id: string;
  channelId: string;
  name: string;
  symbol: string;
  price: number;
  priceChange: number;
  imageUrl: string;
  subscribers: number;
  views: number;
  likes: number;
  tokenAddress: string;
  channelUrl: string;
  videoCount: number;
  region: string;
  engagementScore: number;
  category: string;
  hasToken: boolean;
  lastUpdated: string;
}

/**
 * Fetch trending creators from the API
 * @param region Optional region filter (default: 'US')
 * @param timeframe Optional timeframe filter (default: '24h')
 * @returns Promise with array of creators
 */
export const fetchTrendingCreators = async (
  region: string = 'US',
  timeframe: string = '24h'
): Promise<Creator[]> => {
  try {
    console.log(`Fetching trending creators from ${API_URL}/api/trending-creators?region=${region}&timeframe=${timeframe}`);
    
    const response = await axios.get(`${API_URL}/api/trending-creators`, {
      params: {
        region,
        timeframe
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching trending creators:', error);
    return [];
  }
};

/**
 * Fetch creator details by ID
 * @param creatorId The creator ID to fetch
 * @returns Promise with creator details
 */
export const fetchCreatorById = async (creatorId: string): Promise<Creator | null> => {
  try {
    const response = await axios.get(`${API_URL}/api/creators/${creatorId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching creator ${creatorId}:`, error);
    return null;
  }
};

/**
 * Fetch creators by region
 * @param region The region to filter by
 * @returns Promise with array of creators
 */
export const fetchCreatorsByRegion = async (region: string): Promise<Creator[]> => {
  try {
    const response = await axios.get(`${API_URL}/api/trending-creators`, {
      params: {
        region,
        timeframe: 'all'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching creators for region ${region}:`, error);
    return [];
  }
};

export default {
  fetchTrendingCreators,
  fetchCreatorById,
  fetchCreatorsByRegion
}; 