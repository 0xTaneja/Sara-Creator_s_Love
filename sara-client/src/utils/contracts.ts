// Contract addresses
export const CONTRACT_ADDRESSES = {
  SARA_DEX: '0x123456789abcdef123456789abcdef123456789a', // Replace with actual address
  CORAL_TOKEN: '0xabcdef123456789abcdef123456789abcdef1234', // Replace with actual address
  CREATOR_TOKEN_FACTORY: '0x789abcdef123456789abcdef123456789abcdef12', // Replace with actual address
};

// ABIs
export const SARA_DEX_ABI = [
  // Function: swapCoralForCreatorToken
  "function swapCoralForCreatorToken(address creatorToken, uint256 amountIn, uint256 minAmountOut, uint256 maxSlippage) external returns (uint256)",
  
  // Function: swapCreatorTokenForCoral
  "function swapCreatorTokenForCoral(address creatorToken, uint256 amountIn, uint256 minAmountOut, uint256 maxSlippage) external",
  
  // Function: getAmountOut
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256)",
  
  // Function: getAmountOutWithFees
  "function getAmountOutWithFees(uint256 amountIn, address[] calldata path) external view returns (uint256)",
  
  // Event: CoralSwapExecuted
  "event CoralSwapExecuted(address indexed user, address indexed creatorToken, uint256 amountIn, uint256 amountOut, uint256 fee)"
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