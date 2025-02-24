// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SaraDEX.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Add CreatorCoin interface with the methods we need
interface ICreatorCoin {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract SaraTokenRouter is Ownable {
    using SafeERC20 for IERC20;

    address public coralToken;
    SaraLiquidityManager public liquidityManager;
    SaraDEX public dex;
    mapping(address => bool) public listedTokens;
    ICreatorCoin public creatorTokenFactory;  // Use interface instead of concrete implementation
    bool public paused;
    uint256 public constant MIN_INITIAL_CORAL = 1000 * 1e18;  // 1000 CORAL tokens
    uint256 public constant MAX_INITIAL_CORAL = 1000000 * 1e18;  // 1M CORAL tokens

    // Add mapping to track tokens in price discovery
    mapping(address => bool) public inPriceDiscovery;

    // Add error messages as constants for consistency
    string private constant ERR_ZERO_CORAL = "Initial liquidity cannot be zero";
    string private constant ERR_ZERO_SUBSCRIBERS = "Initial subscribers cannot be zero";
    string private constant ERR_INSUFFICIENT_CORAL = "Insufficient CORAL token balance";
    string private constant ERR_INVALID_CORAL_AMOUNT = "Invalid CORAL token amount";
    string private constant ERR_INVALID_CREATOR = "Invalid creator token";

    // Remove approval tracking for CORAL tokens since they're native
    mapping(address => bool) public hasOpenApproval;
    uint256 public constant APPROVAL_TIMEOUT = 1 hours;
    uint256 public lastApprovalTimestamp;

    // Add pause state tracking
    uint256 public lastPauseChange;

    event TokenListed(address indexed creatorToken);
    event TokenAutoListed(address indexed token, uint256 initialLiquidity);
    event ApprovalGranted(address indexed token, uint256 amount, uint256 timestamp);
    event ApprovalRevoked(address indexed token, uint256 timestamp);
    event PauseStateChanged(
        bool indexed isPaused,
        uint256 timestamp,
        address indexed actor
    );
    event TokenSwappedForCoral(
        address indexed token,
        uint256 amountIn,
        uint256 amountOut
    );
    event CoralSwappedForToken(
        address indexed token,
        uint256 amountIn,
        uint256 amountOut
    );

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor(
        address _coralToken,
        address _liquidityManager,
        address _dex,
        address _creatorTokenFactory
    ) Ownable(msg.sender) {
        coralToken = _coralToken;
        liquidityManager = SaraLiquidityManager(payable(_liquidityManager));
        dex = SaraDEX(payable(_dex));
        creatorTokenFactory = ICreatorCoin(_creatorTokenFactory);
    }

    /**
     * @dev Lists a new creator token in the DEX
     */
    function listNewCreatorToken(address creatorToken) public onlyOwner {
        require(!listedTokens[creatorToken], "Token already listed");
        listedTokens[creatorToken] = true;
        emit TokenListed(creatorToken);
    }

    function updateAIRebalance(address creatorToken, uint256 newReserveS) external onlyOwner {
        dex.liquidityManager().addLiquidity(creatorToken, 0, newReserveS);
    }

    /**
     * @dev Toggles pause state with optimized checks
     */
    function togglePause() external onlyOwner {
        // Check current state
        bool newState = !paused;
        
        // Return early if no change needed
        if (paused == newState) return;
        
        // Update state
        paused = newState;
        lastPauseChange = block.timestamp;
        
        // Emit event with additional tracking data
        emit PauseStateChanged(
            newState,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @dev View function to get pause state details
     */
    function getPauseState() external view returns (
        bool isPaused,
        uint256 lastChange,
        uint256 duration
    ) {
        return (
            paused,
            lastPauseChange,
            lastPauseChange > 0 ? block.timestamp - lastPauseChange : 0
        );
    }

    /**
     * @dev Safely manages token approvals - only for creator tokens
     */
    function manageApproval(address token, uint256 amount) internal {
        // Skip if it's the CORAL token (native token)
        if (token == coralToken) return;
        
        // Handle creator token approvals
        if (hasOpenApproval[token]) {
            IERC20(token).approve(address(dex.liquidityManager()), 0);
            hasOpenApproval[token] = false;
            emit ApprovalRevoked(token, block.timestamp);
        }

        IERC20(token).approve(address(dex.liquidityManager()), amount);
        hasOpenApproval[token] = true;
        lastApprovalTimestamp = block.timestamp;
        
        emit ApprovalGranted(token, amount, block.timestamp);
    }

    /**
     * @dev Auto-revokes expired approvals for creator tokens
     */
    function checkAndRevokeExpiredApprovals(address token) internal {
        // Skip if it's the CORAL token
        if (token == coralToken) return;

        if (hasOpenApproval[token] && 
            block.timestamp > lastApprovalTimestamp + APPROVAL_TIMEOUT) {
            revokeApproval(token);
        }
    }

    /**
     * @dev Explicit approval revocation for creator tokens
     */
    function revokeApproval(address token) public onlyOwner {
        // Skip if it's the CORAL token
        if (token == coralToken) return;
        
        if (hasOpenApproval[token]) {
            IERC20(token).approve(address(dex.liquidityManager()), 0);
            hasOpenApproval[token] = false;
            emit ApprovalRevoked(token, block.timestamp);
        }
    }

    /**
     * @dev Called when a new token is minted
     */
    function onTokenMinted(
        address token, 
        uint256 subscriberCount
    ) external payable whenNotPaused {
        // Check native CORAL token sent
        require(msg.value > 0, "No CORAL tokens sent");
        
        // Basic checks
        require(msg.sender == address(creatorTokenFactory), "Unauthorized");
        require(!inPriceDiscovery[token], "Token already in discovery");
        require(subscriberCount > 0, ERR_ZERO_SUBSCRIBERS);
        
        // Calculate initial liquidity
        uint256 initialLiquidity = calculateInitialLiquidity(subscriberCount);
        require(initialLiquidity > 0, ERR_ZERO_CORAL);
        
        // Verify correct amount of CORAL tokens sent
        require(msg.value == initialLiquidity, "Incorrect CORAL amount sent");

        // Start price discovery
        inPriceDiscovery[token] = true;
        dex.liquidityManager().startPriceDiscovery(token, subscriberCount);
        
        // List token (but don't add liquidity yet)
        listNewCreatorToken(token);
        
        emit TokenAutoListed(token, initialLiquidity);
    }
    
    /**
     * @dev Updates engagement metrics during price discovery
     */
    function updateEngagementMetrics(
        address token,
        uint256 currentSubscribers
    ) external onlyOwner {
        require(inPriceDiscovery[token], "Token not in discovery");
        dex.liquidityManager().recordEngagementSnapshot(token, currentSubscribers);
    }
    
    /**
     * @dev Completes price discovery and adds initial liquidity
     */
    function completePriceDiscovery(
        address token
    ) external onlyOwner {
        require(inPriceDiscovery[token], "Token not in discovery");
        
        // Get current liquidity
        uint256 currentLiquidity = IERC20(coralToken).balanceOf(address(this));
        require(currentLiquidity > 0, ERR_ZERO_CORAL);
        
        // Complete discovery and set initial liquidity
        dex.liquidityManager().completePriceDiscovery(token);
        
        // Verify liquidity after discovery
        (,uint256 sReserve) = dex.liquidityManager().getReserves(token);
        require(sReserve > 0, "Zero liquidity after discovery");
        
        // Mark discovery as complete
        inPriceDiscovery[token] = false;
    }

    /**
     * @dev Calculates initial liquidity based on subscriber count
     */
    function calculateInitialLiquidity(
        uint256 subscriberCount
    ) public pure returns (uint256) {
        require(subscriberCount > 0, ERR_ZERO_SUBSCRIBERS);
        return subscriberCount * 1e18;
    }

    /**
     * @dev Swaps CORAL tokens for creator tokens
     * @param token Creator token address
     * @param coralAmount Amount of CORAL tokens to swap
     * @param minAmountOut Minimum amount of creator tokens to receive
     * @return uint256 Amount of creator tokens received
     */
    function swapCoralForToken(
        address token,
        uint256 coralAmount,
        uint256 minAmountOut
    ) external payable returns (uint256) {
        require(token != address(0), ERR_INVALID_CREATOR);
        require(coralAmount > 0, ERR_INVALID_CORAL_AMOUNT);

        // Handle token transfer to DEX
        if (coralToken == address(0)) {
            require(msg.value == coralAmount, "Incorrect CORAL token amount sent");
        } else {
            IERC20(coralToken).safeTransferFrom(msg.sender, address(dex), coralAmount);
        }

        // Execute swap through DEX
        uint256 amountOut = dex.swapCoralForCreatorToken(
            token,
            coralAmount,
            minAmountOut,
            500 // Default max slippage of 5%
        );

        // Transfer creator tokens to user
        IERC20(token).safeTransfer(msg.sender, amountOut);

        emit CoralSwappedForToken(token, coralAmount, amountOut);
        return amountOut;
    }

    /**
     * @dev Checks if a token is native CORAL token
     * @param token Token address to check
     * @return bool True if token is native
     */
    function isNativeCoral(
        address token
    ) public view returns (bool) {
        return token == coralToken ||
               token == address(0) ||
               token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    }

    // Add receive function to handle native token
    receive() external payable {}
}
