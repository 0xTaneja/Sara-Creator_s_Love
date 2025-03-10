import { useState, useEffect } from 'react';
import { calculatePriceChange } from '../utils/db';
import { useSwapEvent } from '../contexts/SwapEventContext';

/**
 * A hook to get the real-time price change for a token
 * @param tokenAddress The token address
 * @param timeframe The timeframe in hours (default: 24 hours)
 * @param refreshInterval Refresh interval in milliseconds (default: 60000ms / 1 minute)
 */
export const usePriceChange = (
  tokenAddress?: string, 
  timeframe: number = 24,
  refreshInterval: number = 60000
) => {
  const [priceChange, setPriceChange] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const { lastSwapTimestamp, lastSwapDetails } = useSwapEvent();

  // For debugging
  useEffect(() => {
    if (lastSwapDetails) {
      console.log("New swap detected in usePriceChange:", {
        token: lastSwapDetails.tokenAddress,
        timestamp: new Date(lastSwapDetails.timestamp).toLocaleString(),
        isCoralToCT: lastSwapDetails.isCoralToCT ? "Buy" : "Sell"
      });
    }
  }, [lastSwapTimestamp, lastSwapDetails]);

  useEffect(() => {
    if (!tokenAddress) {
      console.log('usePriceChange: No token address provided');
      return;
    }

    const normalizedTokenAddress = tokenAddress.toLowerCase();
    console.log(`usePriceChange setup for token: ${normalizedTokenAddress}`);

    const fetchPriceChange = async () => {
      // Don't fetch too frequently
      const now = Date.now();
      if (now - lastFetchTime < 5000 && lastFetchTime !== 0) {
        console.log('Skipping price fetch, too soon since last fetch');
        return;
      }
      
      setIsLoading(true);
      setError(null);
      setLastFetchTime(now);
      
      try {
        console.log(`Fetching price change for ${normalizedTokenAddress}`);
        const change = await calculatePriceChange(normalizedTokenAddress, timeframe);
        console.log(`Setting price change to: ${change}`);
        setPriceChange(change);
      } catch (err) {
        console.error('Error fetching price change:', err);
        setError('Failed to fetch price change data');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Initial fetch
    fetchPriceChange();
    
    // Set up interval for periodic updates
    const intervalId = setInterval(fetchPriceChange, refreshInterval);
    
    // Clean up on unmount
    return () => {
      console.log(`Cleaning up usePriceChange for ${normalizedTokenAddress}`);
      clearInterval(intervalId);
    };
  }, [tokenAddress, timeframe, refreshInterval]);

  // Fetch when new swaps happen for this token
  useEffect(() => {
    if (!tokenAddress || !lastSwapDetails) return;
    
    const normalizedTokenAddress = tokenAddress.toLowerCase();
    const swapTokenAddress = lastSwapDetails.tokenAddress.toLowerCase();
    
    // Only update if the swap was for this token
    if (normalizedTokenAddress === swapTokenAddress) {
      console.log(`New swap detected for ${normalizedTokenAddress}, updating price change`);
      
      const fetchPriceChange = async () => {
        setIsLoading(true);
        try {
          const change = await calculatePriceChange(normalizedTokenAddress, timeframe);
          console.log(`New price change after swap: ${change}`);
          setPriceChange(change);
        } catch (err) {
          console.error('Error updating price change after swap:', err);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchPriceChange();
    }
  }, [lastSwapTimestamp, lastSwapDetails, tokenAddress, timeframe]);

  return { priceChange, isLoading, error };
};

export default usePriceChange; 