import React from 'react';
import { Link } from 'react-router-dom';
import { Token } from '../utils/types';
import usePriceChange from '../hooks/usePriceChange';

interface CreatorTokenCardProps {
  token: Token;
}

const CreatorTokenCard: React.FC<CreatorTokenCardProps> = ({ token }) => {
  const { priceChange } = usePriceChange(token.tokenAddress || token.address);
  
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover-card border border-gray-100 flex flex-col h-full">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center mb-4">
          <img 
            src={token.imageUrl} 
            alt={token.name} 
            className="w-12 h-12 rounded-full mr-4 border-2 border-gray-100 shadow-sm"
          />
          <div>
            <h3 className="text-lg font-bold text-gray-900">{token.name}</h3>
            <p className="text-sm text-gray-500">${token.symbol}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-xl font-medium text-gray-900">${token.price.toFixed(2)}</p>
            <PriceChangeDisplay priceChange={priceChange} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Subscribers</p>
            <p className="text-xl font-medium text-gray-900">{token.subscribers}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Views</p>
            <p className="text-lg font-medium text-gray-900">{token.views}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Likes</p>
            <p className="text-lg font-medium text-gray-900">{token.likes}</p>
          </div>
        </div>
        
        <div className="mt-auto flex flex-col space-y-3">
          <Link 
            to={`/token/${token.id}`}
            className="w-full inline-flex justify-center items-center px-4 py-3 rounded-md text-sm font-semibold text-white shadow-md transition-all bg-[#FF7F50] hover:bg-[#E56A45] border border-[#FF7F50]"
          >
            Trade
          </Link>
          
          {token.channelUrl && (
            <a 
              href={token.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center text-white py-3 px-4 rounded-md text-sm font-semibold shadow-md transition-all bg-[#FF0000] hover:bg-[#CC0000] border border-[#FF0000]"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube Channel
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const PriceChangeDisplay = ({ priceChange }: { priceChange: number | null }) => {
  if (priceChange === null) {
    return (
      <div className="text-sm text-gray-500 flex items-center">
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Calculating...
      </div>
    );
  }
  
  if (isNaN(priceChange)) {
    console.log('NaN detected in PriceChangeDisplay');
    return <p className="text-sm text-gray-600">0.00%</p>;
  }
  
  const roundedChange = Math.round(priceChange * 100) / 100;
  
  if (Math.abs(roundedChange) < 0.01) {
    return <p className="text-sm text-gray-600">0.00%</p>;
  }
  
  return (
    <p className={`text-sm font-medium ${roundedChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {roundedChange >= 0 ? '+' : ''}{roundedChange.toFixed(2)}%
    </p>
  );
};

export default CreatorTokenCard; 