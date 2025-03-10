import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import CreatorTokenCard from '../components/CreatorTokenCard';
import HeroSection from '../components/HeroSection';
import { API_URL } from '../config';
import { Token } from '../utils/types';

// Mock data for creator tokens - same as in TokenDetailsPage
const mockCreatorTokens = [
  {
    id: '67c9b14b291a6d50d2b1727d', // MrBeast
    name: 'MrBeast',
    symbol: 'BEAST',
    price: 1.24,
    priceChange: 12.5,
    views: '5M',
    likes: '300K',
    subscribers: '250M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x1234567890123456789012345678901234567890',
    channelUrl: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  },
  {
    id: '67c9b14b291a6d50d2b1726b', // MKBHD
    name: 'Marques Brownlee',
    symbol: 'MKBHD',
    price: 0.87,
    priceChange: -2.1,
    views: '1.2M',
    likes: '100K',
    subscribers: '18M',
    imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x2345678901234567890123456789012345678901',
    channelUrl: 'https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ',
  },
  {
    id: '67c9b14b291a6d50d2b1725b', // PewDiePie
    name: 'PewDiePie',
    symbol: 'PEWDS',
    price: 1.05,
    priceChange: 5.3,
    views: '3.5M',
    likes: '250K',
    subscribers: '111M',
    imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    address: '0x3456789012345678901234567890123456789012',
    channelUrl: 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw',
  },
  {
    id: '67c9b14b291a6d50d2b1724b', // Logan Paul
    name: 'Logan Paul',
    symbol: 'LOGAN',
    price: 0.65,
    priceChange: -1.2,
    views: '2.1M',
    likes: '150K',
    subscribers: '23M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    address: '0x4567890123456789012345678901234567890123',
    channelUrl: 'https://www.youtube.com/channel/UCG8rbF3g2AMX70yOd8vqIZg',
  },
  {
    id: '67c9b14b291a6d50d2b1723b', // KSI
    name: 'KSI',
    symbol: 'KSI',
    price: 0.92,
    priceChange: 3.7,
    views: '2.8M',
    likes: '180K',
    subscribers: '24M',
    imageUrl: 'https://yt3.googleusercontent.com/zSgb9auUHE_rAkWLmxqRQPGzGHJBYS7J1-Jjk9RTBTJZlYwLqGQmY5yMZ5KmeYlOTvEFYUTjGQ=s176-c-k-c0x00ffffff-no-rj',
    address: '0x5678901234567890123456789012345678901234',
    channelUrl: 'https://www.youtube.com/channel/UCVtFOytbRpEvzLjvqGG5gxQ',
  }
];

const HomePage: React.FC = () => {
  const { isConnected } = useWeb3();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tokens from API - using the same approach as DashboardPage
  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch tokens from the same endpoint that works in DashboardPage
        console.log(`Fetching tokens from ${API_URL}/api/tokens`);
        const response = await fetch(`${API_URL}/api/tokens`);
        
        if (!response.ok) {
          console.error(`Failed to fetch tokens (status: ${response.status})`);
          // Fallback to mock data
          console.log('Using mock data as fallback');
          setTokens(mockCreatorTokens);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        console.log('Fetched tokens:', data);
        
        if (data && Array.isArray(data) && data.length > 0) {
          // Format the data for display - same approach as DashboardPage
          const formattedTokens = data.map((token: any) => ({
            ...token,
            // Format numbers for display
            views: typeof token.views === 'number' ? formatNumber(token.views) : token.views,
            subscribers: typeof token.subscribers === 'number' ? formatNumber(token.subscribers) : token.subscribers,
            likes: typeof token.likes === 'number' ? formatNumber(token.likes) : token.likes || '0',
            // Ensure we have the address field for compatibility
            address: token.tokenAddress || token.address || '',
          }));
          
          setTokens(formattedTokens);
        } else {
          // Fallback to mock data if no tokens found
          setTokens(mockCreatorTokens);
        }
      } catch (err) {
        console.error('Error fetching tokens:', err);
        // Fallback to mock data
        console.log('Using mock data as fallback due to error');
        setTokens(mockCreatorTokens);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, []);

  // Format large numbers to K/M format
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="space-y-10">
      <HeroSection />
      
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">All Creators</h2>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-red-500">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tokens.map((token) => (
              <div key={token.id} className="h-full">
                <CreatorTokenCard 
                  token={token} 
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage; 