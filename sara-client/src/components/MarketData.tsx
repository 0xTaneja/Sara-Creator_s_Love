import React from 'react';

interface MarketDataProps {
  token: {
    price?: number;
    priceChange?: number;
    marketCap?: number;
    volume24h?: number;
    liquidity?: number;
    holders?: number;
    symbol?: string;
  };
}

const MarketData: React.FC<MarketDataProps> = ({ token }) => {
  // Format currency with $ sign and appropriate decimal places
  const formatCurrency = (value?: number): string => {
    if (value === undefined || value === null) return '$0.00';
    
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format percentage change
  const formatPercentage = (value?: number): string => {
    if (value === undefined || value === null) return '0.00%';
    
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Format number with commas
  const formatNumber = (value?: number): string => {
    if (value === undefined || value === null) return '0';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Default values
  const price = token.price || 0;
  const priceChange = token.priceChange || 0;
  const marketCap = token.marketCap || 0;
  const volume24h = token.volume24h || 0;
  const liquidity = token.liquidity || 0;
  const holders = token.holders || 0;
  const symbol = token.symbol || 'TOKEN';

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Market Data</h3>
      
      {/* Current Price */}
      <div className="mb-6">
        <div className="flex items-baseline">
          <span className="text-2xl font-bold">{formatCurrency(price)}</span>
          <span className={`ml-2 text-sm font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {formatPercentage(priceChange)}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Price (24h)</p>
      </div>
      
      {/* Market Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Market Cap */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold">{formatCurrency(marketCap)}</div>
          <p className="text-sm text-gray-500">Market Cap</p>
        </div>
        
        {/* 24h Volume */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold">{formatCurrency(volume24h)}</div>
          <p className="text-sm text-gray-500">24h Volume</p>
        </div>
        
        {/* Liquidity */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold">{formatCurrency(liquidity)}</div>
          <p className="text-sm text-gray-500">Liquidity</p>
        </div>
        
        {/* Holders */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-semibold">{formatNumber(holders)}</div>
          <p className="text-sm text-gray-500">Holders</p>
        </div>
      </div>
      
      {/* Additional Market Info */}
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Token Info</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">Symbol</span>
            <span className="text-sm font-medium">{symbol}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">Network</span>
            <span className="text-sm font-medium">Sara Blockchain</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Contract</span>
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">0x1a2b...3c4d</span>
              <button className="ml-1 text-coral-DEFAULT hover:text-coral-dark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Links */}
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Links</h4>
        <div className="flex space-x-2">
          <a 
            href="#" 
            className="flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
            </svg>
            Website
          </a>
          <a 
            href="#" 
            className="flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
            </svg>
            Twitter
          </a>
          <a 
            href="#" 
            className="flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default MarketData; 