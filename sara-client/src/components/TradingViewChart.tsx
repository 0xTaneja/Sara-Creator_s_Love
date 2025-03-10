import React from 'react';

interface TradingViewChartProps {
  tokenId?: string;
  height?: number;
  width?: string;
  tokenAddress?: string;
}

/**
 * TradingViewChart - Displays a coming soon message instead of the price chart
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  height = 400, 
  width = '100%',
  tokenAddress
}) => {
  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg shadow" style={{ width }}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Price Chart</h3>
      </div>
      
      <div 
        className="flex flex-col items-center justify-center p-6 text-center" 
        style={{ height: `${height}px`, minHeight: '300px' }}
      >
        {/* TradingView Logo Image */}
        <img 
          src="/trading-view.png" 
          alt="TradingView Logo" 
          className="w-32 h-auto mb-0.2"
        />
        
        <h2 className="text-xl font-medium text-gray-700 mb-2">Coming Soon</h2>
        <p className="text-gray-500 max-w-md">
          Live price chart will be available soon with real-time updates from TradingView. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default TradingViewChart;