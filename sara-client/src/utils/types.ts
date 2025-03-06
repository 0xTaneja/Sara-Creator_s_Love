// Token interface
export interface Token {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange: number;
  views?: string | number;
  likes?: string | number;
  subscribers?: string | number;
  imageUrl: string;
  address?: string;
  tokenAddress?: string;
  description?: string;
  channelUrl?: string;
  marketCap?: string;
  volume24h?: string;
  liquidity?: string;
  holders?: string;
  videoCount?: number;
  mintTimestamp?: string | Date;
  isListedForTrading?: boolean;
  priceDiscoveryCompleted?: boolean;
  hasLiquidity?: boolean;
}

// Transaction status
export type TransactionStatus = 'none' | 'pending' | 'success' | 'error';

// Swap direction
export type SwapDirection = 'coralToCreator' | 'creatorToCoral';

// Notification type
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
}

// User profile
export interface UserProfile {
  address: string;
  transactions: Transaction[];
  favoriteTokens: string[];
}

// Transaction
export interface Transaction {
  hash: string;
  type: 'swap' | 'approve' | 'addLiquidity' | 'removeLiquidity';
  status: TransactionStatus;
  timestamp: number;
  fromToken: {
    address: string;
    symbol: string;
    amount: string;
  };
  toToken: {
    address: string;
    symbol: string;
    amount: string;
  };
  gasUsed?: string;
  gasPrice?: string;
} 