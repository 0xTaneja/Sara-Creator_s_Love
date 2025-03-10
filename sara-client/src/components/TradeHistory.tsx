import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { SARA_DEX_ABI } from '../utils/contracts';
import { CONTRACT_ADDRESSES, BLOCKCHAIN_EXPLORER_URL } from '../config';
import { useWeb3 } from '../contexts/Web3Context';
import { useSwapEvent } from '../contexts/SwapEventContext';
import { getSwapEvents, SwapEvent, saveSwapEvent } from '../utils/db';

interface TradeHistoryProps {
  tokenAddress?: string;
}

interface Trade {
  id: string;
  sender: string;
  timestamp: number;
  txHash: string;
  isCoralToCT: boolean;
  coralAmount: number;
  tokenAmount: number;
  price: number;
}

// Price calculation helper
const calculatePrice = (amountIn: string, amountOut: string): number => {
  return parseFloat(amountIn) / parseFloat(amountOut);
};

const TradeHistory: React.FC<TradeHistoryProps> = ({ tokenAddress }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const { provider, account } = useWeb3();
  const { lastSwapTimestamp, lastSwapTxHash, lastSwapDetails } = useSwapEvent();
  const processingTrade = useRef<boolean>(false);
  const eventListenerRef = useRef<any>(null);

  // Fetch trade history from localStorage
  const fetchTradeHistory = async () => {
    if (!tokenAddress) return;
    
    setIsLoading(true);
    try {
      console.log(`Fetching trade history for token: ${tokenAddress}`);
      
      // Get swap events from localStorage
      const events = await getSwapEvents(tokenAddress);
      console.log('Fetched events from localStorage:', events);
      
      if (events && events.length > 0) {
        // Map to our Trade interface
        const tradeData: Trade[] = events.map((event: SwapEvent) => {
          console.log('Processing event for UI:', event);
          
          // Direct access to the raw data for inspection
          console.log('Raw data types:', {
            coralAmount: typeof event.coralAmount + ' - ' + event.coralAmount,
            tokenAmount: typeof event.tokenAmount + ' - ' + event.tokenAmount,
            price: typeof event.price + ' - ' + event.price
          });
          
          // Parse values and ensure they're valid numbers
          let parsedCoralAmount = 0;
          let parsedTokenAmount = 0;
          let parsedPrice = 0;
          
          try {
            parsedCoralAmount = typeof event.coralAmount === 'string'
              ? parseFloat(event.coralAmount)
              : typeof event.coralAmount === 'number'
                ? event.coralAmount
                : 0;
                
            parsedTokenAmount = typeof event.tokenAmount === 'string'
              ? parseFloat(event.tokenAmount)
              : typeof event.tokenAmount === 'number'
                ? event.tokenAmount
                : 0;
                
            parsedPrice = typeof event.price === 'number'
              ? event.price
              : typeof event.price === 'string'
                ? parseFloat(event.price)
                : 0;
          } catch (error) {
            console.error('Error parsing values:', error);
          }
          
          // Fallback to ensure we have valid numbers
          const validCoralAmount = isNaN(parsedCoralAmount) ? 0 : parsedCoralAmount;
          const validTokenAmount = isNaN(parsedTokenAmount) ? 0 : parsedTokenAmount;
          const validPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
          
          console.log('Final processed values for display:', {
            coralAmount: validCoralAmount,
            tokenAmount: validTokenAmount,
            price: validPrice
          });
          
          return {
            id: event.txHash,
            sender: event.sender,
            timestamp: event.timestamp,
            txHash: event.txHash,
            isCoralToCT: event.isCoralToCT,
            coralAmount: validCoralAmount,
            tokenAmount: validTokenAmount,
            price: validPrice
          };
        });
        
        // Sort by timestamp (newest first)
        tradeData.sort((a, b) => b.timestamp - a.timestamp);
        
        // Update state with the fetched trades
        setTrades(tradeData);
        setLastUpdated(Date.now());
        console.log(`Set ${tradeData.length} trades in component state`);
      } else {
        console.log('No trades found in localStorage');
      }
    } catch (error) {
      console.error('Error fetching trade history:', error);
      setError('Failed to load trade history');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup event listener for blockchain swap events - simplified version
  const setupEventListener = (): (() => void) | null => {
    // We're not using blockchain event listeners anymore since we're using localStorage
    // All events are now captured through the SwapEventContext
    console.log('Using SwapEventContext for events instead of blockchain listeners');
    return null;
  };

  // Listen for context swap events
  useEffect(() => {
    if (lastSwapTimestamp > 0 && lastSwapTxHash) {
      console.log('TradeHistory: Received swap notification from context');
      
      // Add the new trade directly to the list if we have details
      if (lastSwapDetails && tokenAddress && 
          lastSwapDetails.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
        console.log('Adding trade directly from context details');
        
        // Create a new trade entry from the swap details
        const newTrade: Trade = {
          id: lastSwapDetails.txHash,
          sender: lastSwapDetails.sender.toLowerCase(),
          timestamp: lastSwapDetails.timestamp * 1000, // Convert to milliseconds if needed
          txHash: lastSwapDetails.txHash,
          isCoralToCT: lastSwapDetails.isCoralToCT,
          coralAmount: parseFloat(lastSwapDetails.isCoralToCT ? lastSwapDetails.amountIn : lastSwapDetails.amountOut),
          tokenAmount: parseFloat(lastSwapDetails.isCoralToCT ? lastSwapDetails.amountOut : lastSwapDetails.amountIn),
          price: parseFloat(lastSwapDetails.isCoralToCT 
            ? lastSwapDetails.amountIn 
            : lastSwapDetails.amountOut) / 
            parseFloat(lastSwapDetails.isCoralToCT 
              ? lastSwapDetails.amountOut 
              : lastSwapDetails.amountIn)
        };
        
        // Add the new trade to the top of the list
        setTrades(prevTrades => {
          // Check if this trade is already in the list
          const exists = prevTrades.some(t => t.id === newTrade.id);
          if (exists) {
            console.log('Trade already exists in list, not adding again');
            return prevTrades;
          }
          
          // Add the new trade to the top and save to local storage as backup
          const updatedTrades = [newTrade, ...prevTrades];
          
          // Log trade storage
          console.log(`TradeHistory: Storing trade in component state: ${newTrade.txHash}`);
          
          return updatedTrades;
        });
      }
      
      // We'll still try to refresh from the API, but our UI won't rely on it
      setTimeout(() => {
        fetchTradeHistory();
      }, 1000);
    }
  }, [lastSwapTimestamp, lastSwapTxHash, lastSwapDetails, tokenAddress]);
  
  // Initialize data and event listeners
  useEffect(() => {
    fetchTradeHistory();
    const cleanup = setupEventListener();
    
    // Refresh less frequently to avoid losing local state too often
    const refreshInterval = setInterval(() => {
      fetchTradeHistory();
    }, 60000); // Refresh every 60 seconds
    
    // Handle window focus events to refresh when user returns to tab
    const handleFocus = () => {
      console.log('Window focused, refreshing trade history');
      fetchTradeHistory();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
      if (cleanup) cleanup();
    };
  }, [tokenAddress]); // Re-run when tokenAddress changes
  
  // Format helpers
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  const formatAmount = (amount: number): string => {
    if (!amount || isNaN(amount)) return '0.00';
    return amount.toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 6 
    });
  };
  
  const formatPrice = (price: number): string => {
    if (!price || isNaN(price)) return '0.00';
    return price.toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 6 
    });
  };
  
  const getExplorerLink = (txHash: string): string => {
    return `${BLOCKCHAIN_EXPLORER_URL}/tx/${txHash}`;
  };
  
  const handleRefresh = () => {
    fetchTradeHistory();
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">Trade History</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {trades.length > 0 ? `${trades.length} trades` : ''}
          </span>
          <button 
            onClick={handleRefresh}
            className="text-blue-500 hover:text-blue-700"
            title="Refresh trades"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {isLoading && trades.length === 0 ? (
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">{error}</div>
      ) : trades.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No trade history available yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tx
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trades.map(trade => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                      trade.isCoralToCT ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.isCoralToCT ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(trade.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a 
                      href={getExplorerLink(trade.txHash)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {trade.txHash.substring(0, 6)}...{trade.txHash.substring(trade.txHash.length - 4)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TradeHistory; 