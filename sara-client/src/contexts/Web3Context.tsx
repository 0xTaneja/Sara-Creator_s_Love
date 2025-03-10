import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { SARA_DEX_ABI, ERC20_ABI } from '../utils/contracts';
import { CONTRACT_ADDRESSES } from '../config';

// Define types for our context
interface Web3ContextType {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

// Create context with default values
const Web3Context = createContext<Web3ContextType>({
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isConnected: false,
  isConnecting: false,
  error: null,
});

// Local storage key for persisting connection state
const WALLET_CONNECTED_KEY = 'sara_wallet_connected';

// Provider component
export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  // Initialize provider from window.ethereum
  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        try {
          // Create ethers provider
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
          setProvider(web3Provider);

          // Check if already connected or if we should auto-connect
          const shouldAutoConnect = localStorage.getItem(WALLET_CONNECTED_KEY) === 'true';
          const accounts = await web3Provider.listAccounts();
          
          if (accounts.length > 0) {
            const signer = web3Provider.getSigner();
            const address = await signer.getAddress();
            const network = await web3Provider.getNetwork();
            
            setSigner(signer);
            setAccount(address);
            setChainId(network.chainId);
            setIsConnected(true);
            localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
          } else if (shouldAutoConnect) {
            // Try to reconnect if previously connected
            try {
              const requestedAccounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts',
                params: []
              });
              
              if (requestedAccounts.length > 0) {
                const signer = web3Provider.getSigner();
                const address = await signer.getAddress();
                const network = await web3Provider.getNetwork();
                
                setSigner(signer);
                setAccount(address);
                setChainId(network.chainId);
                setIsConnected(true);
              } else {
                // If auto-connect fails, clear the stored state
                localStorage.removeItem(WALLET_CONNECTED_KEY);
              }
            } catch (err) {
              console.error('Auto-connect failed:', err);
              localStorage.removeItem(WALLET_CONNECTED_KEY);
            }
          }

          // Setup event listeners
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', handleChainChanged);
          window.ethereum.on('disconnect', handleDisconnect);
        } catch (err) {
          console.error('Error initializing Web3:', err);
          setError('Failed to initialize Web3 provider');
        }
      } else {
        setError('No Ethereum browser extension detected. Please install MetaMask.');
      }
      
      setHasInitialized(true);
    };

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // User switched accounts
        setAccount(accounts[0]);
        if (provider) {
          const signer = provider.getSigner();
          setSigner(signer);
          setIsConnected(true);
          localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
        }
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      // Chain ID is returned as a hex string
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      
      // Reload the page to avoid any state inconsistency
      window.location.reload();
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    initProvider();

    // Cleanup event listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('No Ethereum browser extension detected. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Create provider and signer
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      const signer = web3Provider.getSigner();
      const address = await signer.getAddress();
      const network = await web3Provider.getNetwork();
      
      setProvider(web3Provider);
      setSigner(signer);
      setAccount(address);
      setChainId(network.chainId);
      setIsConnected(true);
      
      // Save connection state
      localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      localStorage.removeItem(WALLET_CONNECTED_KEY);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);
    
    // Clear connection state
    localStorage.removeItem(WALLET_CONNECTED_KEY);
  };

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        account,
        chainId,
        connectWallet,
        disconnectWallet,
        isConnected,
        isConnecting,
        error,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

// Custom hook to use the Web3 context
export const useWeb3 = () => useContext(Web3Context);

// Add window.ethereum type
declare global {
  interface Window {
    ethereum: any;
  }
} 