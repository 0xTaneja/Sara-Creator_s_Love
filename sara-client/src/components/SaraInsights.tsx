import React, { useState, useEffect, useCallback } from 'react';
import { getSwapEvents } from '../utils/db';

// Types for Sara's insights
interface SaraInsight {
  id: string;
  type: 'prediction' | 'market' | 'engagement' | 'alert';
  content: string;
  timestamp: string;
  token?: {
    symbol: string;
    name: string;
    imageUrl: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  tradingSignal: 'buy' | 'sell' | 'watch';
  impactLevel: 'low' | 'medium' | 'high';
}

// Token performance interface
interface TokenPerformance {
  symbol: string;
  name: string;
  imageUrl: string;
  priceChange: number; // Percentage
  volume: number;
  lastPrice: number;
}

// Mock data for Sara's insights
const mockInsights: SaraInsight[] = [
  {
    id: '1',
    type: 'prediction',
    content: 'Based on recent engagement metrics, $PEWDS likely to see 5-8% upside in next 24h. 🔮',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    token: {
      symbol: 'PEWDS',
      name: 'PewDiePie',
      imageUrl: 'https://yt3.googleusercontent.com/vik8mAiwHQbXiFyKfZ3__p55_VBdGvwxPpuPJBBwdbF0PjJxikXhrP-C3nLQAMAxGNd_-xQCIg=s160-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'positive',
    confidence: 0.87,
    tradingSignal: 'buy',
    impactLevel: 'high',
  },
  {
    id: '2',
    type: 'market',
    content: 'Volume spike detected for $PEWDS. 3x average daily volume in the last hour. 📊',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    token: {
      symbol: 'PEWDS',
      name: 'PewDiePie',
      imageUrl: 'https://yt3.googleusercontent.com/vik8mAiwHQbXiFyKfZ3__p55_VBdGvwxPpuPJBBwdbF0PjJxikXhrP-C3nLQAMAxGNd_-xQCIg=s160-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'neutral',
    confidence: 0.92,
    tradingSignal: 'watch',
    impactLevel: 'medium',
  },
  {
    id: '3',
    type: 'engagement',
    content: 'Engagement spike detected for $MKBHD! New video just dropped with 500K views in 1 hour. 🚀',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    token: {
      symbol: 'MKBHD',
      name: 'Marques Brownlee',
      imageUrl: 'https://yt3.googleusercontent.com/PEwQfVuhh5jO7_NDDufCq349q0W6MgZeYlgeMyW3OSRMxMx9W5yre5Fgbi4Bql56L1cPwoteOA=s160-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'positive',
    confidence: 0.78,
    tradingSignal: 'buy',
    impactLevel: 'high',
  },
  {
    id: '4',
    type: 'alert',
    content: 'Whale spotted: 10K $LOGAN traded in one go. What\'s cooking, fam? 👀',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    token: {
      symbol: 'LOGAN',
      name: 'Logan Paul',
      imageUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_ltcpgwsF77fVG5xlQpHtPczqs4j60VkUzbtBrDBP_8QFY=s160-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'neutral',
    confidence: 0.65,
    tradingSignal: 'watch',
    impactLevel: 'high',
  },
  {
    id: '5',
    type: 'prediction',
    content: 'Creator milestone: $MKBHD hit 18M subs—token is primed for a rally. 🧨',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 24 hours ago
    token: {
      symbol: 'MKBHD',
      name: 'Marques Brownlee',
      imageUrl: 'https://yt3.googleusercontent.com/PEwQfVuhh5jO7_NDDufCq349q0W6MgZeYlgeMyW3OSRMxMx9W5yre5Fgbi4Bql56L1cPwoteOA=s160-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'positive',
    confidence: 0.81,
    tradingSignal: 'buy',
    impactLevel: 'medium',
  },
  

];

// Placeholder token image URLs (replace with actual token images)
const tokenImageUrls: Record<string, string> = {
  'BEAST': 'https://i.imgur.com/QXSJjM4.jpeg', // MrBeast 
  'PEWDS': 'https://i.imgur.com/YCsmOHE.jpeg', // PewDiePie
  'LOGAN': 'https://i.imgur.com/e7xVrRB.jpeg', // Logan Paul
  'MKBHD': 'https://i.imgur.com/HvJWnZo.jpeg', // Marques Brownlee
  'PT': 'https://i.imgur.com/YpnlFTJ.jpeg' // PewTweets placeholder
};

// Analytics for trending tokens (will be generated dynamically)
const getTokenName = (symbol: string): string => {
  switch (symbol) {
    case 'BEAST': return 'MrBeast';
    case 'PEWDS': return 'PewDiePie';
    case 'LOGAN': return 'Logan Paul';
    case 'MKBHD': return 'Marques Brownlee';
    case 'PT': return 'PewTweets';
    default: return symbol;
  }
};

interface SaraInsightsProps {
  limit?: number;
  showTitle?: boolean;
  className?: string;
  defaultFilter?: string;
}

const SaraInsights: React.FC<SaraInsightsProps> = ({ 
  limit = 0, 
  showTitle = true,
  className = '',
  defaultFilter = 'all'
}) => {
  const [insights, setInsights] = useState<SaraInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(defaultFilter);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [savedInsights, setSavedInsights] = useState<string[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<TokenPerformance[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [showTrending, setShowTrending] = useState(true);

  // Filters for the insights
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'prediction', label: 'Predictions' },
    { id: 'market', label: 'Market' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'alert', label: 'Alerts' },
    { id: 'saved', label: 'Saved' },
    { id: 'trending', label: 'Trending' },
  ];

  // Generate trending tokens based on recent swap events
  const generateTrendingTokens = useCallback(async () => {
    try {
      // Get all unique tokens from the swap events
      const knownTokens = ['BEAST', 'PEWDS', 'LOGAN', 'MKBHD', 'PT']; // Example known tokens
      const tokenPerformance: TokenPerformance[] = [];

      for (const tokenSymbol of knownTokens) {
        try {
          // Simulate getting swap events for each token
          // In a real app, you would fetch this from a database or API
          const events = await getSwapEvents(tokenSymbol.toLowerCase(), 20);
          
          if (events.length > 0) {
            // Calculate price change
            // In this case we're simulating with random values
            const priceChange = Math.random() * 20 - 10; // Random value between -10% and +10%
            const volume = Math.floor(Math.random() * 10000); // Random volume
            const lastPrice = Math.random() * 10; // Random price

            tokenPerformance.push({
              symbol: tokenSymbol,
              name: getTokenName(tokenSymbol),
              imageUrl: tokenImageUrls[tokenSymbol] || '',
              priceChange,
              volume,
              lastPrice
            });
          }
        } catch (error) {
          console.error(`Error processing token ${tokenSymbol}:`, error);
        }
      }

      // Sort by absolute price change (highest movement first)
      tokenPerformance.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
      setTrendingTokens(tokenPerformance);
      
      // Generate new insights based on trending tokens
      const newInsights: SaraInsight[] = [];
      
      // Add insights for top gainers
      const gainers = tokenPerformance.filter(token => token.priceChange > 0)
                                      .sort((a, b) => b.priceChange - a.priceChange)
                                      .slice(0, 2);
                                      
      for (const gainer of gainers) {
        newInsights.push({
          id: `gain-${gainer.symbol}-${Date.now()}`,
          type: 'market',
          content: `$${gainer.symbol} is up ${gainer.priceChange.toFixed(2)}% today! Strong buying momentum detected. 🚀`,
          timestamp: new Date().toISOString(),
          token: {
            symbol: gainer.symbol,
            name: gainer.name,
            imageUrl: gainer.imageUrl
          },
          sentiment: 'positive',
          confidence: 0.85 + Math.random() * 0.15, // Random confidence between 0.85 and 1.0
          tradingSignal: 'buy',
          impactLevel: 'medium'
        });
      }
      
      // Add insights for top losers
      const losers = tokenPerformance.filter(token => token.priceChange < 0)
                                    .sort((a, b) => a.priceChange - b.priceChange)
                                    .slice(0, 2);
                                    
      for (const loser of losers) {
        newInsights.push({
          id: `loss-${loser.symbol}-${Date.now()}`,
          type: 'alert',
          content: `$${loser.symbol} down ${Math.abs(loser.priceChange).toFixed(2)}%. Temporary dip or trend reversal? 📉`,
          timestamp: new Date().toISOString(),
          token: {
            symbol: loser.symbol,
            name: loser.name,
            imageUrl: loser.imageUrl
          },
          sentiment: 'negative',
          confidence: 0.65 + Math.random() * 0.2, // Random confidence between 0.65 and 0.85
          tradingSignal: 'watch',
          impactLevel: 'high'
        });
      }
      
      // Add a random insight about volume
      const randomVolumeToken = tokenPerformance[Math.floor(Math.random() * tokenPerformance.length)];
      if (randomVolumeToken) {
        newInsights.push({
          id: `vol-${randomVolumeToken.symbol}-${Date.now()}`,
          type: 'market',
          content: `Unusual volume detected for $${randomVolumeToken.symbol} - ${randomVolumeToken.volume.toLocaleString()} tokens traded in the last 24h. 👀`,
          timestamp: new Date().toISOString(),
          token: {
            symbol: randomVolumeToken.symbol,
            name: randomVolumeToken.name,
            imageUrl: randomVolumeToken.imageUrl
          },
          sentiment: 'neutral',
          confidence: 0.75 + Math.random() * 0.2,
          tradingSignal: 'watch',
          impactLevel: 'medium'
        });
      }
      
      // Merge with existing mock insights but prioritize new ones
      const combinedInsights = [...newInsights, ...mockInsights];
      
      // Update last update time
      setLastUpdateTime(new Date());
      
      return combinedInsights;
    } catch (error) {
      console.error('Error generating trending tokens:', error);
      return mockInsights;
    }
  }, []);

  // Fetch insights on component mount and every 5 minutes
  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      
      try {
        // Generate trending tokens and insights
        const combinedInsights = await generateTrendingTokens();
        
        let filteredInsights = combinedInsights;
        
        // Apply type filter if not 'all', 'saved', or 'trending'
        if (activeFilter !== 'all' && activeFilter !== 'saved' && activeFilter !== 'trending') {
          filteredInsights = combinedInsights.filter(insight => insight.type === activeFilter);
        }
        
        // Filter saved insights
        if (activeFilter === 'saved') {
          filteredInsights = combinedInsights.filter(insight => savedInsights.includes(insight.id));
        }
        
        // Show trending tokens section if trending filter is active
        setShowTrending(activeFilter === 'trending' || activeFilter === 'all');
        
        // Apply limit if specified
        if (limit > 0) {
          filteredInsights = filteredInsights.slice(0, limit);
        }
        
        setInsights(filteredInsights);
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
    
    // Set up interval to refresh data every 5 minutes
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [limit, activeFilter, savedInsights, generateTrendingTokens]);

  // Format timestamp to relative time
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  // Get icon for insight type
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'prediction':
        return '🔮';
      case 'market':
        return '📊';
      case 'engagement':
        return '📈';
      case 'alert':
        return '🚨';
      default:
        return '💬';
    }
  };

  // Get background color for insight type
  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'prediction':
        return 'bg-purple-light bg-opacity-10 border-purple-light';
      case 'market':
        return 'bg-coral-light bg-opacity-10 border-coral-light';
      case 'engagement':
        return 'bg-green-100 border-green-300';
      case 'alert':
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  // Get color for sentiment badge
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get color for trading signal
  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'buy':
        return 'bg-green-500 text-white';
      case 'sell':
        return 'bg-red-500 text-white';
      default:
        return 'bg-yellow-500 text-white';
    }
  };

  // Toggle saved status
  const toggleSaved = (id: string) => {
    if (savedInsights.includes(id)) {
      setSavedInsights(savedInsights.filter(savedId => savedId !== id));
    } else {
      setSavedInsights([...savedInsights, id]);
    }
  };

  // Toggle expanded insight
  const toggleExpanded = (id: string) => {
    if (expandedInsight === id) {
      setExpandedInsight(null);
    } else {
      setExpandedInsight(id);
    }
  };

  return (
    <div className={`${className}`}>
      {showTitle && (
        <h2 className="text-xl font-bold text-gray-900 mb-4">Sara's Insights</h2>
      )}
      
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === filter.id
                ? 'bg-gradient-to-r from-coral-DEFAULT to-purple-500 text-white'
                : filter.id === 'prediction' 
                  ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  : filter.id === 'market' 
                  ? 'bg-coral-light bg-opacity-30 text-coral-dark hover:bg-opacity-50'
                  : filter.id === 'engagement' 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : filter.id === 'alert' 
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : filter.id === 'saved' 
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : filter.id === 'trending' 
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
            }`}
          >
            {filter.id === 'prediction' && '🔮 '}
            {filter.id === 'market' && '📊 '}
            {filter.id === 'engagement' && '📈 '}
            {filter.id === 'alert' && '🚨 '}
            {filter.id === 'saved' && '⭐ '}
            {filter.id === 'trending' && '🔥 '}
            {filter.id === 'all' && '🔍 '}
            {filter.label}
          </button>
        ))}
      </div>
      
      {/* Last update time indicator */}
      <div className="text-xs text-gray-500 mb-4">
        Last updated: {lastUpdateTime.toLocaleTimeString()}
      </div>

      {/* Trending Tokens Section */}
      {showTrending && trendingTokens.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🔥 Trending Tokens</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingTokens.map((token) => (
              <div 
                key={token.symbol} 
                className="border rounded-lg overflow-hidden shadow-sm hover:shadow transition-all duration-200 bg-white"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {token.imageUrl && (
                        <img 
                          src={token.imageUrl} 
                          alt={token.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">${token.symbol}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${token.priceChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{token.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Vol: {token.volume.toLocaleString()}
                        </div>
                        <div className="text-xs font-medium text-gray-900">
                          ${token.lastPrice.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-DEFAULT"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No insights available for this filter.
            </div>
          ) : (
            insights.map((insight) => (
              <div 
                key={insight.id} 
                className={`border rounded-lg overflow-hidden transition-all duration-200 ${
                  expandedInsight === insight.id ? 'shadow-md' : 'shadow-sm hover:shadow'
                } ${getInsightBgColor(insight.type)}`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {insight.token?.imageUrl && (
                        <img 
                          src={insight.token.imageUrl} 
                          alt={insight.token.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
                            {getInsightIcon(insight.type)} {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(insight.sentiment)}`}>
                            {insight.sentiment.charAt(0).toUpperCase() + insight.sentiment.slice(1)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSignalColor(insight.tradingSignal)}`}>
                            {insight.tradingSignal.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => toggleSaved(insight.id)}
                            className="text-gray-400 hover:text-yellow-500 transition-colors"
                            aria-label={savedInsights.includes(insight.id) ? "Unsave insight" : "Save insight"}
                          >
                            {savedInsights.includes(insight.id) ? (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-500">
                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            )}
                          </button>
                          <button 
                            onClick={() => toggleExpanded(insight.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={expandedInsight === insight.id ? "Collapse insight" : "Expand insight"}
                          >
                            {expandedInsight === insight.id ? (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-800 mb-1">{insight.content}</p>
                      
                      {expandedInsight === insight.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Confidence</p>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-coral-DEFAULT h-2 rounded-full" 
                                  style={{ width: `${insight.confidence * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-right mt-1">{Math.round(insight.confidence * 100)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Impact Level</p>
                              <div className="flex items-center gap-1">
                                <div className={`h-3 w-3 rounded-full ${insight.impactLevel === 'low' || insight.impactLevel === 'medium' || insight.impactLevel === 'high' ? 'bg-coral-DEFAULT' : 'bg-gray-300'}`}></div>
                                <div className={`h-3 w-3 rounded-full ${insight.impactLevel === 'medium' || insight.impactLevel === 'high' ? 'bg-coral-DEFAULT' : 'bg-gray-300'}`}></div>
                                <div className={`h-3 w-3 rounded-full ${insight.impactLevel === 'high' ? 'bg-coral-DEFAULT' : 'bg-gray-300'}`}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 mt-3">
                            <a 
                              href={`/swap?token=${insight.token?.symbol}`}
                              className="flex-1 bg-coral-DEFAULT hover:bg-coral-dark text-white text-xs font-medium py-2 px-3 rounded transition-colors text-center"
                            >
                              Trade ${insight.token?.symbol}
                            </a>
                            <a 
                              href={`/tokens/${insight.token?.symbol}`}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium py-2 px-3 rounded transition-colors text-center"
                            >
                              View Token Details
                            </a>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-gray-900">${insight.token?.symbol}</span>
                          <span className="text-xs text-gray-500">• {insight.token?.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">{formatRelativeTime(insight.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SaraInsights; 