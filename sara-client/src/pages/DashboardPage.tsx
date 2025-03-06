import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { useLoading } from '../contexts/LoadingContext';
import TrendingTokens from '../components/TrendingTokens';
import TopCreators from '../components/TopCreators';
import { Token } from '../utils/types';
import axios from 'axios';
import { API_URL } from '../config';
import { fetchTrendingCreators, Creator as CreatorType } from '../api/creatorApi';

// Mock data for creator tokens
const mockCreatorTokens = [
  {
    id: '1',
    channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA', // MrBeast's actual channel ID
    name: 'MrBeast',
    symbol: 'BEAST',
    price: 1.24,
    priceChange: 12.5,
    views: '5M',
    likes: '300K',
    subscribers: '250M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x1234567890123456789012345678901234567890',
  },
  {
    id: '2',
    channelId: 'UCBJycsmduvYEL83R_U4JriQ', // MKBHD's actual channel ID
    name: 'Marques Brownlee',
    symbol: 'MKBHD',
    price: 0.87,
    priceChange: -2.1,
    views: '1.2M',
    likes: '100K',
    subscribers: '18M',
    imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x2345678901234567890123456789012345678901',
  },
  {
    id: '3',
    channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', // PewDiePie's actual channel ID
    name: 'PewDiePie',
    symbol: 'PEWDS',
    price: 1.05,
    priceChange: 5.3,
    views: '3.5M',
    likes: '250K',
    subscribers: '111M',
    imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    address: '0x3456789012345678901234567890123456789012',
  },
  {
    id: '4',
    channelId: 'UCG8rbF3g2AMX70yOd8vqIZg', // Logan Paul's actual channel ID
    name: 'Logan Paul',
    symbol: 'LOGAN',
    price: 0.65,
    priceChange: -1.2,
    views: '2.1M',
    likes: '150K',
    subscribers: '23M',
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    address: '0x4567890123456789012345678901234567890123',
  },
  {
    id: '5',
    channelId: 'UCVtFOytbRpEvzLjvqGG5gxQ', // KSI's actual channel ID
    name: 'KSI',
    symbol: 'KSI',
    price: 0.92,
    priceChange: 3.7,
    views: '2.8M',
    likes: '180K',
    subscribers: '24M',
    imageUrl: 'https://yt3.googleusercontent.com/zSgb9auUHE_rAkWLmxqRQPGzGHJBYS7J1-Jjk9RTBTJZlYwLqGQmY5yMZ5KmeYlOTvEFYUTjGQ=s176-c-k-c0x00ffffff-no-rj',
    address: '0x5678901234567890123456789012345678901234',
  },
  {
    id: '6',
    channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw', // Linus Tech Tips' actual channel ID
    name: 'Linus Tech Tips',
    symbol: 'LTT',
    price: 0.78,
    priceChange: 2.3,
    views: '1.9M',
    likes: '120K',
    subscribers: '15M',
    imageUrl: 'https://yt3.googleusercontent.com/Vy6KL7EM_apxPSxF0pPy5w_c87YDTOlBQo3MADDF0Wl78QjuM7JdNRTG8PVLWbXKQmqJoEd-=s176-c-k-c0x00ffffff-no-rj',
    address: '0x6789012345678901234567890123456789012345',
  },
];

// Mock data for recent activity
const mockRecentActivity = [
  {
    id: '1',
    type: 'swap',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    fromToken: {
      symbol: 'CORAL',
      amount: '100',
    },
    toToken: {
      symbol: 'BEAST',
      amount: '80.65',
    },
    status: 'success',
  },
  {
    id: '2',
    type: 'swap',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    fromToken: {
      symbol: 'CORAL',
      amount: '50',
    },
    toToken: {
      symbol: 'MKBHD',
      amount: '57.47',
    },
    status: 'success',
  },
  {
    id: '3',
    type: 'approve',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    fromToken: {
      symbol: 'CORAL',
      amount: '1000',
    },
    toToken: {
      symbol: '',
      amount: '',
    },
    status: 'success',
  },
  {
    id: '4',
    type: 'swap',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    fromToken: {
      symbol: 'PEWDS',
      amount: '30',
    },
    toToken: {
      symbol: 'CORAL',
      amount: '28.57',
    },
    status: 'success',
  },
  {
    id: '5',
    type: 'swap',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    fromToken: {
      symbol: 'CORAL',
      amount: '200',
    },
    toToken: {
      symbol: 'KSI',
      amount: '217.39',
    },
    status: 'success',
  },
];

// Mock market stats
const mockMarketStats = {
  totalMarketCap: '$24.5M',
  totalVolume24h: '$3.2M',
  totalCreatorTokens: '42',
  activeTraders: '1,250',
  priceChange24h: 8.5,
  totalLiquidity: '$12.8M',
  totalTrades24h: '3,456',
  averageTradeSize: '$925',
};

// Trading steps
const tradingSteps = [
  {
    title: "Connect Your Wallet",
    description: "Click the 'Connect Wallet' button in the top right corner to connect your Ethereum wallet.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-coral-DEFAULT" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    title: "Select a Creator Token",
    description: "Browse trending creator tokens and choose one you'd like to trade.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-coral-DEFAULT" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )
  },
  {
    title: "Swap CORAL for Creator Tokens",
    description: "Use the swap interface to exchange CORAL tokens for creator tokens.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-coral-DEFAULT" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  },
  {
    title: "Monitor Your Portfolio",
    description: "Track your token performance and creator engagement metrics.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-coral-DEFAULT" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  }
];

const DashboardPage: React.FC = () => {
  const [trendingTokens, setTrendingTokens] = useState<Token[]>([]);
  const [trendingCreators, setTrendingCreators] = useState<CreatorType[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState<boolean>(true);
  const [isLoadingCreators, setIsLoadingCreators] = useState<boolean>(true);
  const { account, connectWallet } = useWeb3();
  const [timeRange, setTimeRange] = useState('1d');
  const [recentActivity, setRecentActivity] = useState(mockRecentActivity);
  const [marketStats, setMarketStats] = useState(mockMarketStats);
  const [error, setError] = useState<string | null>(null);
  const { setIsLoading } = useLoading();

  // Fetch tokens from API
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setIsLoadingTokens(true);
        
        console.log(`Fetching tokens from ${API_URL}/api/tokens`);
        let response = await fetch(`${API_URL}/api/tokens`);
        
        if (!response.ok) {
          console.error(`Failed to fetch tokens (status: ${response.status})`);
          setError('Failed to load tokens');
          setIsLoadingTokens(false);
          return;
        }
        
        const data = await response.json();
        console.log('Fetched tokens:', data);
        
        // Format the data for display
        const formattedTokens = data.map((token: any) => ({
          ...token,
          // Format numbers for display
          views: typeof token.views === 'number' ? formatNumber(token.views) : token.views,
          subscribers: typeof token.subscribers === 'number' ? formatNumber(token.subscribers) : token.subscribers,
          // Ensure we have the address field for compatibility
          address: token.tokenAddress || token.address || '',
        }));
        
        setTrendingTokens(formattedTokens);
        setIsLoadingTokens(false);
      } catch (err) {
        console.error('Error fetching tokens:', err);
        // Fallback to mock data
        console.log('Using mock data as fallback');
        setTrendingTokens(mockCreatorTokens);
        setIsLoadingTokens(false);
      }
    };

    // Fetch trending creators using our new API client
    const loadTrendingCreators = async () => {
      try {
        setIsLoadingCreators(true);
        
        // Fetch trending US creators with 24h timeframe
        const creators = await fetchTrendingCreators('US', '24h');
        console.log('Fetched trending creators:', creators);
        
        if (creators.length > 0) {
          setTrendingCreators(creators);
        } else {
          // Create mock data for trending creators if API returns empty
          const mockCreators = mockCreatorTokens.map(token => ({
            id: token.id,
            channelId: token.id,
            name: token.name,
            symbol: token.symbol,
            price: token.price,
            priceChange: token.priceChange,
            imageUrl: token.imageUrl,
            subscribers: typeof token.subscribers === 'number' ? token.subscribers : parseInt(token.subscribers.replace(/[KM]/g, '')),
            views: typeof token.views === 'number' ? token.views : parseInt(token.views.replace(/[KM]/g, '')),
            likes: 0,
            tokenAddress: token.address,
            channelUrl: `https://youtube.com/channel/${token.channelId || token.id}`,
            videoCount: 0,
            region: 'US',
            engagementScore: Math.random() * 10,
            category: '',
            hasToken: true,
            lastUpdated: new Date().toISOString()
          }));
          setTrendingCreators(mockCreators);
        }
        
        setIsLoadingCreators(false);
      } catch (err) {
        console.error('Error fetching trending creators:', err);
        // Fallback to mock data
        const mockCreators = mockCreatorTokens.map(token => ({
          id: token.id,
          channelId: token.id,
          name: token.name,
          symbol: token.symbol,
          price: token.price,
          priceChange: token.priceChange,
          imageUrl: token.imageUrl,
          subscribers: typeof token.subscribers === 'number' ? token.subscribers : parseInt(token.subscribers.replace(/[KM]/g, '')),
          views: typeof token.views === 'number' ? token.views : parseInt(token.views.replace(/[KM]/g, '')),
          likes: 0,
          tokenAddress: token.address,
          channelUrl: `https://youtube.com/channel/${token.channelId || token.id}`,
          videoCount: 0,
          region: 'US',
          engagementScore: Math.random() * 10,
          category: '',
          hasToken: true,
          lastUpdated: new Date().toISOString()
        }));
        setTrendingCreators(mockCreators);
        setIsLoadingCreators(false);
      }
    };

    setIsLoading(true);
    
    const loadData = async () => {
      await Promise.all([
        fetchTokens(),
        loadTrendingCreators(),
        // Add other data loading functions here
      ]);
      
      setIsLoading(false);
    };
    
    loadData();
  }, [setIsLoading]);

  // Format large numbers to K/M format
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Update time range
  const updateTimeRange = (range: string) => {
    setTimeRange(range);
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }
  };

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'swap':
        return (
          <div className="rounded-full bg-green-100 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        );
      case 'approve':
        return (
          <div className="rounded-full bg-blue-100 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="rounded-full bg-gray-100 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-coral-light to-coral-DEFAULT rounded-xl shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          {account ? `Welcome back, ${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Welcome to Sara AI'}
        </h1>
        <p className="text-white opacity-90 mb-4">
          Your AI-powered platform for creator token trading and insights
        </p>
        {!account && (
          <Link to="/swap" className="bg-white text-coral-DEFAULT hover:bg-gray-100 font-medium py-2 px-4 rounded-lg inline-block transition duration-150">
            Start Trading
          </Link>
        )}
      </div>

      {/* Market Overview */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Market Overview</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => updateTimeRange('1d')}
              className={`px-3 py-1 text-sm rounded-md ${timeRange === '1d' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              1D
            </button>
            <button 
              onClick={() => updateTimeRange('1w')}
              className={`px-3 py-1 text-sm rounded-md ${timeRange === '1w' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              1W
            </button>
            <button 
              onClick={() => updateTimeRange('1m')}
              className={`px-3 py-1 text-sm rounded-md ${timeRange === '1m' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              1M
            </button>
            <button 
              onClick={() => updateTimeRange('all')}
              className={`px-3 py-1 text-sm rounded-md ${timeRange === 'all' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Total Market Cap</p>
            <p className="text-xl font-bold text-coral-DEFAULT">{marketStats.totalMarketCap}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">24h Volume</p>
            <p className="text-xl font-bold text-coral-DEFAULT">{marketStats.totalVolume24h}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Creator Tokens</p>
            <p className="text-xl font-bold text-coral-DEFAULT">{marketStats.totalCreatorTokens}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Active Traders</p>
            <p className="text-xl font-bold text-coral-DEFAULT">{marketStats.activeTraders}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-2 ${
              marketStats.priceChange24h >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {marketStats.priceChange24h >= 0 ? '+' : ''}{marketStats.priceChange24h}%
            </span>
            <span className="text-sm text-gray-500">24h Change</span>
          </div>
          <Link to="/swap" className="text-coral-DEFAULT hover:text-coral-dark text-sm font-medium">
            View All Markets →
          </Link>
        </div>
      </div>

      {/* Top US Creators (24h) */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Top US Creators (24h)</h2>
          <Link to="/creators" className="text-coral-DEFAULT hover:text-coral-dark text-sm font-medium">
            View All →
          </Link>
        </div>
        
        <TopCreators creators={trendingCreators} isLoading={isLoadingCreators} />
      </div>

      {/* Trending Creator Tokens */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Trending Creator Tokens</h2>
          <Link to="/swap" className="text-coral-DEFAULT hover:text-coral-dark text-sm font-medium">
            View All →
          </Link>
        </div>
        
        {isLoadingTokens ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
          </div>
        ) : (
          <TrendingTokens tokens={trendingTokens} />
        )}
      </div>

      {/* How to Trade */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">How to Trade Creator Tokens</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tradingSteps.map((step, index) => (
            <div key={index} className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center justify-center mb-4">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{step.title}</h3>
              <p className="text-gray-600 text-center">{step.description}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <Link 
            to="/swap" 
            className="bg-coral-DEFAULT hover:bg-coral-dark text-white font-medium py-2 px-6 rounded-lg inline-block transition duration-150"
          >
            Start Trading Now
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
        
        {isLoadingTokens ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-coral-DEFAULT"></div>
          </div>
        ) : recentActivity.length > 0 ? (
          <div className="mt-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center py-3 border-b border-gray-100 last:border-0">
                {getActivityIcon(activity.type)}
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.type === 'swap' ? (
                      <>Swapped {activity.fromToken.amount} {activity.fromToken.symbol} for {activity.toToken.amount} {activity.toToken.symbol}</>
                    ) : activity.type === 'approve' ? (
                      <>Approved {activity.fromToken.amount} {activity.fromToken.symbol}</>
                    ) : (
                      <>Unknown transaction</>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(activity.timestamp)}</p>
                </div>
                <div className={`text-xs font-medium ${
                  activity.status === 'success' ? 'text-green-600' : 
                  activity.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity</p>
            {!account && (
              <button className="mt-4 bg-coral-DEFAULT hover:bg-coral-dark text-white font-medium py-2 px-4 rounded-lg">
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage; 