import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { API_URL } from '../config';
import TradingViewChart from '../components/TradingViewChart';
import CreatorInsights from '../components/CreatorInsights';
import TokenSwap from '../components/TokenSwap';
import TradeHistory from '../components/TradeHistory';
import usePriceChange from '../hooks/usePriceChange';

// Mock data for creator tokens
const mockCreatorTokens = [
  {
    id: '1',
    name: 'MrBeast',
    symbol: 'BEAST',
    price: 1.24,
    priceChange: 12.5,
    views: '5M',
    likes: '300K',
    subscribers: '250M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x1234567890123456789012345678901234567890',
    description: 'MrBeast is known for his expensive stunts and philanthropy. His content includes challenges, donations, and competitions with large cash prizes.',
    channelUrl: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
    marketCap: '$12.4M',
    volume24h: '$1.2M',
    liquidity: '$2.5M',
    holders: '1,250',
  },
  {
    id: '2',
    name: 'Marques Brownlee',
    symbol: 'MKBHD',
    price: 0.87,
    priceChange: -2.1,
    views: '1.2M',
    likes: '100K',
    subscribers: '18M',
    imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x2345678901234567890123456789012345678901',
    description: 'Marques Brownlee, also known as MKBHD, is a technology reviewer focusing on smartphones, laptops, and other consumer electronics.',
    channelUrl: 'https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ',
    marketCap: '$8.7M',
    volume24h: '$750K',
    liquidity: '$1.8M',
    holders: '950',
  },
  {
    id: '3',
    name: 'PewDiePie',
    symbol: 'PEWDS',
    price: 1.05,
    priceChange: 5.3,
    views: '3.5M',
    likes: '250K',
    subscribers: '111M',
    imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    address: '0x3456789012345678901234567890123456789012',
    description: 'PewDiePie is one of the most subscribed individual creators on YouTube, known for his gaming content, commentary, and comedy videos.',
    channelUrl: 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw',
    marketCap: '$10.5M',
    volume24h: '$950K',
    liquidity: '$2.1M',
    holders: '1,100',
  },
  {
    id: '4',
    name: 'Logan Paul',
    symbol: 'LOGAN',
    price: 0.65,
    priceChange: -1.2,
    views: '2.1M',
    likes: '150K',
    subscribers: '23M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    address: '0x4567890123456789012345678901234567890123',
    description: 'Logan Paul is a content creator, boxer, and entrepreneur known for his vlogs, podcasts, and various business ventures.',
    channelUrl: 'https://www.youtube.com/channel/UCG8rbF3g2AMX70yOd8vqIZg',
    marketCap: '$6.5M',
    volume24h: '$550K',
    liquidity: '$1.3M',
    holders: '850',
  },
  {
    id: '5',
    name: 'KSI',
    symbol: 'KSI',
    price: 0.92,
    priceChange: 3.7,
    views: '2.8M',
    likes: '180K',
    subscribers: '24M',
    imageUrl: 'https://yt3.googleusercontent.com/zSgb9auUHE_rAkWLmxqRQPGzGHJBYS7J1-Jjk9RTBTJZlYwLqGQmY5yMZ5KmeYlOTvEFYUTjGQ=s176-c-k-c0x00ffffff-no-rj',
    address: '0x5678901234567890123456789012345678901234',
    description: 'KSI is a rapper, boxer, and content creator known for his music, gaming videos, and comedy sketches.',
    channelUrl: 'https://www.youtube.com/channel/UCVtFOytbRpEvzLjvqGG5gxQ',
    marketCap: '$9.2M',
    volume24h: '$820K',
    liquidity: '$1.9M',
    holders: '980',
  },
  {
    id: '6',
    name: 'Linus Tech Tips',
    symbol: 'LTT',
    price: 0.78,
    priceChange: 2.3,
    views: '1.9M',
    likes: '120K',
    subscribers: '15M',
    imageUrl: 'https://yt3.googleusercontent.com/Vy6KL7EM_apxPSxF0pPy5w_c87YDTOlBQo3MADDF0Wl78QjuM7JdNRTG8PVLWbXKQmqJoEd-=s176-c-k-c0x00ffffff-no-rj',
    address: '0x6789012345678901234567890123456789012345',
    description: 'Linus Tech Tips is a technology channel that creates videos about hardware, software, and tech news.',
    channelUrl: 'https://www.youtube.com/channel/UCXuqSBlHAE6Xw-yeJA0Tunw',
    marketCap: '$7.8M',
    volume24h: '$680K',
    liquidity: '$1.6M',
    holders: '920',
  },
  // Add the mapped token IDs for each creator
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
    description: 'MrBeast is known for his expensive stunts and philanthropy. His content includes challenges, donations, and competitions with large cash prizes.',
    channelUrl: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
    marketCap: '$12.4M',
    volume24h: '$1.2M',
    liquidity: '$2.5M',
    holders: '1,250',
    videoCount: 450,
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
    description: 'Marques Brownlee, also known as MKBHD, is a technology reviewer focusing on smartphones, laptops, and other consumer electronics.',
    channelUrl: 'https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ',
    marketCap: '$8.7M',
    volume24h: '$750K',
    liquidity: '$1.8M',
    holders: '950',
    videoCount: 380,
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
    description: 'PewDiePie is one of the most subscribed individual creators on YouTube, known for his gaming content, commentary, and comedy videos.',
    channelUrl: 'https://www.youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw',
    marketCap: '$10.5M',
    volume24h: '$950K',
    liquidity: '$2.1M',
    holders: '1,100',
    videoCount: 520,
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
    description: 'Logan Paul is a content creator, boxer, and entrepreneur known for his vlogs, podcasts, and various business ventures.',
    channelUrl: 'https://www.youtube.com/channel/UCG8rbF3g2AMX70yOd8vqIZg',
    marketCap: '$6.5M',
    volume24h: '$550K',
    liquidity: '$1.3M',
    holders: '850',
    videoCount: 320,
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
    description: 'KSI is a rapper, boxer, and content creator known for his music, gaming videos, and comedy sketches.',
    channelUrl: 'https://www.youtube.com/channel/UCVtFOytbRpEvzLjvqGG5gxQ',
    marketCap: '$9.2M',
    volume24h: '$820K',
    liquidity: '$1.9M',
    holders: '980',
    videoCount: 410,
  },
  {
    id: '67c9b14b291a6d50d2b1722b', // Linus Tech Tips
    name: 'Linus Tech Tips',
    symbol: 'LTT',
    price: 0.78,
    priceChange: 2.3,
    views: '1.9M',
    likes: '120K',
    subscribers: '15M',
    imageUrl: 'https://yt3.googleusercontent.com/Vy6KL7EM_apxPSxF0pPy5w_c87YDTOlBQo3MADDF0Wl78QjuM7JdNRTG8PVLWbXKQmqJoEd-=s176-c-k-c0x00ffffff-no-rj',
    address: '0x6789012345678901234567890123456789012345',
    description: 'Linus Tech Tips is a technology channel that creates videos about hardware, software, and tech news.',
    channelUrl: 'https://www.youtube.com/channel/UCXuqSBlHAE6Xw-yeJA0Tunw',
    marketCap: '$7.8M',
    volume24h: '$680K',
    liquidity: '$1.6M',
    holders: '920',
    videoCount: 350,
  }
];

// Add price change display component
const PriceChangeDisplay = ({ priceChange }: { priceChange: number | null }) => {
  // If price change is null, show loading indicator
  if (priceChange === null) {
    return (
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Calculating...
      </div>
    );
  }
  
  // Handle NaN or invalid values
  if (isNaN(priceChange)) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        0.00%
      </span>
    );
  }
  
  // Round to 2 decimal places, ensuring we get a valid number
  const roundedChange = isNaN(priceChange) ? 0 : Math.round(priceChange * 100) / 100;
  
  // If change is very small (between -0.01 and 0.01), show as 0.00%
  if (Math.abs(roundedChange) < 0.01) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        0.00%
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
      roundedChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {roundedChange >= 0 ? '+' : ''}{roundedChange.toFixed(2)}%
    </span>
  );
};

const TokenDetailsPage: React.FC = () => {
  const { tokenId } = useParams<{ tokenId: string }>();
  const { isConnected } = useWeb3();
  const [token, setToken] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add this line to use our price change hook
  const { priceChange } = usePriceChange(token?.tokenAddress || token?.address);

  // Fetch token data from API
  useEffect(() => {
    const fetchTokenData = async () => {
      if (!tokenId) {
        setError('Invalid token ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching token data from ${API_URL}/api/tokens/${tokenId}`);
        
        // Try to fetch from the API first
        let response = await fetch(`${API_URL}/api/tokens/${tokenId}`);
        
        // If not found, try the mock data
        if (!response.ok) {
          console.log(`API request failed with status ${response.status}, using mock data`);
          
          // Find the token in mock data
          const foundToken = mockCreatorTokens.find(t => t.id === tokenId);
          
          if (foundToken) {
            // Convert string values to numbers for the mock data
            const processedToken = {
              ...foundToken,
              marketCap: parseFloat(foundToken.marketCap.replace(/[^0-9.]/g, '')),
              volume24h: parseFloat(foundToken.volume24h.replace(/[^0-9.]/g, '')),
              liquidity: parseFloat(foundToken.liquidity.replace(/[^0-9.]/g, '')),
              holders: parseInt(foundToken.holders.replace(/,/g, '')),
              subscribers: parseFloat(foundToken.subscribers.replace(/M/g, '')) * 1000000,
              views: parseFloat(foundToken.views.replace(/M/g, '')) * 1000000,
              likes: parseFloat(foundToken.likes.replace(/K/g, '')) * 1000,
              videoCount: Math.floor(Math.random() * 500) + 100, // Random video count for mock data
            };
            setToken(processedToken);
            setIsLoading(false);
            return;
          } else {
            // If not found in mock data either, show error
            if (response.status === 404) {
              setError('Token not found');
            } else {
              setError(`Failed to fetch token data: ${response.status}`);
            }
            setToken(null);
            setIsLoading(false);
            return;
          }
        }
        
        if (response.ok) {
          const data = await response.json();
          console.log("Fetched token data:", data);
          
          if (data) {
            setToken(data);
          } else {
            setToken(null);
          }
        } else {
          setError('Failed to fetch token data');
          setToken(null);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching token data:', err);
        setError('Failed to connect to the server');
        
        // Always try to use mock data as fallback
        const foundToken = mockCreatorTokens.find(t => t.id === tokenId);
        if (foundToken) {
          console.log('Using mock data as fallback');
          // Convert string values to numbers for the mock data
          const processedToken = {
            ...foundToken,
            marketCap: parseFloat(foundToken.marketCap.replace(/[^0-9.]/g, '')),
            volume24h: parseFloat(foundToken.volume24h.replace(/[^0-9.]/g, '')),
            liquidity: parseFloat(foundToken.liquidity.replace(/[^0-9.]/g, '')),
            holders: parseInt(foundToken.holders.replace(/,/g, '')),
            subscribers: parseFloat(foundToken.subscribers.replace(/M/g, '')) * 1000000,
            views: parseFloat(foundToken.views.replace(/M/g, '')) * 1000000,
            likes: parseFloat(foundToken.likes.replace(/K/g, '')) * 1000,
            videoCount: Math.floor(Math.random() * 500) + 100, // Random video count for mock data
          };
          setToken(processedToken);
          setError(null);
        } else {
          setToken(null);
        }
        setIsLoading(false);
      }
    };

    fetchTokenData();
  }, [tokenId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6 text-center">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error === 'Token not found' ? 'Token Not Found' : 'Error Loading Token'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error === 'Token not found' 
              ? "We couldn't find the token you're looking for. It may have been removed or doesn't exist."
              : `There was a problem loading this token: ${error}`
            }
          </p>
          <div className="flex flex-col space-y-4">
            <Link to="/" className="btn btn-primary">
              Go to Homepage
            </Link>
            <button 
              onClick={() => window.history.back()} 
              className="text-coral-DEFAULT hover:text-coral-dark font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Creator Info and Stats */}
      <div className="lg:col-span-2 space-y-6">
        {/* Token Header */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <img 
              src={token.imageUrl} 
              alt={token.name} 
              className="w-16 h-16 rounded-full mr-4"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{token.name} (${token.symbol})</h1>
              <div className="flex items-center mt-1">
                <PriceChangeDisplay priceChange={priceChange} />
                <a 
                  href={token.channelUrl || `https://www.youtube.com/channel/${token.channelId || token.id}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-coral-DEFAULT hover:text-coral-dark flex items-center mr-3"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube Channel
                </a>
              </div>
              
              {/* Price and Contract Address */}
              <div className="mt-3 text-sm text-gray-600">
                <div className="flex items-center mb-1">
                  <span className="font-medium mr-2">Current Price:</span>
                  <span className="text-gray-800">${token.price?.toFixed(6) || '0.00'}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-2">Contract Address:</span>
                  <span className="text-gray-800 font-mono text-xs break-all">
                    {token.tokenAddress || token.address || 'Not available'}
                  </span>
                  {(token.tokenAddress || token.address) && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(token.tokenAddress || token.address);
                        alert('Contract address copied to clipboard!');
                      }}
                      className="ml-2 text-coral-DEFAULT hover:text-coral-dark"
                      title="Copy to clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">About {token.name}</h3>
            <p className="text-gray-600">{token.description}</p>
          </div>
        </div>
        
        {/* Price Chart */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Price Chart</h2>
          <TradingViewChart 
            tokenId={token.id} 
            tokenAddress={token.tokenAddress || token.address} 
            height={350} 
          />
          <div className="text-xs text-gray-500 mt-2">
            Chart data is fetched directly from blockchain events
          </div>
        </div>
        
        {/* Creator Insights */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Creator Insights</h3>
          <CreatorInsights token={token} />
        </div>
      </div>
      
      {/* Right Column - Swap Widget and Trade History */}
      <div className="space-y-6">
        {/* Swap Widget */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Trade</h2>
          <TokenSwap token={token} />
        </div>

        {/* Trade History */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Trade History</h2>
          <TradeHistory tokenAddress={token.tokenAddress || token.address} />
        </div>
      </div>
    </div>
  );
};

export default TokenDetailsPage; 