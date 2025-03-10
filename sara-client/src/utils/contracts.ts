import { CONTRACT_ADDRESSES } from '../config';

// ABIs
export const SARA_DEX_ABI = [
  // Function: swapCoralForCreatorToken
  "function swapCoralForCreatorToken(address creatorToken, uint256 amountIn, uint256 minAmountOut, uint256 slippage) external returns (uint256)",
  
  // Function: swapCreatorTokenForCoral
  "function swapCreatorTokenForCoral(address creatorToken, uint256 amountIn, uint256 minAmountOut, uint256 slippage) external returns (uint256)",
  
  // Function: getAmountOut
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256)",
  
  // Function: getReserves
  "function getReserves(address creatorToken) external view returns (uint256 creatorReserve, uint256 coralReserve)",
  
  // Function: lastSwapTimestamp
  "function lastSwapTimestamp(address user) external view returns (uint256)",
  
  // Function: MIN_TIME_BETWEEN_SWAPS
  "function MIN_TIME_BETWEEN_SWAPS() external view returns (uint256)",
  
  // Function: getSlippageSettings
  "function getSlippageSettings() external view returns (uint256 defaultSlippage, uint256 currentMaxSlippage, uint256 absoluteMaximum)",
  
  // Event: Swap
  "event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed creatorToken, bool isCoralToCT)"
];

export const SARA_TOKEN_ROUTER_ABI = [
  // Function: swapCoralForToken
  "function swapCoralForToken(address creatorToken, uint256 amountIn, uint256 minAmountOut) external returns (uint256)",
  
  // Function: swapTokenForCoral
  "function swapTokenForCoral(address creatorToken, uint256 amountIn, uint256 minAmountOut) external returns (uint256)",
  
  // Function: getAmountOut
  "function getAmountOut(address creatorToken, uint256 amountIn, bool isCoralToCreator) external view returns (uint256)",
  
  // Function: listNewCreatorToken
  "function listNewCreatorToken(address creatorToken) external",
  
  // Function: listedTokens
  "function listedTokens(address) external view returns (bool)"
];

export const SARA_LIQUIDITY_MANAGER_ABI = [
  // Function: getReserves
  "function getReserves(address creatorToken) external view returns (uint256, uint256)",
  // Function: getTokenBalance
  "function getTokenBalance(address token, address account) external view returns (uint256)"
];

export const ERC20_ABI = [
  // Function: balanceOf
  "function balanceOf(address account) external view returns (uint256)",
  
  // Function: allowance
  "function allowance(address owner, address spender) external view returns (uint256)",
  
  // Function: approve
  "function approve(address spender, uint256 amount) external returns (bool)",
  
  // Function: transfer
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  
  // Function: transferFrom
  "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
  
  // Function: name
  "function name() external view returns (string memory)",
  
  // Function: symbol
  "function symbol() external view returns (string memory)",
  
  // Function: decimals
  "function decimals() external view returns (uint8)",
  
  // Event: Transfer
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  
  // Event: Approval
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

export const CREATOR_TOKEN_FACTORY_ABI = [
  // Function: getCreatorToken
  "function getCreatorToken(string memory channelLink) external view returns (address)",
  
  // Function: mintToken
  "function mintToken(address creator, string memory name, string memory image, string memory channelLink, uint256 subscribers) external",
  
  // Event: CreatorTokenMinted
  "event CreatorTokenMinted(address indexed tokenAddress, string creatorName, string channelLink, string symbol, uint256 supply, string milestone)"
]; 