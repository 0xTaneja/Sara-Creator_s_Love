// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SaraDEX.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Add CreatorCoin interface with the methods we need
interface ICreatorCoin {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract SaraTokenRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Add withdrawal reason tracking
    enum WithdrawReason { ADMIN_OVERRIDE, MIGRATION, CONTRACT_ERROR }

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
    event PriceDiscoveryFailed(address indexed token, uint256 timestamp);
    event PriceDiscoveryCompleted(address indexed token, uint256 timestamp);
    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 timestamp,
        WithdrawReason reason
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

    /**
     * @dev Updates AI rebalance through liquidity manager
     */
    function updateAIRebalance(
        address creatorToken, 
        uint256 newReserveS
    ) external onlyOwner {
        // Direct call to liquidity manager
        liquidityManager.addLiquidity(creatorToken, 0, newReserveS);
    }

    /**
     * @dev Toggles pause state with simplified logic
     */
    function togglePause() external onlyOwner {
        paused = !paused;
        lastPauseChange = block.timestamp;
        
        emit PauseStateChanged(
            paused,
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
     * @dev Safely manages token approvals with optimized approval handling
     */
    function manageApproval(address token, uint256 amount) internal {
        if (token == coralToken) return;

        uint256 currentAllowance = IERC20(token).allowance(address(this), address(liquidityManager));

        if (hasOpenApproval[token] && currentAllowance > 0) {
            IERC20(token).approve(address(liquidityManager), 0);  // Use regular approve for resetting
            hasOpenApproval[token] = false;
            emit ApprovalRevoked(token, block.timestamp);
        }

        if (currentAllowance < amount) {
            if (currentAllowance > 0) {
                IERC20(token).approve(address(liquidityManager), 0);  // Use regular approve for resetting
            }
            IERC20(token).approve(address(liquidityManager), amount);  // Use regular approve for setting
            hasOpenApproval[token] = true;
            lastApprovalTimestamp = block.timestamp;
            emit ApprovalGranted(token, amount, block.timestamp);
        }
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
     * @dev Explicit approval revocation with optimization
     */
    function revokeApproval(address token) public onlyOwner {
        // Skip if it's the CORAL token
        if (token == coralToken) return;
        
        // Check current allowance first
        uint256 currentAllowance = IERC20(token).allowance(
            address(this), 
            address(liquidityManager)
        );
        
        // Only revoke if there's an allowance
        if (currentAllowance > 0 && hasOpenApproval[token]) {
            IERC20(token).approve(address(liquidityManager), 0);
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
    ) external whenNotPaused {
        // Basic checks
        require(msg.sender == address(creatorTokenFactory), "Unauthorized");
        require(!inPriceDiscovery[token], "Token already in discovery");
        require(subscriberCount > 0, ERR_ZERO_SUBSCRIBERS);
        
        // Calculate initial liquidity
        uint256 initialLiquidity = calculateInitialLiquidity(subscriberCount);
        require(initialLiquidity > 0, ERR_ZERO_CORAL);
        
        // Check allowance before transfer
        require(
            IERC20(coralToken).allowance(msg.sender, address(this)) >= initialLiquidity,
            "Insufficient CORAL allowance"
        );
        
        // Transfer CORAL tokens from sender
        IERC20(coralToken).safeTransferFrom(msg.sender, address(this), initialLiquidity);

        // Mark token as in price discovery before external calls
        inPriceDiscovery[token] = true;

        // Direct call to liquidityManager
        liquidityManager.startPriceDiscovery(token, subscriberCount);
        
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
        liquidityManager.recordEngagementSnapshot(token, currentSubscribers);
    }
    
    /**
     * @dev Completes price discovery with improved validation and re-entrancy protection
     */
    function completePriceDiscovery(
        address token
    ) external onlyOwner nonReentrant {
        require(inPriceDiscovery[token], "Token not in discovery");

        uint256 currentLiquidity = IERC20(coralToken).balanceOf(address(this));
        require(currentLiquidity > 0, ERR_ZERO_CORAL);

        uint256 initialReserve;
        (, initialReserve) = liquidityManager.getReserves(token);

        // Update state first to prevent re-entrancy
        inPriceDiscovery[token] = false;

        // External interactions after state changes (CEI pattern)
        liquidityManager.completePriceDiscovery(token);

        (, uint256 sReserve) = liquidityManager.getReserves(token);
        require(sReserve > initialReserve, "Liquidity not added");

        emit PriceDiscoveryCompleted(token, block.timestamp);
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
     * @dev Swaps CORAL tokens for creator tokens with optimized approval handling
     */
    function swapCoralForToken(
        address token,
        uint256 coralAmount,
        uint256 minAmountOut
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(token != address(0), ERR_INVALID_CREATOR);
        require(coralAmount > 0, ERR_INVALID_CORAL_AMOUNT);
        require(!inPriceDiscovery[token], "Token in price discovery");
        require(listedTokens[token], "Token not listed");

        // Transfer CORAL tokens to contract
        IERC20(coralToken).safeTransferFrom(msg.sender, address(this), coralAmount);

        // Optimize approval handling: Only update if less than required
        uint256 currentAllowance = IERC20(coralToken).allowance(address(this), address(dex));
        if (currentAllowance < coralAmount) {
            if (currentAllowance > 0) {
                IERC20(coralToken).approve(address(dex), 0);  // Use regular approve for resetting
            }
            IERC20(coralToken).approve(address(dex), coralAmount);  // Use regular approve for setting
        }

        // Execute swap through DEX
        uint256 amountOut = dex.swapCoralForCreatorToken(
            token,
            coralAmount,
            minAmountOut,
            500 // Default max slippage of 5%
        );

        require(amountOut >= minAmountOut, "Slippage too high");

        // Emit event before transfer (CEI pattern)
        emit CoralSwappedForToken(token, coralAmount, amountOut);

        // Transfer creator tokens to user
        IERC20(token).safeTransfer(msg.sender, amountOut);

        return amountOut;
    }

    /**
     * @dev Emergency function to withdraw stuck CORAL tokens with reason tracking
     * @param to Address to send CORAL tokens to
     * @param amount Amount of CORAL tokens to withdraw
     * @param reason Reason for emergency withdrawal
     */
    function emergencyWithdrawCoral(
        address to, 
        uint256 amount,
        WithdrawReason reason
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(!paused, "Contract is paused");

        uint256 balance = IERC20(coralToken).balanceOf(address(this));
        require(amount <= balance, "Insufficient CORAL balance");
        
        // Emit event before transfer (CEI pattern)
        emit EmergencyWithdraw(coralToken, to, amount, block.timestamp, reason);
        
        // Transfer CORAL tokens
        IERC20(coralToken).safeTransfer(to, amount);
    }
}
