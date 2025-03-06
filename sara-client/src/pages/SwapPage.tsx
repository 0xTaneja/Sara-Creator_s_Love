import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';

// Mock data for creator tokens
const mockCreatorTokens = [
  {
    id: '1',
    name: 'MrBeast',
    symbol: 'BEAST',
    price: 1.24,
    priceChange: 12.5,
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKY455xp16s2AIHalRjK60zas-DitxAHmRjQsXPE2A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x1234567890123456789012345678901234567890',
  },
  {
    id: '2',
    name: 'Marques Brownlee',
    symbol: 'MKBHD',
    price: 0.87,
    priceChange: -2.1,
    imageUrl: 'https://yt3.googleusercontent.com/lkH37D712tiyphnu0Id0D5MwwQ7IRuwgQLVD05iMXlDWO-kDHut3uI4MgIpWJ5xxX0n2Px8A=s176-c-k-c0x00ffffff-no-rj',
    address: '0x2345678901234567890123456789012345678901',
  },
  {
    id: '3',
    name: 'PewDiePie',
    symbol: 'PEWDS',
    price: 1.05,
    priceChange: 5.3,
    imageUrl: 'https://yt3.googleusercontent.com/5oUY3tashyxfqsjO5SGhjT4dus8FkN9CsAHwXWISFrdPYii1FudD4ICtLfuCw6-THJsJbgoY=s176-c-k-c0x00ffffff-no-rj',
    address: '0x3456789012345678901234567890123456789012',
  },
  {
    id: '4',
    name: 'Logan Paul',
    symbol: 'LOGAN',
    price: 0.65,
    priceChange: -1.2,
    imageUrl: 'https://yt3.googleusercontent.com/ytc/APkrFKZWeMCsx4Q9e_Hm6VKOOOcl3MPTAzqRMfC0GNjm=s176-c-k-c0x00ffffff-no-rj',
    address: '0x4567890123456789012345678901234567890123',
  },
];

// Mock token for CORAL
const coralToken = {
  id: '0',
  name: 'CORAL',
  symbol: 'CORAL',
  price: 1.0,
  priceChange: 0.0,
  imageUrl: 'https://via.placeholder.com/150/FF7F50/FFFFFF?text=CORAL',
  address: '0x0000000000000000000000000000000000000000',
};

interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange: number;
  imageUrl: string;
  address: string;
}

const SwapPage: React.FC = () => {
  const location = useLocation();
  const { isConnected, connectWallet } = useWeb3();
  const [fromToken, setFromToken] = useState<Token>(coralToken);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenList, setShowTokenList] = useState<'from' | 'to' | null>(null);
  const [tokens, setTokens] = useState<Token[]>([coralToken, ...mockCreatorTokens]);
  const [transactionStatus, setTransactionStatus] = useState<'none' | 'pending' | 'success' | 'error'>('none');
  const [transactionHash, setTransactionHash] = useState('');

  // Parse query params to get token address
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenAddress = searchParams.get('token');
    
    if (tokenAddress) {
      const selectedToken = mockCreatorTokens.find(t => t.id === tokenAddress);
      if (selectedToken) {
        setToToken(selectedToken);
      } else {
        setToToken(mockCreatorTokens[0]);
      }
    } else {
      setToToken(mockCreatorTokens[0]);
    }
  }, [location]);

  // Calculate to amount based on from amount
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      const amount = parseFloat(fromAmount);
      if (!isNaN(amount)) {
        const rate = fromToken.price / toToken.price;
        const calculatedAmount = (amount * rate).toFixed(6);
        setToAmount(calculatedAmount);
      } else {
        setToAmount('');
      }
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken]);

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromAmount(e.target.value);
  };

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToAmount(e.target.value);
    
    if (e.target.value && fromToken && toToken) {
      const amount = parseFloat(e.target.value);
      if (!isNaN(amount)) {
        const rate = toToken.price / fromToken.price;
        const calculatedAmount = (amount * rate).toFixed(6);
        setFromAmount(calculatedAmount);
      } else {
        setFromAmount('');
      }
    } else {
      setFromAmount('');
    }
  };

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlippage(e.target.value);
  };

  const handleTokenSelect = (token: Token) => {
    if (showTokenList === 'from') {
      if (token.address === toToken?.address) {
        // Swap the tokens if selecting the same token
        setToToken(fromToken);
      }
      setFromToken(token);
    } else if (showTokenList === 'to') {
      if (token.address === fromToken.address) {
        // Swap the tokens if selecting the same token
        setFromToken(toToken!);
      }
      setToToken(token);
    }
    setShowTokenList(null);
  };

  const handleSwapTokens = () => {
    if (toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);
      
      // Recalculate amounts
      if (fromAmount) {
        const amount = parseFloat(fromAmount);
        if (!isNaN(amount)) {
          const rate = toToken.price / fromToken.price;
          const calculatedAmount = (amount * rate).toFixed(6);
          setFromAmount(toAmount);
          setToAmount(calculatedAmount);
        }
      }
    }
  };

  const executeSwap = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    
    if (!fromAmount || !toToken) return;
    
    setIsLoading(true);
    setTransactionStatus('pending');
    
    try {
      // In a real app, this would be a call to the smart contract
      // For now, we'll just simulate a transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a fake transaction hash
      const hash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      setTransactionHash(hash);
      setTransactionStatus('success');
    } catch (error) {
      console.error('Swap failed:', error);
      setTransactionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Swap Tokens</h1>
          <button 
            onClick={() => setShowTokenList(null)}
            className="text-sm text-coral-DEFAULT hover:text-coral-dark"
          >
            Settings
          </button>
        </div>
        
        {/* From Token */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">You Pay</label>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <input
                type="text"
                value={fromAmount}
                onChange={handleFromAmountChange}
                placeholder="0.0"
                className="bg-transparent text-2xl font-medium text-gray-900 focus:outline-none w-full"
              />
              <button 
                onClick={() => setShowTokenList('from')}
                className="flex items-center bg-white rounded-lg px-3 py-1 shadow-sm hover:shadow-md transition-shadow"
              >
                <img src={fromToken.imageUrl} alt={fromToken.name} className="w-6 h-6 rounded-full mr-2" />
                <span className="font-medium">{fromToken.symbol}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Balance: 100.0 {fromToken.symbol}
            </div>
          </div>
        </div>
        
        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button 
            onClick={handleSwapTokens}
            className="bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-coral-DEFAULT" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* To Token */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">You Receive</label>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <input
                type="text"
                value={toAmount}
                onChange={handleToAmountChange}
                placeholder="0.0"
                className="bg-transparent text-2xl font-medium text-gray-900 focus:outline-none w-full"
              />
              <button 
                onClick={() => setShowTokenList('to')}
                className="flex items-center bg-white rounded-lg px-3 py-1 shadow-sm hover:shadow-md transition-shadow"
              >
                {toToken && (
                  <>
                    <img src={toToken.imageUrl} alt={toToken.name} className="w-6 h-6 rounded-full mr-2" />
                    <span className="font-medium">{toToken.symbol}</span>
                  </>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Balance: {toToken ? `0.0 ${toToken.symbol}` : '0.0'}
            </div>
          </div>
        </div>
        
        {/* Slippage Settings */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Slippage Tolerance</label>
          <div className="flex space-x-2">
            <button 
              onClick={() => setSlippage('0.1')}
              className={`px-3 py-1 rounded-md text-sm ${slippage === '0.1' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              0.1%
            </button>
            <button 
              onClick={() => setSlippage('0.5')}
              className={`px-3 py-1 rounded-md text-sm ${slippage === '0.5' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              0.5%
            </button>
            <button 
              onClick={() => setSlippage('1.0')}
              className={`px-3 py-1 rounded-md text-sm ${slippage === '1.0' ? 'bg-coral-DEFAULT text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              1.0%
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={slippage}
                onChange={handleSlippageChange}
                className="w-full px-3 py-1 rounded-md bg-gray-100 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-coral-DEFAULT"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500 text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Swap Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Rate</span>
            <span className="text-gray-900">
              {fromToken && toToken ? 
                `1 ${fromToken.symbol} = ${(fromToken.price / toToken.price).toFixed(6)} ${toToken.symbol}` : 
                '-'
              }
            </span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Fee</span>
            <span className="text-gray-900">0.3%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Slippage Tolerance</span>
            <span className="text-gray-900">{slippage}%</span>
          </div>
        </div>
        
        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={isLoading || !fromAmount || !toToken || parseFloat(fromAmount) <= 0}
          className={`w-full py-3 rounded-lg font-medium ${
            isLoading || !fromAmount || !toToken || parseFloat(fromAmount) <= 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-coral-DEFAULT text-white hover:bg-coral-dark'
          }`}
        >
          {isLoading ? (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
              Swapping...
            </div>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            'Enter an amount'
          ) : (
            `Swap ${fromToken.symbol} for ${toToken?.symbol}`
          )}
        </button>
        
        {/* Transaction Status */}
        {transactionStatus !== 'none' && (
          <div className={`mt-4 p-4 rounded-lg ${
            transactionStatus === 'pending' ? 'bg-yellow-50 text-yellow-700' :
            transactionStatus === 'success' ? 'bg-green-50 text-green-700' :
            'bg-red-50 text-red-700'
          }`}>
            {transactionStatus === 'pending' && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
                <span>Transaction pending...</span>
              </div>
            )}
            {transactionStatus === 'success' && (
              <div>
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Transaction successful!</span>
                </div>
                <div className="text-sm">
                  <a 
                    href={`https://explorer.sonic.ooo/tx/${transactionHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-green-800"
                  >
                    View on Explorer
                  </a>
                </div>
              </div>
            )}
            {transactionStatus === 'error' && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Transaction failed. Please try again.</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Token Selection Modal */}
      {showTokenList && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowTokenList(null)}></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Select a token
                    </h3>
                    
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search by name or address"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-coral-DEFAULT"
                      />
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {tokens.map(token => (
                        <button
                          key={token.id}
                          onClick={() => handleTokenSelect(token)}
                          className="w-full flex items-center p-3 hover:bg-gray-50 rounded-md transition-colors"
                        >
                          <img src={token.imageUrl} alt={token.name} className="w-8 h-8 rounded-full mr-3" />
                          <div className="text-left">
                            <div className="font-medium">{token.name}</div>
                            <div className="text-sm text-gray-500">{token.symbol}</div>
                          </div>
                          <div className="ml-auto text-right">
                            <div className="font-medium">${token.price.toFixed(2)}</div>
                            <div className={`text-sm ${token.priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowTokenList(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapPage; 