import React, { createContext, useContext, useState, ReactNode } from 'react';
import { saveSwapEvent, SwapEvent } from '../utils/db';

interface SwapDetails {
  txHash: string;
  timestamp: number;
  tokenAddress: string;
  amountIn: string;
  amountOut: string;
  sender: string;
  isCoralToCT: boolean;
}

interface SwapEventContextType {
  lastSwapTimestamp: number;
  lastSwapTxHash: string | null;
  lastSwapDetails: SwapDetails | null;
  notifySwapOccurred: (txHash: string) => void;
  notifySwapWithDetails: (details: SwapDetails) => void;
}

const SwapEventContext = createContext<SwapEventContextType>({
  lastSwapTimestamp: 0,
  lastSwapTxHash: null,
  lastSwapDetails: null,
  notifySwapOccurred: () => {},
  notifySwapWithDetails: () => {}
});

export const SwapEventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastSwapTimestamp, setLastSwapTimestamp] = useState<number>(0);
  const [lastSwapTxHash, setLastSwapTxHash] = useState<string | null>(null);
  const [lastSwapDetails, setLastSwapDetails] = useState<SwapDetails | null>(null);

  const notifySwapOccurred = (txHash: string) => {
    console.log(`SwapEventContext: Notifying components of swap with hash ${txHash}`);
    setLastSwapTimestamp(Date.now());
    setLastSwapTxHash(txHash);
  };

  const notifySwapWithDetails = async (details: SwapDetails) => {
    console.log(`SwapEventContext: Notifying components of swap with details`, details);
    
    // First, update the context state immediately to ensure UI updates
    setLastSwapTimestamp(details.timestamp);
    setLastSwapTxHash(details.txHash);
    setLastSwapDetails(details);
    
    // Then save the event to localStorage
    try {
      // Calculate price (coral / token)
      let price = 0;
      
      // First get the raw string values
      const rawCoralAmount = details.isCoralToCT ? details.amountIn : details.amountOut;
      const rawTokenAmount = details.isCoralToCT ? details.amountOut : details.amountIn;
      
      // Then parse them to numbers for calculation
      const numCoralAmount = parseFloat(rawCoralAmount);
      const numTokenAmount = parseFloat(rawTokenAmount);
      
      console.log('Raw swap details:', {
        rawCoralAmount,
        rawTokenAmount,
        parsed: {
          numCoralAmount,
          numTokenAmount
        },
        isCoralToCT: details.isCoralToCT
      });
      
      // Calculate price only if we have valid amounts
      if (numTokenAmount > 0 && !isNaN(numTokenAmount) && !isNaN(numCoralAmount)) {
        price = numCoralAmount / numTokenAmount;
        console.log(`Calculated price: ${price} CORAL per token`);
      } else {
        console.warn('Cannot calculate price: token amount is 0 or invalid');
      }
      
      console.log('Final values being saved:', {
        coralAmount: numCoralAmount,
        tokenAmount: numTokenAmount,
        price
      });
      
      // Convert SwapDetails to the SwapEvent format
      const swapEvent: SwapEvent = {
        txHash: details.txHash,
        timestamp: details.timestamp,
        tokenAddress: details.tokenAddress.toLowerCase(),
        // Store the numeric values directly
        coralAmount: numCoralAmount.toString(),
        tokenAmount: numTokenAmount.toString(),
        sender: details.sender.toLowerCase(),
        isCoralToCT: details.isCoralToCT,
        // Ensure price is a valid number
        price: isNaN(price) ? 0 : price
      };
      
      // Log what we're saving to localStorage
      console.log('Saving swap event:', swapEvent);
      
      // Save to localStorage
      const result = await saveSwapEvent(swapEvent);
      console.log('Save to localStorage result:', result ? 'Success' : 'Failed');
      
      // If the initial save failed, try once more after a delay
      if (!result) {
        setTimeout(async () => {
          console.log('Retrying save to localStorage for event:', swapEvent.txHash);
          const retryResult = await saveSwapEvent(swapEvent);
          console.log('Retry save result:', retryResult ? 'Success' : 'Failed');
        }, 1000);
      }
    } catch (error) {
      console.error('Error saving swap event:', error);
    }
  };

  return (
    <SwapEventContext.Provider value={{
      lastSwapTimestamp,
      lastSwapTxHash,
      lastSwapDetails,
      notifySwapOccurred,
      notifySwapWithDetails
    }}>
      {children}
    </SwapEventContext.Provider>
  );
};

export const useSwapEvent = () => useContext(SwapEventContext); 