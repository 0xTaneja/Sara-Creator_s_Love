import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { API_URL } from '../config';

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
];

const TokenDetailsPage: React.FC = () => {
  const { tokenId } = useParams<{ tokenId: string }>();
  const { isConnected } = useWeb3();
  const [token, setToken] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [swapAmount, setSwapAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('0');
  const [error, setError] = useState<string | null>(null);

  // Fetch token data from API
  useEffect(() => {
    const fetchTokenData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/api/tokens/${tokenId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Token not found');
          } else {
            setError('Failed to fetch token data');
          }
          setToken(null);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        setToken(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching token data:', err);
        setError('Failed to connect to the server');
        setToken(null);
        setIsLoading(false);
        
        // Fallback to mock data for development
        if (process.env.NODE_ENV === 'development') {
          const foundToken = mockCreatorTokens.find(t => t.id === tokenId);
          if (foundToken) {
            setToken(foundToken);
            setError(null);
          }
        }
      }
    };

    fetchTokenData();
  }, [tokenId]);

  // Simulate calculating receive amount
  const handleSwapAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSwapAmount(value);
    
    if (value && !isNaN(parseFloat(value)) && token) {
      const amount = parseFloat(value);
      const receive = (amount / token.price).toFixed(6);
      setReceiveAmount(receive);
    } else {
      setReceiveAmount('0');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Token Not Found</h2>
        <p className="text-gray-600 mb-6">The token you're looking for doesn't exist or hasn't been indexed yet.</p>
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Token Info */}
      <div className="lg:col-span-2 space-y-6">
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
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
                  token.priceChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
                </span>
                <a 
                  href={token.channelUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-coral-DEFAULT hover:text-coral-dark"
                >
                  Visit YouTube Channel
                </a>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Price</p>
              <p className="text-xl font-medium text-gray-900">${token.price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Market Cap</p>
              <p className="text-xl font-medium text-gray-900">{token.marketCap}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">24h Volume</p>
              <p className="text-xl font-medium text-gray-900">{token.volume24h}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Holders</p>
              <p className="text-xl font-medium text-gray-900">{token.holders}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">About {token.name}</h3>
            <p className="text-gray-600">{token.description}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Engagement Metrics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500 mb-1">Subscribers</p>
              <p className="text-xl font-medium text-gray-900">{token.subscribers}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500 mb-1">Views</p>
              <p className="text-xl font-medium text-gray-900">{token.views}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-500 mb-1">Likes</p>
              <p className="text-xl font-medium text-gray-900">{token.likes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Token Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Token Address</span>
              <span className="text-gray-900 font-medium">{`${token.address.substring(0, 6)}...${token.address.substring(token.address.length - 4)}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Liquidity</span>
              <span className="text-gray-900 font-medium">{token.liquidity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Token Type</span>
              <span className="text-gray-900 font-medium">ERC-20</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Column - Swap Widget */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
          <h3 className="text-lg font-semibold mb-4">Trade {token.symbol}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">You Pay</label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  value={swapAmount}
                  onChange={handleSwapAmountChange}
                  className="input pr-12"
                  placeholder="0.0"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">CORAL</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="bg-gray-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">You Receive</label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  value={receiveAmount}
                  readOnly
                  className="input pr-16 bg-gray-50"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">{token.symbol}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              {isConnected ? (
                <Link 
                  to={`/swap?token=${token.id}`}
                  className="btn btn-primary w-full py-3"
                >
                  Swap Now
                </Link>
              ) : (
                <button className="btn btn-primary w-full py-3">
                  Connect Wallet
                </button>
              )}
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg mt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rate</span>
                <span className="text-gray-900">1 CORAL = {(1 / token.price).toFixed(6)} {token.symbol}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Fee</span>
                <span className="text-gray-900">0.3%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenDetailsPage; 