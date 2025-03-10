import React from 'react';
import { Link } from 'react-router-dom';
import { Token } from '../utils/types';
import usePriceChange from '../hooks/usePriceChange';

interface TrendingTokensProps {
  tokens: Token[];
}

// Add a new PriceChangeCell component to handle individual price changes
const PriceChangeCell: React.FC<{ token: Token }> = ({ token }) => {
  const { priceChange, isLoading } = usePriceChange(token.tokenAddress || token.address);
  
  // If still loading, show loading indicator
  if (isLoading) {
    return (
      <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Calculating...
      </span>
    );
  }
  
  // Handle null or NaN values
  if (priceChange === null || isNaN(priceChange)) {
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
        0.00%
      </span>
    );
  }
  
  // Round to 2 decimal places with validation
  const roundedChange = Math.round(priceChange * 100) / 100;
  
  // If change is very small (between -0.01 and 0.01), show neutral color
  if (Math.abs(roundedChange) < 0.01) {
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
        0.00%
      </span>
    );
  }
  
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
      roundedChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {roundedChange >= 0 ? '+' : ''}{roundedChange.toFixed(2)}%
    </span>
  );
};

const TrendingTokens: React.FC<TrendingTokensProps> = ({ tokens }) => {
  // Helper function to get token address (handle both address and tokenAddress fields)
  const getTokenAddress = (token: Token): string => {
    return token.tokenAddress || token.address || '';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Creator
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Token
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              24h Change
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Subscribers
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tokens.map((token, index) => (
            <tr key={token.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {index + 1}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <img className="h-10 w-10 rounded-full" src={token.imageUrl} alt={token.name} />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {token.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {token.channelUrl ? (
                        <a href={token.channelUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                          YouTube Channel
                        </a>
                      ) : 'No channel link'}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {token.symbol}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${token.price.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <PriceChangeCell token={token} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {token.subscribers || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {token.hasLiquidity ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Trading
                  </span>
                ) : token.priceDiscoveryCompleted ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Price Set
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    Pending
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <Link to={`/token/${token.id}`} className="text-indigo-600 hover:text-indigo-900">
                  Trade
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrendingTokens; 