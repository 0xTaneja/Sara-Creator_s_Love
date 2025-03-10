import React from 'react';
import { Link } from 'react-router-dom';

interface Creator {
  id: string;
  channelId?: string;
  name: string;
  imageUrl: string;
  subscribers: string | number;
  views: string | number;
  likes?: string | number;
  engagementScore?: number;
  tokenSymbol?: string;
  tokenPrice?: number;
  tokenAddress?: string;
  region?: string;
}

interface TopCreatorsProps {
  creators: Creator[];
  isLoading: boolean;
}

const TopCreators: React.FC<TopCreatorsProps> = ({ creators, isLoading }) => {
  // Format large numbers to K/M format
  const formatNumber = (num: number | string): string => {
    if (typeof num === 'string') return num;
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-coral-DEFAULT"></div>
      </div>
    );
  }

  if (!creators || creators.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No trending creators available</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">🔥 Top US Creators (24h)</h3>
        <p className="text-sm text-gray-600">These creators are trending in the last 24 hours</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {creators.map((creator) => (
          <div key={creator.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center p-4">
              <img 
                src={creator.imageUrl || 'https://via.placeholder.com/50'} 
                alt={creator.name} 
                className="w-12 h-12 rounded-full object-cover mr-4"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{creator.name}</h3>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="mr-2">{formatNumber(creator.subscribers)} subscribers</span>
                  {creator.region && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                      {creator.region}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-4 pb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Views</span>
                <span className="font-medium">{formatNumber(creator.views)}</span>
              </div>
              
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Likes</span>
                <span className="font-medium">{formatNumber(creator.likes || 0)}</span>
              </div>
              
              {creator.tokenSymbol && creator.tokenPrice && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Token</span>
                  <span className="font-medium">${creator.tokenPrice.toFixed(2)} {creator.tokenSymbol}</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Engagement</span>
                <span className="font-medium">
                  {creator.engagementScore ? (
                    <span className="text-green-600">{creator.engagementScore.toFixed(1)}</span>
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
              
              <div className="flex space-x-2">
                {creator.tokenAddress ? (
                  <Link 
                    to={`/token/${creator.id}`}
                    className="flex-1 bg-coral-DEFAULT hover:bg-coral-dark text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors duration-150"
                  >
                    View Token
                  </Link>
                ) : (
                  <button 
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-center py-2 px-4 rounded-md text-sm font-medium transition-colors duration-150"
                    disabled
                  >
                    No Token Yet
                  </button>
                )}
                
                <a 
                  href={`https://www.youtube.com/channel/${creator.channelId || creator.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors duration-150"
                >
                  YouTube
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopCreators; 