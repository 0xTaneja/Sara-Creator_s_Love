import React from 'react';
import { Link } from 'react-router-dom';
import { Token } from '../utils/types';

interface CreatorTokenCardProps {
  token: Token;
}

const CreatorTokenCard: React.FC<CreatorTokenCardProps> = ({ token }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover-card">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <img 
            src={token.imageUrl} 
            alt={token.name} 
            className="w-12 h-12 rounded-full mr-4"
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
            <p className={`text-sm ${token.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
            </p>
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
        
        <div className="flex space-x-2">
          <Link 
            to={`/token/${token.id}`}
            className="flex-1 btn btn-secondary text-center"
          >
            Details
          </Link>
          <Link 
            to={`/swap?token=${token.id}`}
            className="flex-1 btn btn-primary text-center"
          >
            Trade
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CreatorTokenCard; 