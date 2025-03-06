import React, { useState, useEffect } from 'react';

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
      imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
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
      imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
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
      imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
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
      imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
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
      imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'positive',
    confidence: 0.81,
    tradingSignal: 'buy',
    impactLevel: 'medium',
  },
  {
    id: '6',
    type: 'market',
    content: 'Market dip: $LOGAN down 1.2%. Panic or opportunity? 💸',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 36 hours ago
    token: {
      symbol: 'LOGAN',
      name: 'Logan Paul',
      imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'negative',
    confidence: 0.72,
    tradingSignal: 'sell',
    impactLevel: 'low',
  },
  {
    id: '7',
    type: 'alert',
    content: 'Unusual options activity detected for $PEWDS. Large call volume at $25 strike.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    token: {
      symbol: 'PEWDS',
      name: 'PewDiePie',
      imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'positive',
    confidence: 0.68,
    tradingSignal: 'buy',
    impactLevel: 'medium',
  },
  {
    id: '8',
    type: 'engagement',
    content: 'Social sentiment for $LOGAN turning negative after controversial video. Monitor closely.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), // 10 hours ago
    token: {
      symbol: 'LOGAN',
      name: 'Logan Paul',
      imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    },
    sentiment: 'negative',
    confidence: 0.83,
    tradingSignal: 'sell',
    impactLevel: 'high',
  },
];

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

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'prediction', label: 'Predictions' },
    { id: 'market', label: 'Market' },
    { id: 'engagement', label: 'Engagement' },
    { id: 'alert', label: 'Alerts' },
    { id: 'saved', label: 'Saved' },
  ];

  // Simulate fetching insights
  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      // In a real app, you would fetch data from your API
      // For now, we'll just use a timeout to simulate loading
      setTimeout(() => {
        let filteredInsights = mockInsights;
        
        // Apply type filter if not 'all' or 'saved'
        if (activeFilter !== 'all' && activeFilter !== 'saved') {
          filteredInsights = mockInsights.filter(insight => insight.type === activeFilter);
        }
        
        // Filter saved insights
        if (activeFilter === 'saved') {
          filteredInsights = mockInsights.filter(insight => savedInsights.includes(insight.id));
        }
        
        // Apply limit if specified
        if (limit > 0) {
          filteredInsights = filteredInsights.slice(0, limit);
        }
        
        setInsights(filteredInsights);
        setIsLoading(false);
      }, 500);
    };

    fetchInsights();
  }, [limit, activeFilter, savedInsights]);

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
                ? 'bg-coral-DEFAULT text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

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