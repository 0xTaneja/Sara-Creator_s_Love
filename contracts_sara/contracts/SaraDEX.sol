// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SaraLiquidityManager.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SaraDEX is Ownable {
    using SafeERC20 for IERC20;

    address public coralToken; // Address of Coral's native token (CORAL)
    SaraLiquidityManager public liquidityManager;
    uint256 public swapFee = 30; // 0.3% fee (divided by 10,000 for precision)

    // Add anti-bot protection
    mapping(address => uint256) public lastSwapTimestamp;
    uint256 public constant MIN_TIME_BETWEEN_SWAPS = 1 minutes;
    uint256 public constant MAX_SWAP_AMOUNT_PERCENT = 5; // 5% of reserves

    // Add fee storage tracking
    mapping(address => uint256) public storedFees;

    uint256 public constant MAX_SINGLE_SWAP = 1000 * 1e18; // 1000 tokens per swap

    // Add threshold for auto fee redeployment
    uint256 public constant AUTO_REDEPLOY_THRESHOLD = 1000 * 1e18; // 1000 tokens

    // Change from constant to immutable/variable
    uint256 public immutable DEFAULT_MAX_SLIPPAGE = 500; // 5%
    uint256 public ABSOLUTE_MAX_SLIPPAGE = 1000; // 10% initial cap
    uint256 public constant MAXIMUM_ALLOWED_SLIPPAGE = 2000; // 20% absolute maximum

    // Add error messages as constants
    string private constant ERR_SAME_VALUE = "New slippage same as current";
    string private constant ERR_LOW_SLIPPAGE = "Cannot be lower than default";
    string private constant ERR_HIGH_SLIPPAGE = "Cannot exceed 20%";
    string private constant ERR_INSUFFICIENT_CORAL = "Insufficient CORAL token balance";
    string private constant ERR_INVALID_CORAL_AMOUNT = "Invalid CORAL token amount";
    string private constant ERR_FAILED_CORAL_TRANSFER = "Failed to get CORAL tokens from Liquidity Manager";
    string private constant ERR_CORAL_SWAP_FAILED = "CORAL swap execution failed";

    event CoralSwapExecuted(
        address indexed user,
        address indexed creatorToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event CoralFeesWithdrawn(
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    // Add event for slippage updates
    event MaxSlippageUpdated(
        uint256 oldSlippage,
        uint256 newSlippage,
        address indexed updater
    );

    // Add event for failed auto-redeployments
    event CoralAutoRedeploymentFailed(address indexed token, uint256 storedFees);
    event CoralFeesRedeployed(address indexed token, uint256 amount);

    event CoralTokensRequested(address indexed token, uint256 amount, uint256 timestamp);

    // Add fee handling constants and documentation
    /**
     * @dev Constants for fee handling and auto-redeployment
     * AUTO_REDEPLOY_THRESHOLD: Minimum amount of fees before auto-redeployment (1000 CORAL)
     * MAX_FEE_STORAGE: Maximum amount of fees that can be stored (10000 CORAL)
     */
    uint256 public constant MAX_FEE_STORAGE = 10000 * 1e18; // 10000 CORAL tokens maximum storage

    // Add constants for minimum amounts
    uint256 public constant MIN_SWAP_AMOUNT = 1e15; // 0.001 tokens minimum input
    uint256 public constant MIN_OUTPUT_AMOUNT = 1e15; // 0.001 tokens minimum output

    constructor(
        address _coralToken, 
        address payable _liquidityManager
    ) Ownable(msg.sender) {  // Pass msg.sender to Ownable constructor
        coralToken = _coralToken;
        liquidityManager = SaraLiquidityManager(_liquidityManager);
    }

    function swapCreatorTokenForCoral(
        address creatorToken, 
        uint256 amountIn, 
        uint256 minAmountOut,
        uint256 maxSlippage
    ) external {
        // Anti-bot check
        require(block.timestamp >= lastSwapTimestamp[msg.sender] + MIN_TIME_BETWEEN_SWAPS, "Too many swaps");
        
        // Validate and set slippage
        require(maxSlippage <= ABSOLUTE_MAX_SLIPPAGE, "Slippage too high");
        uint256 slippageUsed = maxSlippage > 0 ? maxSlippage : DEFAULT_MAX_SLIPPAGE;
        require(slippageUsed >= DEFAULT_MAX_SLIPPAGE, "Invalid slippage");
        
        // Get reserves
        (uint256 reserveCreator, uint256 reserveCoral) = liquidityManager.getReserves(creatorToken);
        
        // Check both token liquidities
        require(amountIn <= reserveCreator, "Insufficient creator liquidity");
        require(
            hasTokenBalance(coralToken, amountIn),
            "No CORAL liquidity available"
        );
        
        // Large swap protection
        require(amountIn <= reserveCreator * MAX_SWAP_AMOUNT_PERCENT / 100, "Swap too large");

        // Calculate expected output with fees
        uint256 expectedOutput = getAmountOut(amountIn, reserveCreator, reserveCoral);
        uint256 fee = (expectedOutput * swapFee) / 10000;
        uint256 amountOutAfterFee = expectedOutput - fee;
        
        // Validate slippage with defined slippageUsed
        uint256 minAcceptableOutput = amountOutAfterFee - ((amountOutAfterFee * slippageUsed) / 10000);
        require(minAcceptableOutput >= minAmountOut, "Slippage too high");

        // Transfer creator tokens first (CEI pattern)
        require(
            IERC20(creatorToken).balanceOf(msg.sender) >= amountIn,
            "Insufficient creator token balance"
        );
        require(
            IERC20(creatorToken).allowance(msg.sender, address(this)) >= amountIn,
            "Insufficient creator token allowance"
        );
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amountIn);

        // Handle CORAL token transfer
        safeTransferCoral(msg.sender, amountOutAfterFee);
        
        // Store fees
        storeFees(creatorToken, fee);
        
        // Update state and emit event
        lastSwapTimestamp[msg.sender] = block.timestamp;
        emit CoralSwapExecuted(msg.sender, creatorToken, amountIn, amountOutAfterFee, fee);
    }

    function _executeCoralSwap(
        address creatorToken,
        uint256 amountIn,
        uint256 maxSlippage
    ) internal returns (uint256) {
        // Validate slippage
        require(maxSlippage <= ABSOLUTE_MAX_SLIPPAGE, "Slippage too high");
        uint256 slippageUsed = maxSlippage > 0 ? maxSlippage : DEFAULT_MAX_SLIPPAGE;
        require(slippageUsed >= DEFAULT_MAX_SLIPPAGE, "Invalid slippage");

        // Check creator token allowance
        require(
            IERC20(creatorToken).allowance(msg.sender, address(this)) >= amountIn,
            "Insufficient creator token allowance"
        );

        // Get reserves and validate liquidity
        (uint256 reserveCreator, uint256 reserveCoral) = liquidityManager.getReserves(creatorToken);
        require(amountIn <= reserveCreator, "Insufficient liquidity in pool");
        require(reserveCoral > amountIn, "Insufficient CORAL token liquidity");

        // Calculate output amounts
        uint256 expectedOutput = getAmountOut(amountIn, reserveCreator, reserveCoral);
        uint256 slippageAmount = (expectedOutput * slippageUsed) / 10000;
        uint256 minAcceptableOutput = expectedOutput - slippageAmount;
        
        // Calculate fees
        uint256 fee = (expectedOutput * swapFee) / 10000;
        uint256 amountOutAfterFee = expectedOutput - fee;

        // For large swaps, calculate per-swap minimum output
        if (amountIn > MAX_SINGLE_SWAP) {
            uint256 numSwaps = (amountIn + MAX_SINGLE_SWAP - 1) / MAX_SINGLE_SWAP;
            
            for (uint i = 0; i < numSwaps; i++) {
                uint256 currentSwapAmount = i == numSwaps - 1 ? 
                    amountIn - (i * MAX_SINGLE_SWAP) : 
                    MAX_SINGLE_SWAP;
                
                uint256 expectedPerSwap = (expectedOutput * currentSwapAmount) / amountIn;
                uint256 minPerSwap = expectedPerSwap - ((expectedPerSwap * slippageUsed) / 10000);
                
                uint256 receivedAmount = _executeSingleCoralSwap(creatorToken, currentSwapAmount);
                require(
                    receivedAmount >= minPerSwap,
                    "Per-swap slippage too high"
                );
                
                // Track total received amount
                amountOutAfterFee += receivedAmount;
            }
            
            // Verify total slippage after all swaps
            require(
                amountOutAfterFee >= minAcceptableOutput,
                "Total slippage too high"
            );
        } else {
            // For normal sized swaps, check total slippage
            require(amountOutAfterFee >= minAcceptableOutput, "Slippage too high");
        }

        // Ensure we have enough CORAL tokens for the swap
        ensureCoralBalance(amountOutAfterFee);

        // Checks (CEI Pattern)
        require(
            IERC20(creatorToken).balanceOf(msg.sender) >= amountIn,
            "Insufficient creator token balance"
        );
        require(
            IERC20(creatorToken).allowance(msg.sender, address(this)) >= amountIn,
            "Insufficient creator token allowance"
        );

        // Effects
        storeFees(creatorToken, fee);
        lastSwapTimestamp[msg.sender] = block.timestamp;

        // Interactions (in correct order)
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amountIn);
        safeTransferCoral(msg.sender, amountOutAfterFee);

        emit CoralSwapExecuted(msg.sender, creatorToken, amountIn, amountOutAfterFee, fee);
        return amountOutAfterFee;
    }

    function _executeSingleCoralSwap(
        address creatorToken,
        uint256 swapAmount
    ) internal returns (uint256) {
        // Get reserves
        (uint256 reserveCreator, uint256 reserveCoral) = liquidityManager.getReserves(creatorToken);
        
        // Calculate output
        uint256 expectedOutput = getAmountOut(swapAmount, reserveCreator, reserveCoral);
        uint256 fee = (expectedOutput * swapFee) / 10000;
        uint256 amountOutAfterFee = expectedOutput - fee;

        // Store fees
        storeFees(creatorToken, fee);

        return amountOutAfterFee;
    }

    /**
     * @dev Calculates the output amount for a swap
     * @param amountIn Amount of input tokens
     * @param reserveIn Reserve of input tokens
     * @param reserveOut Reserve of output tokens
     * @return uint256 Amount of output tokens after fees
     */
    function getAmountOut(
        uint256 amountIn, 
        uint256 reserveIn, 
        uint256 reserveOut
    ) public pure returns (uint256) {
        // Basic validations
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        require(amountIn <= reserveIn, "Swap amount exceeds reserves");

        // Add minimum swap amount check
        require(amountIn >= MIN_SWAP_AMOUNT, "Amount below minimum");

        // Check for potential overflow
        require(
            amountIn <= type(uint256).max / 997,
            "Amount too large for fee calculation"
        );
        require(
            reserveOut <= type(uint256).max / (amountIn * 997),
            "Potential overflow in calculation"
        );

        // Calculate with fee (0.3% fee = 997/1000)
        uint256 amountInWithFee = amountIn * 997;
        
        // Calculate output amount using constant product formula
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        
        // Calculate output with minimum check
        uint256 outputAmount = numerator / denominator;
        require(
            outputAmount >= MIN_OUTPUT_AMOUNT,
            "Swap output below minimum"
        );

        return outputAmount;
    }

    /**
     * @dev View function to simulate swap output with fees
     * @param amountIn Amount of input tokens
     * @param path Array of token addresses representing swap path
     * @return uint256 Expected output amount after fees
     */
    function getAmountOutWithFees(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256) {
        require(path.length >= 2, "Invalid path length");
        uint256 amount = amountIn;

        // Loop through path to calculate final amount
        for (uint i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = liquidityManager.getReserves(path[i+1]);
            amount = getAmountOut(amount, reserveIn, reserveOut);
        }

        // Calculate and subtract swap fee
        uint256 fee = (amount * swapFee) / 10000;
        return amount - fee;
    }

    /**
     * @dev Withdraws stored CORAL fees from the contract
     * @param token The token address to withdraw fees from
     * @param amount The amount of fees to withdraw
     */
    function withdrawStoredFees(
        address token, 
        uint256 amount
    ) external onlyOwner {
        // Validate inputs
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Invalid withdrawal amount");
        require(storedFees[token] >= amount, "Insufficient stored fees");
        require(amount <= MAX_FEE_STORAGE, "Amount exceeds maximum");

        // Update state before transfer (CEI pattern)
        storedFees[token] -= amount;
        
        // Handle transfer based on token type
        if (isNativeCoral(token)) {
            require(address(this).balance >= amount, ERR_INSUFFICIENT_CORAL);
            (bool success,) = payable(msg.sender).call{value: amount}("");
            require(success, "CORAL transfer failed");
        } else {
            require(
                IERC20(token).balanceOf(address(this)) >= amount,
                ERR_INSUFFICIENT_CORAL
            );
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        
        // Emit event with timestamp for better tracking
        emit CoralFeesWithdrawn(
            token,
            amount,
            block.timestamp
        );
    }

    /**
     * @dev Updates the maximum allowed slippage with optimizations
     * @param newMaxSlippage New maximum slippage in basis points (e.g., 1000 = 10%)
     */
    function updateMaxSlippage(uint256 newMaxSlippage) external onlyOwner {
        // Check if value is actually changing
        require(newMaxSlippage != ABSOLUTE_MAX_SLIPPAGE, ERR_SAME_VALUE);
        
        // Validate bounds
        require(newMaxSlippage >= DEFAULT_MAX_SLIPPAGE, ERR_LOW_SLIPPAGE);
        require(newMaxSlippage <= MAXIMUM_ALLOWED_SLIPPAGE, ERR_HIGH_SLIPPAGE);
        
        // Store old value for event
        uint256 oldSlippage = ABSOLUTE_MAX_SLIPPAGE;
        
        // Update slippage
        ABSOLUTE_MAX_SLIPPAGE = newMaxSlippage;
        
        // Emit event with old and new values
        emit MaxSlippageUpdated(
            oldSlippage,
            newMaxSlippage,
            msg.sender
        );
    }

    /**
     * @dev View function to validate potential slippage value
     * @param slippage Slippage value to validate
     * @return bool Valid or not
     * @return string Memory reason if invalid
     */
    function validateSlippage(
        uint256 slippage
    ) external view returns (bool, string memory) {
        if (slippage == ABSOLUTE_MAX_SLIPPAGE) return (false, ERR_SAME_VALUE);
        if (slippage < DEFAULT_MAX_SLIPPAGE) return (false, ERR_LOW_SLIPPAGE);
        if (slippage > MAXIMUM_ALLOWED_SLIPPAGE) return (false, ERR_HIGH_SLIPPAGE);
        return (true, "");
    }

    /**
     * @dev View function to get current slippage settings
     */
    function getSlippageSettings() external view returns (
        uint256 defaultSlippage,
        uint256 currentMaxSlippage,
        uint256 absoluteMaximum
    ) {
        return (
            DEFAULT_MAX_SLIPPAGE,
            ABSOLUTE_MAX_SLIPPAGE,
            MAXIMUM_ALLOWED_SLIPPAGE
        );
    }

    /**
     * @dev Checks if a token is native CORAL token and has balance
     * @param token The token address to check
     * @return bool True if token is native CORAL and has balance
     */
    function isNativeCoral(address token) public view returns (bool) {
        bool isNative = token == coralToken || 
                       token == address(0) || 
                       token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
        return isNative && address(this).balance > 0;
    }

    /**
     * @dev Checks if the contract has sufficient token balance
     * @param token The token address to check
     * @param amount The amount needed
     * @return bool True if contract has sufficient balance
     */
    function hasTokenBalance(address token, uint256 amount) public view returns (bool) {
        if (token == coralToken) {
            return isNativeCoral(token) ? 
                address(this).balance >= amount : 
                IERC20(token).balanceOf(address(this)) >= amount;
        }
        return IERC20(token).balanceOf(address(this)) >= amount;
    }

    // Add receive function to accept native CORAL token
    receive() external payable {}

    /**
     * @dev Swaps CORAL tokens for Creator tokens
     * @param creatorToken The creator token to receive
     * @param amountIn Amount of CORAL tokens to swap
     * @param minAmountOut Minimum amount of creator tokens to receive
     * @param maxSlippage Maximum allowed slippage in basis points (e.g., 500 = 5%)
     */
    function swapCoralForCreatorToken(
        address creatorToken,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 maxSlippage
    ) external payable returns (uint256) {
        // Anti-bot check
        require(block.timestamp >= lastSwapTimestamp[msg.sender] + MIN_TIME_BETWEEN_SWAPS, "Too many swaps");
        
        // Validate and set slippage
        require(maxSlippage <= ABSOLUTE_MAX_SLIPPAGE, "Slippage too high");
        uint256 slippageUsed = maxSlippage > 0 ? maxSlippage : DEFAULT_MAX_SLIPPAGE;
        require(slippageUsed >= DEFAULT_MAX_SLIPPAGE, "Invalid slippage");
        
        // Get reserves
        (uint256 reserveCreator, uint256 reserveCoral) = liquidityManager.getReserves(creatorToken);
        // Check both CORAL and creator token liquidity
        require(
            hasTokenBalance(coralToken, amountIn),
            "No CORAL liquidity available"
        );
        require(amountIn <= reserveCoral, "Insufficient CORAL in pool");
        require(reserveCreator > 0, "No creator token liquidity");
        
        // Large swap protection
        require(amountIn <= reserveCoral * MAX_SWAP_AMOUNT_PERCENT / 100, "Swap too large");

        // Calculate expected output with fees
        uint256 expectedOutput = getAmountOut(amountIn, reserveCoral, reserveCreator);
        uint256 fee = (expectedOutput * swapFee) / 10000;
        uint256 amountOutAfterFee = expectedOutput - fee;
        
        // Validate slippage with defined slippageUsed
        uint256 minAcceptableOutput = amountOutAfterFee - ((amountOutAfterFee * slippageUsed) / 10000);
        require(minAcceptableOutput >= minAmountOut, "Slippage too high");
        
        // Handle CORAL token transfer based on type
        if (isNativeCoral(coralToken)) {
            require(msg.value == amountIn, "Must send exact amount of native CORAL");
        } else {
            // Check balance and allowance
            require(
                IERC20(coralToken).balanceOf(msg.sender) >= amountIn,
                ERR_INSUFFICIENT_CORAL
            );
            require(
                IERC20(coralToken).allowance(msg.sender, address(this)) >= amountIn,
                "Insufficient CORAL token allowance"
            );
            IERC20(coralToken).safeTransferFrom(msg.sender, address(this), amountIn);
        }
        
        // Transfer creator tokens to user
        require(
            IERC20(creatorToken).balanceOf(address(this)) >= amountOutAfterFee,
            "Insufficient creator token balance"
        );
        IERC20(creatorToken).safeTransfer(msg.sender, amountOutAfterFee);
        
        // Store fees
        storeFees(creatorToken, fee);
        
        // Update state and emit event
        lastSwapTimestamp[msg.sender] = block.timestamp;
        emit CoralSwapExecuted(msg.sender, creatorToken, amountIn, amountOutAfterFee, fee);
        return amountOutAfterFee;
    }

    // Add helper function to check native CORAL balance
    /**
     * @dev Returns the contract's native CORAL balance
     * @return uint256 The contract's native CORAL balance
     */
    function getNativeCoralBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Add helper function to check if contract can handle native CORAL
    /**
     * @dev Checks if contract can handle native CORAL transactions
     * @return bool True if contract can handle native CORAL
     */
    function canHandleNativeCoral() public view returns (bool) {
        return isNativeCoral(coralToken);
    }

    /**
     * @dev Safely transfers CORAL tokens to recipient
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return bool True if transfer was successful
     */
    function safeTransferCoral(address to, uint256 amount) internal returns (bool) {
        // Input validation
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(amount <= type(uint256).max, "Amount too large");

        if (isNativeCoral(coralToken)) {
            // Check native CORAL balance
            uint256 contractBalance = address(this).balance;
            require(contractBalance >= amount, ERR_INSUFFICIENT_CORAL);
            
            // Cache balance before transfer for verification
            uint256 preBalance = contractBalance;
            
            // Attempt native transfer
            (bool success,) = payable(to).call{value: amount}("");
            require(success, ERR_FAILED_CORAL_TRANSFER);
            
            // Verify transfer amount
            require(
                address(this).balance == preBalance - amount,
                "Transfer amount mismatch"
            );
        } else {
            // Check ERC20 CORAL balance
            uint256 erc20Balance = IERC20(coralToken).balanceOf(address(this));
            require(erc20Balance >= amount, ERR_INSUFFICIENT_CORAL);
            
            uint256 preBalance = erc20Balance;
            
            // Use regular safeTransfer since it already has revert handling
            IERC20(coralToken).safeTransfer(to, amount);
            
            // Verify transfer
            uint256 postBalance = IERC20(coralToken).balanceOf(address(this));
            require(
                postBalance == preBalance - amount,
                "Transfer amount mismatch"
            );
        }

        // Emit event for tracking
        emit CoralTransferred(to, amount, block.timestamp);
        return true;
    }

    // Add event for CORAL transfers
    event CoralTransferred(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // Update fee storage logic
    function storeFees(address token, uint256 fee) internal {
        // Check maximum fee storage
        require(
            storedFees[token] + fee <= MAX_FEE_STORAGE,
            "Fee storage limit reached"
        );

        storedFees[token] += fee;
        
        // Check for auto fee redeployment
        if (storedFees[token] >= AUTO_REDEPLOY_THRESHOLD) {
            uint256 currentFees = storedFees[token];

            try liquidityManager.autoRedeployFees(token) {
                storedFees[token] = 0;
                emit CoralFeesRedeployed(token, currentFees);
            } catch {
                emit CoralAutoRedeploymentFailed(token, currentFees);
            }
        }
    }

    /**
     * @dev View function to check withdrawable fees
     * @param token The token address to check
     * @return uint256 Amount of withdrawable fees
     */
    function getWithdrawableFees(
        address token
    ) external view returns (uint256) {
        return storedFees[token];
    }

    /**
     * @dev Ensures the contract has enough CORAL tokens for a swap
     * @param amount Amount of CORAL tokens needed
     */
    function ensureCoralBalance(uint256 amount) internal {
        if (isNativeCoral(coralToken)) {
            require(address(this).balance >= amount, ERR_INSUFFICIENT_CORAL);
            return;
        }
        
        uint256 dexBalance = IERC20(coralToken).balanceOf(address(this));
        if (dexBalance >= amount) return;
        
        uint256 needed = amount - dexBalance;
        uint256 lmBalance = IERC20(coralToken).balanceOf(address(liquidityManager));
        require(lmBalance >= needed, ERR_INSUFFICIENT_CORAL);
        
        liquidityManager.transferCoralToDEX(needed);
        require(
            IERC20(coralToken).balanceOf(address(this)) >= amount,
            ERR_FAILED_CORAL_TRANSFER
        );
    }

    /**
     * @dev View function to check if fees need redeployment
     * @param token The token to check
     * @return needsRedeploy True if fees exceed threshold
     * @return amount Amount that can be redeployed
     */
    function checkFeesForRedeployment(
        address token
    ) external view returns (
        bool needsRedeploy,
        uint256 amount
    ) {
        uint256 currentFees = storedFees[token];
        needsRedeploy = currentFees >= AUTO_REDEPLOY_THRESHOLD;
        amount = needsRedeploy ? currentFees : 0;
    }

    /**
     * @dev Checks if a swap amount is valid
     * @param amount Amount to validate
     * @return bool True if amount is valid for swapping
     */
    function isValidSwapAmount(uint256 amount) public pure returns (bool) {
        return amount >= MIN_SWAP_AMOUNT && 
               amount <= MAX_SINGLE_SWAP;
    }
}