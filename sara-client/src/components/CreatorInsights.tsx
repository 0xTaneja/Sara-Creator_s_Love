import React from 'react';

interface CreatorInsightsProps {
  token: {
    name?: string;
    symbol?: string;
    subscribers?: string | number;
    views?: string | number;
    likes?: string | number;
    channelUrl?: string;
    imageUrl?: string;
    description?: string;
    videoCount?: number;
    marketCap?: string | number;
    volume24h?: string | number;
    liquidity?: string | number;
    holders?: string | number;
    price?: number;
    priceChange?: number;
  };
}

const CreatorInsights: React.FC<CreatorInsightsProps> = ({ token }) => {
  // Default values
  const name = token.name || 'Creator';
  const symbol = token.symbol || 'TOKEN';
  const subscribers = token.subscribers || 0;
  const views = token.views || 0;
  const likes = token.likes || 0;
  const channelUrl = token.channelUrl || '#';
  const imageUrl = token.imageUrl || 'https://via.placeholder.com/100';
  const description = token.description || 'No description available';
  const videoCount = token.videoCount || 0;
  const price = token.price || 0;
  const priceChange = token.priceChange || 0;

  const formatNumber = (num: string | number): string => {
    if (num === undefined || num === null) return '0';
    
    if (typeof num === 'string') {
      // If it's already a formatted string like "1.2M", return it
      if (/^[\d.]+[KMB]$/.test(num)) return num;
      
      // Try to parse it as a number
      num = parseFloat(num);
      if (isNaN(num)) return '0';
    }
    
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const calculateEngagementRate = (): string => {
    // Convert string values to numbers if needed
    const subsNum = typeof subscribers === 'string' ? parseFloat(subscribers.replace(/[KMB]/g, '')) : subscribers;
    const viewsNum = typeof views === 'string' ? parseFloat(views.replace(/[KMB]/g, '')) : views;
    
    if (!subsNum || subsNum === 0) return '0.0%';
    
    // Simple engagement rate calculation: views / subscribers * 100
    const rate = (viewsNum / subsNum) * 100;
    
    // Cap at 100% for display purposes
    return `${Math.min(rate, 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Creator Profile */}
      <div className="flex items-center">
        <img 
          src={imageUrl} 
          alt={name} 
          className="w-16 h-16 rounded-full object-cover mr-4"
        />
        <div>
          <div className="flex items-center">
            <h3 className="text-lg font-semibold">{name}</h3>
            {priceChange > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Trending
              </span>
            )}
          </div>
          <a 
            href={channelUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm text-coral-DEFAULT hover:underline"
          >
            Visit YouTube Channel
          </a>
        </div>
      </div>
      
      {/* Creator Description */}
      <div>
        <p className="text-sm text-gray-600 line-clamp-3">{description}</p>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-lg font-medium">{formatNumber(subscribers)}</div>
          <p className="text-xs text-gray-500">Subscribers</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-lg font-medium">{formatNumber(views)}</div>
          <p className="text-xs text-gray-500">Views</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-lg font-medium">{formatNumber(likes)}</div>
          <p className="text-xs text-gray-500">Likes</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-lg font-medium">{formatNumber(videoCount)}</div>
          <p className="text-xs text-gray-500">Videos</p>
        </div>
      </div>
      
      {/* No additional metrics - Token Metrics card removed */}
    </div>
  );
};

export default CreatorInsights; 