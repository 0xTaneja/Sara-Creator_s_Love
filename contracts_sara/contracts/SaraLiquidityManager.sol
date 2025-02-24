// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SaraLiquidityManager is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public creatorTokenReserves;
    mapping(address => uint256) public coralReserves;
    mapping(address => uint256) public collectedFees;

    address public coralToken;
    
    uint256 public constant REBALANCE_INTERVAL = 2 minutes;
    uint256 public lastRebalanceTimestamp;
    uint256 public constant ENGAGEMENT_THRESHOLD = 1000; // 10% in basis points

    struct EngagementMetrics {
        uint256 lastSubscriberCount;
        uint256 smoothedSubscriberCount;
        uint256 lastUpdateTime;
        uint256 updateCount;
    }
    
    mapping(address => EngagementMetrics) public tokenEngagement;

    // Add constant for minimum liquidity
    uint256 public constant MIN_LIQUIDITY = 10 * 1e18; // 10 CORAL minimum liquidity

    // Add new event
    event FeesRedeployed(
        address indexed token,
        uint256 amount,
        address indexed targetPool
    );

    // Add minimum fee threshold for redeployment
    uint256 public constant MIN_FEES_FOR_REDEPLOY = 5 * 1e18; // 5 CORAL minimum fees

    // Add new struct for token price discovery
    struct PriceDiscoveryData {
        uint256 initialSubscribers;
        uint256 currentSubscribers;
        uint256 observationStartTime;
        bool isInDiscovery;
        uint256[] engagementSnapshots;
    }
    
    // Add mapping for price discovery
    mapping(address => PriceDiscoveryData) public priceDiscovery;
    
    // Constants for price discovery
    uint256 public constant DISCOVERY_PERIOD = 2 minutes;
    uint256 public constant SNAPSHOT_INTERVAL = 20 seconds;
    uint256 public constant MAX_SNAPSHOTS = 6; // 2 minutes / 20 seconds
    
    // Events
    event PriceDiscoveryStarted(address indexed token, uint256 initialSubscribers);
    event PriceDiscoveryCompleted(
        address indexed token, 
        uint256 initialCoralPrice,
        uint256 initialLiquidity
    );
    event EngagementSnapshotTaken(
        address indexed token,
        uint256 subscribers,
        uint256 timestamp
    );

    // Add array to track all pools
    address[] public trackedPools;
    mapping(address => bool) public isTrackedPool;

    // Add event for pool tracking
    event PoolTracked(address indexed pool);
    event PoolUntracked(address indexed pool);

    // Add constant for minimum token price
    uint256 public constant MIN_TOKEN_PRICE = 0.1e18; // 0.1 CORAL minimum price

    // Add price protection constants
    uint256 public constant MAX_PRICE_MULTIPLIER = 3; // 3x cap on price increase
    uint256 public constant BASE_PRICE = 1e18; // 1 S token base price

    // Add new event for auto fee redeployment
    event AutoFeesRedeployed(
        address indexed token,
        uint256 amount,
        address indexed targetPool,
        uint256 coralAmount,
        uint256 timestamp
    );

    // Add constants for smoothing
    uint256 private constant WEIGHT_PREVIOUS = 80;
    uint256 private constant WEIGHT_NEW = 20;
    uint256 private constant REBALANCE_THRESHOLD = 110; // 10% above smoothed value
    uint256 private constant MIN_UPDATES_BEFORE_REBALANCE = 3;

    // Add event for smoothed metrics
    event EngagementSmoothed(
        address indexed token,
        uint256 rawCount,
        uint256 smoothedCount,
        uint256 timestamp
    );

    // Add trading activity tracking
    struct PoolActivity {
        uint256 lastTradeTimestamp;
        uint256 tradingVolume24h;
        uint256 lastVolumeUpdateTime;
    }
    
    mapping(address => PoolActivity) public poolActivity;
    
    // Add constants for activity checks
    uint256 public constant ACTIVITY_THRESHOLD = 7 days;
    uint256 public constant MIN_24H_VOLUME = 10 * 1e18; // 10 CORAL minimum volume
    
    // Add event for activity updates
    event PoolActivityUpdated(
        address indexed pool,
        uint256 volume24h,
        uint256 timestamp
    );

    // Add error messages as constants
    string private constant ERR_NO_FEES = "No fees available to redeploy";
    string private constant ERR_BELOW_MIN = "Below minimum fee threshold";
    string private constant ERR_INSUFFICIENT_CORAL = "Insufficient CORAL token balance";
    string private constant ERR_BELOW_MIN_CORAL = "Below minimum CORAL token liquidity";

    // Add DEX reference
    address public dex;
    
    // Add role for DEX
    bytes32 public constant DEX_ROLE = keccak256("DEX_ROLE");

    // Add state variables for tracking most needy pool
    struct PoolNeedInfo {
        address pool;
        uint256 score;
        uint256 lastUpdateTime;
    }

    PoolNeedInfo public mostNeededPool;
    uint256 public constant POOL_NEED_UPDATE_INTERVAL = 1 hours;

    // Add event for pool need updates
    event PoolNeedUpdated(
        address indexed pool,
        uint256 score,
        uint256 timestamp
    );

    constructor(address _coralToken) Ownable(msg.sender) {
        coralToken = _coralToken;
    }

    event LiquidityAdded(
        address indexed creatorToken, 
        uint256 amountCreator, 
        uint256 amountCoral
    );
    event LiquidityRemoved(
        address indexed creatorToken, 
        uint256 amountCreator, 
        uint256 amountCoral
    );
    event FeesCollected(address indexed token, uint256 amount);
    event LiquidityRebalanced(
        address indexed token, 
        uint256 newReserveCoral
    );
    event FeesWithdrawn(address indexed token, uint256 amount);

    // Add function to track new pool
    function addPoolToTracking(address pool) internal {
        if (!isTrackedPool[pool]) {
            trackedPools.push(pool);
            isTrackedPool[pool] = true;
            emit PoolTracked(pool);
        }
    }

    /**
     * @dev Checks if a token is native CORAL token
     * @param token The token address to check
     * @return bool True if token is native CORAL
     */
     function isNativeCoral(address token) public view returns (bool) 
     {
     return token == coralToken ||
           token == address(0) ||
           token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
     }


    /**
     * @dev Adds liquidity to a pool with proper validation
     * @param creatorToken The creator token address
     * @param amountCreator Amount of creator tokens to add
     * @param amountCoral Amount of CORAL tokens to add
     */
    function addLiquidity(
        address creatorToken, 
        uint256 amountCreator, 
        uint256 amountCoral
    ) external payable {
        require(amountCreator > 0 && amountCoral > 0, "Invalid liquidity amounts");
        require(creatorToken != address(0), "Invalid creator token");

        // Check if this is the first liquidity addition
        bool isInitialLiquidity = creatorTokenReserves[creatorToken] == 0 && 
                                 coralReserves[creatorToken] == 0;

        // Only enforce MIN_LIQUIDITY for subsequent additions
        if (!isInitialLiquidity) {
            require(
                creatorTokenReserves[creatorToken] + amountCreator >= MIN_LIQUIDITY &&
                coralReserves[creatorToken] + amountCoral >= MIN_LIQUIDITY,
                "Below minimum liquidity"
            );
        }

        // Transfer creator tokens to this contract
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amountCreator);

        // Handle CORAL token transfer
        if (isNativeCoral(coralToken)) {
            require(msg.value == amountCoral, "Incorrect CORAL amount");
        } else {
            IERC20(coralToken).safeTransferFrom(msg.sender, address(this), amountCoral);
        }

        // Update reserves
        creatorTokenReserves[creatorToken] += amountCreator;
        coralReserves[creatorToken] += amountCoral;

        // Add pool to tracking if needed
        addPoolToTracking(creatorToken);
        
        emit LiquidityAdded(creatorToken, amountCreator, amountCoral);
    }

    // Update removeLiquidity
    function removeLiquidity(
        address creatorToken, 
        uint256 amountCreator, 
        uint256 amountCoral
    ) external onlyOwner {
        // Basic checks
        require(creatorTokenReserves[creatorToken] >= amountCreator, "Insufficient creator liquidity");
        require(coralReserves[creatorToken] >= amountCoral, "Insufficient CORAL liquidity");

        // Add minimum liquidity check
        require(
            creatorTokenReserves[creatorToken] - amountCreator >= MIN_LIQUIDITY,
            "Cannot remove all liquidity"
        );
        require(
            coralReserves[creatorToken] - amountCoral >= MIN_LIQUIDITY,
            "Cannot remove all liquidity"
        );

        // Effects - Update reserves first
        creatorTokenReserves[creatorToken] -= amountCreator;
        coralReserves[creatorToken] -= amountCoral;

        // Interactions - Handle transfers
        if (isNativeCoral(coralToken)) {
            // Handle native CORAL token
            require(address(this).balance >= amountCoral, "Insufficient CORAL balance");
            (bool success,) = payable(msg.sender).call{value: amountCoral}("");
            require(success, "CORAL token transfer failed");
        } else {
            // Handle creator token (ERC20)
            IERC20(creatorToken).safeTransfer(msg.sender, amountCreator);
        }

        emit LiquidityRemoved(creatorToken, amountCreator, amountCoral);
    }

    function collectFees(address token, uint256 amount) external {
        collectedFees[token] += amount;
        emit FeesCollected(token, amount);
    }

    /**
     * @dev Returns the current reserves for a creator token pair
     * @param creatorToken The address of the creator token
     * @return creatorReserve The amount of creator tokens in reserve
     * @return coralReserve The amount of CORAL tokens in reserve
     */
    function getReserves(
        address creatorToken
    ) external view returns (
        uint256 creatorReserve,
        uint256 coralReserve
    ) {
        require(creatorToken != address(0), "Invalid creator token address");
        require(isTrackedPool[creatorToken], "Pool not tracked");

        creatorReserve = creatorTokenReserves[creatorToken];
        
        if (isNativeCoral(coralToken)) {
            coralReserve = address(this).balance;
        } else {
            coralReserve = coralReserves[creatorToken];
        }

        // Return reserves even if below minimum
        return (creatorReserve, coralReserve);
    }

    /**
     * @dev View function to check if a pool has minimum liquidity
     * @param creatorToken The creator token to check
     * @return bool True if pool has minimum liquidity
     */
    function hasMinimumLiquidity(
        address creatorToken
    ) public view returns (bool) {
        (uint256 creator, uint256 coral) = this.getReserves(creatorToken);
        return creator >= MIN_LIQUIDITY && coral >= MIN_LIQUIDITY;
    }

    function withdrawFees(address token, uint256 amount) external onlyOwner {
        // Checks
        require(collectedFees[token] >= amount, "Insufficient fees");

        // Effects
        collectedFees[token] -= amount;

        // Interactions
        IERC20(token).safeTransfer(msg.sender, amount);

        emit FeesWithdrawn(token, amount);
    }

    /**
     * @dev Calculates smoothed engagement using weighted moving average
     */
    function calculateSmoothedEngagement(
        uint256 previous,
        uint256 current
    ) internal pure returns (uint256) {
        return (
            (previous * WEIGHT_PREVIOUS / 100) + 
            (current * WEIGHT_NEW / 100)
        );
    }

    /**
     * @dev Updates engagement metrics with smoothing
     */
    function updateEngagementMetrics(
        address token, 
        uint256 newSubscriberCount
    ) external onlyOwner {
        EngagementMetrics storage metrics = tokenEngagement[token];
        
        // Initialize if first update
        if (metrics.lastSubscriberCount == 0) {
            metrics.lastSubscriberCount = newSubscriberCount;
            metrics.smoothedSubscriberCount = newSubscriberCount;
            metrics.updateCount = 1;
            return;
        }

        // Calculate smoothed value
        uint256 newSmoothedCount = calculateSmoothedEngagement(
            metrics.smoothedSubscriberCount,
            newSubscriberCount
        );

        // Update metrics
        metrics.lastSubscriberCount = newSubscriberCount;
        metrics.smoothedSubscriberCount = newSmoothedCount;
        metrics.lastUpdateTime = block.timestamp;
        metrics.updateCount++;

        emit EngagementSmoothed(
            token,
            newSubscriberCount,
            newSmoothedCount,
            block.timestamp
        );

        // Check if rebalance needed (only after minimum updates)
        if (metrics.updateCount >= MIN_UPDATES_BEFORE_REBALANCE) {
            uint256 rebalanceThreshold = (metrics.smoothedSubscriberCount * REBALANCE_THRESHOLD) / 100;
            
            if (newSubscriberCount > rebalanceThreshold) {
                _rebalanceLiquidity(token, metrics.smoothedSubscriberCount);
            }
        }
    }

    /**
     * @dev View function to get smoothed engagement metrics
     */
    function getSmoothedMetrics(
        address token
    ) external view returns (
        uint256 lastCount,
        uint256 smoothedCount,
        uint256 updateCount,
        bool eligibleForRebalance
    ) {
        EngagementMetrics storage metrics = tokenEngagement[token];
        return (
            metrics.lastSubscriberCount,
            metrics.smoothedSubscriberCount,
            metrics.updateCount,
            metrics.updateCount >= MIN_UPDATES_BEFORE_REBALANCE
        );
    }

    /**
     * @dev Optimized rebalancing with minimum liquidity check
     */
    function _rebalanceLiquidity(address token, uint256 subscriberCount) internal {
        // Skip if pool has insufficient liquidity
        if (coralReserves[token] < MIN_LIQUIDITY) {
            emit RebalanceSkipped(token, coralReserves[token], "Insufficient liquidity");
            return;
        }

        // AI-based liquidity calculation
        uint256 newReserveCoral = calculateOptimalLiquidity(subscriberCount);
        
        // Update liquidity
        coralReserves[token] = newReserveCoral;
        
        emit LiquidityRebalanced(token, newReserveCoral);
    }

    function calculateOptimalLiquidity(uint256 subscriberCount) internal pure returns (uint256) {
        // Initial simple formula, can be enhanced with AI later
        return subscriberCount * 1e18;
    }

    // Daily rebalance check
    function checkAndRebalance(address token) external {
        require(
            block.timestamp >= lastRebalanceTimestamp + REBALANCE_INTERVAL,
            "Too early for rebalance"
        );
        
        EngagementMetrics storage metrics = tokenEngagement[token];
        _rebalanceLiquidity(token, metrics.lastSubscriberCount);
        lastRebalanceTimestamp = block.timestamp;
    }

    /**
     * @dev Redeploys collected fees to target pool with proper token handling
     * @param token The token address whose fees to redeploy
     * @param targetPool The pool to receive the fees
     */
    function redeployFees(
        address token, 
        address targetPool
    ) public onlyOwner {
        // Check fee amount
        uint256 feeAmount = collectedFees[token];
        require(feeAmount > 0, ERR_NO_FEES);
        require(feeAmount >= MIN_FEES_FOR_REDEPLOY, ERR_BELOW_MIN);

        // Update state before transfer
        collectedFees[token] -= feeAmount;

        if (isNativeCoral(coralToken)) {
            // Handle native S token
            require(address(this).balance >= feeAmount, "Insufficient S balance");
            coralReserves[targetPool] += feeAmount;
            emit FeesRedeployed(token, feeAmount, targetPool);
        } else {
            // Handle ERC20 token
            require(IERC20(token).balanceOf(address(this)) >= feeAmount, "Insufficient token balance");
            IERC20(token).safeTransfer(targetPool, feeAmount);
            emit FeesRedeployed(token, feeAmount, targetPool);
        }
    }

    /**
     * @dev Auto redeploys fees when threshold is reached
     * @param token The token address whose fees to redeploy
     */
    function autoRedeployFees(address token) external onlyDEX {
        uint256 feeAmount = collectedFees[token];
        
        // Basic checks
        require(feeAmount > 0, ERR_NO_FEES);
        require(feeAmount >= MIN_FEES_FOR_REDEPLOY, ERR_BELOW_MIN);

        // Find optimal pool for redeployment
        address targetPool = findOptimalRedeploymentPool();
        require(targetPool != address(0), "No suitable pool found");

        // Calculate optimal deployment amount
        uint256 deployAmount = calculateOptimalDeployment(targetPool, feeAmount);
        require(deployAmount > 0, "No deployment needed");
        require(deployAmount <= feeAmount, "Deploy amount exceeds available fees");

        // Update state before transfers
        collectedFees[token] -= deployAmount;

        // Handle token transfers based on type
        if (isNativeCoral(coralToken)) {
            // Handle native S token
            require(address(this).balance >= deployAmount, "Insufficient S balance");
            coralReserves[targetPool] += deployAmount;
        } else {
            // Handle ERC20 token
            require(IERC20(token).balanceOf(address(this)) >= deployAmount, "Insufficient token balance");
            IERC20(token).safeTransfer(targetPool, deployAmount);
        }

        emit AutoFeesRedeployed(token, deployAmount, targetPool, deployAmount, block.timestamp);
    }

    /**
     * @dev Optimized pool selection using cached value
     */
    function findOptimalRedeploymentPool() internal returns (address) {
        // Return cached value if recent enough
        if (
            mostNeededPool.pool != address(0) &&
            block.timestamp < mostNeededPool.lastUpdateTime + POOL_NEED_UPDATE_INTERVAL
        ) {
            // Verify pool is still valid
            if (
                isTrackedPool[mostNeededPool.pool] &&
                isPoolActive(mostNeededPool.pool)
            ) {
                return mostNeededPool.pool;
            }
        }

        // If cache is stale or invalid, update it
        updateMostNeededPool();
        return mostNeededPool.pool;
    }

    /**
     * @dev Updates the cached most needy pool
     */
    function updateMostNeededPool() internal {
        // Reset current best
        mostNeededPool.pool = address(0);
        mostNeededPool.score = 0;

        // Cache array length
        uint256 poolCount = trackedPools.length;
        if (poolCount == 0) return;

        // Cache current time
        uint256 currentTime = block.timestamp;
        uint256 activityCutoff = currentTime - ACTIVITY_THRESHOLD;

        // Single pass through pools
        for (uint256 i = 0; i < poolCount; i++) {
            address pool = trackedPools[i];
            
            // Skip inactive pools
            PoolActivity memory activity = poolActivity[pool];
            if (
                !isTrackedPool[pool] || 
                activity.lastTradeTimestamp < activityCutoff || 
                activity.tradingVolume24h < MIN_24H_VOLUME
            ) {
                continue;
            }
            
            // Calculate pool score
            uint256 score = calculatePoolScore(pool);
            
            // Update if better score found
            if (score > mostNeededPool.score) {
                mostNeededPool.pool = pool;
                mostNeededPool.score = score;
            }
        }

        // Update timestamp and emit event
        mostNeededPool.lastUpdateTime = currentTime;
        emit PoolNeedUpdated(
            mostNeededPool.pool,
            mostNeededPool.score,
            currentTime
        );
    }

    /**
     * @dev Force update of pool needs (public for external triggers)
     */
    function forcePoolNeedUpdate() external onlyOwner {
        updateMostNeededPool();
    }

    /**
     * @dev View function to get current pool need info
     */
    function getPoolNeedInfo() external view returns (
        address pool,
        uint256 score,
        uint256 lastUpdate,
        bool isStale
    ) {
        return (
            mostNeededPool.pool,
            mostNeededPool.score,
            mostNeededPool.lastUpdateTime,
            block.timestamp >= mostNeededPool.lastUpdateTime + POOL_NEED_UPDATE_INTERVAL
        );
    }

    /**
     * @dev Allows removal of inactive pools from tracking
     */
    function removePoolFromTracking(address pool) external onlyOwner {
        require(isTrackedPool[pool], "Pool not tracked");
        
        // Find and remove from array
        for (uint i = 0; i < trackedPools.length; i++) {
            if (trackedPools[i] == pool) {
                // Move last element to this position (unless we're at the end)
                if (i != trackedPools.length - 1) {
                    trackedPools[i] = trackedPools[trackedPools.length - 1];
                }
                trackedPools.pop();
                break;
            }
        }
        
        isTrackedPool[pool] = false;
        emit PoolUntracked(pool);
    }

    /**
     * @dev View function to get all tracked pools
     */
    function getTrackedPools() external view returns (address[] memory) {
        return trackedPools;
    }

    /**
     * @dev Starts price discovery period for a new token
     */
    function startPriceDiscovery(
        address token,
        uint256 initialSubscribers
    ) external onlyOwner {
        require(!priceDiscovery[token].isInDiscovery, "Already in discovery");
        
        priceDiscovery[token] = PriceDiscoveryData({
            initialSubscribers: initialSubscribers,
            currentSubscribers: initialSubscribers,
            observationStartTime: block.timestamp,
            isInDiscovery: true,
            engagementSnapshots: new uint256[](0)
        });
        
        emit PriceDiscoveryStarted(token, initialSubscribers);
    }

    /**
     * @dev Records engagement snapshot during discovery period
     */
    function recordEngagementSnapshot(
        address token,
        uint256 currentSubscribers
    ) external onlyOwner {
        PriceDiscoveryData storage data = priceDiscovery[token];
        require(data.isInDiscovery, "Not in discovery");
        require(
            data.engagementSnapshots.length < MAX_SNAPSHOTS,
            "Max snapshots reached"
        );
        
        data.engagementSnapshots.push(currentSubscribers);
        data.currentSubscribers = currentSubscribers;
        
        emit EngagementSnapshotTaken(token, currentSubscribers, block.timestamp);
        
        // If we have enough snapshots, complete discovery
        if (data.engagementSnapshots.length == MAX_SNAPSHOTS) {
            completePriceDiscovery(token);
        }
    }

    /**
     * @dev Completes price discovery and sets initial liquidity
     */
    function completePriceDiscovery(address token) public onlyOwner {
        PriceDiscoveryData storage data = priceDiscovery[token];
        require(data.isInDiscovery, "Not in discovery");
        require(
            block.timestamp >= data.observationStartTime + DISCOVERY_PERIOD,
            "Discovery period not complete"
        );
        
        // Calculate optimal initial price based on engagement trends
        uint256 initialPrice = calculateInitialPrice(token);
        uint256 initialLiquidity = calculateInitialLiquidity(
            data.currentSubscribers,
            initialPrice
        );
        
        // Set initial liquidity
        coralReserves[token] = initialLiquidity;
        
        // Mark discovery as complete
        data.isInDiscovery = false;
        
        emit PriceDiscoveryCompleted(token, initialPrice, initialLiquidity);
    }

    /**
     * @dev Calculates initial price based on engagement trends with circuit breaker
     */
    function calculateInitialPrice(
        address token
    ) internal returns (uint256) {
        PriceDiscoveryData storage data = priceDiscovery[token];
        
        // Calculate engagement growth rate
        uint256 totalGrowth = 0;
        uint256 positiveSnapshots = 0;
        
        for (uint256 i = 0; i < data.engagementSnapshots.length; i++) {
            if (i > 0) {
                // Handle potential negative growth
                if (data.engagementSnapshots[i] > data.engagementSnapshots[i-1]) {
                    uint256 growth = ((data.engagementSnapshots[i] - data.engagementSnapshots[i-1]) * 10000) 
                                    / data.engagementSnapshots[i-1];
                    
                    // Cap individual growth rate
                    growth = growth > 10000 ? 10000 : growth; // Cap at 100% per snapshot
                    
                    totalGrowth += growth;
                    positiveSnapshots++;
                }
            }
        }
        
        // Calculate average growth, defaulting to 0 if no positive growth
        uint256 avgGrowth = positiveSnapshots > 0 ? 
            totalGrowth / positiveSnapshots : 
            0;
        
        // Calculate price with growth rate
        uint256 calculatedPrice = BASE_PRICE + ((BASE_PRICE * avgGrowth) / 10000);
        
        // Calculate maximum allowed price
        uint256 maxAllowedPrice = BASE_PRICE * MAX_PRICE_MULTIPLIER;
        
        // Apply circuit breaker logic
        if (calculatedPrice > maxAllowedPrice) {
            emit PriceCapReached(token, calculatedPrice, maxAllowedPrice);
            calculatedPrice = maxAllowedPrice;
        }
        
        return calculatedPrice > MIN_TOKEN_PRICE ? calculatedPrice : MIN_TOKEN_PRICE;
    }

    // Add event for monitoring price caps
    event PriceCapReached(
        address indexed token,
        uint256 calculatedPrice,
        uint256 cappedPrice
    );

    // Add event for fallback pool selection
    event FallbackPoolSelected(
        address indexed pool,
        uint256 reserveAmount
    );

    // Add event for skipped rebalances
    event RebalanceSkipped(
        address indexed token,
        uint256 coralReserve,
        string reason
    );

    // Enhanced pool selection event
    event PoolSelected(
        address indexed pool,
        uint256 score,
        uint256 currentLiquidity
    );

    /**
     * @dev Updates pool trading activity
     */
    function updatePoolActivity(
        address pool,
        uint256 tradeAmount
    ) external onlyDEX {
        PoolActivity storage activity = poolActivity[pool];
        
        // Update last trade timestamp
        activity.lastTradeTimestamp = block.timestamp;
        
        // Update 24h volume
        if (block.timestamp >= activity.lastVolumeUpdateTime + 24 hours) {
            // Reset volume after 24h
            activity.tradingVolume24h = tradeAmount;
            activity.lastVolumeUpdateTime = block.timestamp;
        } else {
            activity.tradingVolume24h += tradeAmount;
        }
        
        emit PoolActivityUpdated(
            pool,
            activity.tradingVolume24h,
            block.timestamp
        );
    }

    /**
     * @dev Checks if pool is actively traded
     */
    function isPoolActive(address pool) public view returns (bool) {
        PoolActivity storage activity = poolActivity[pool];
        uint256 lastTrade = activity.lastTradeTimestamp;
        uint256 volume = activity.tradingVolume24h;
        
        if (lastTrade < block.timestamp - ACTIVITY_THRESHOLD) return false;
        if (volume < MIN_24H_VOLUME) return false;
        return true;
    }

    /**
     * @dev Calculates pool score based on liquidity and activity
     */
    function calculatePoolScore(
        address pool
    ) internal view returns (uint256) {
        // Cache values to save gas
        uint256 liquidity = coralReserves[pool];
        uint256 volume = poolActivity[pool].tradingVolume24h;
        
        // Use bit shifts for multiplication (more gas efficient)
        // 70% = multiply by 7/10
        // 30% = multiply by 3/10
        return (
            (liquidity * 7 + volume * 3) / 10
        );
    }

    /**
     * @dev View function to get pool activity metrics
     */
    function getPoolActivity(
        address pool
    ) external view returns (
        uint256 lastTrade,
        uint256 volume24h,
        bool isActive
    ) {
        PoolActivity storage activity = poolActivity[pool];
        return (
            activity.lastTradeTimestamp,
            activity.tradingVolume24h,
            isPoolActive(pool)
        );
    }

    // Add function to set DEX address
    function setDEX(address _dex) external onlyOwner {
        require(_dex != address(0), "Invalid DEX address");
        dex = _dex;
        emit DEXUpdated(_dex);
    }

    /**
     * @dev Calculates initial liquidity based on subscriber count and CORAL price
     * @param subscriberCount Current number of subscribers
     * @param price Initial price in CORAL tokens (18 decimals)
     * @return uint256 Initial liquidity amount in CORAL tokens
     */
    function calculateInitialLiquidity(
        uint256 subscriberCount,
        uint256 price
    ) public pure returns (uint256) {
        // Validate inputs
        require(subscriberCount > 0, "Invalid subscriber count");
        require(price >= MIN_TOKEN_PRICE, "Price below minimum");
        require(price <= BASE_PRICE * MAX_PRICE_MULTIPLIER, "Price above maximum");

        // Calculate initial liquidity with overflow protection
        uint256 liquidity = subscriberCount * price;
        require(liquidity / subscriberCount == price, "Liquidity calculation overflow");
        require(liquidity >= MIN_LIQUIDITY, "Liquidity below minimum");

        return liquidity;
    }

    // Add helper function to validate liquidity
    /**
     * @dev Validates if a liquidity amount is within acceptable bounds
     * @param liquidity Amount to validate
     * @return bool True if liquidity is valid
     */
    function isValidLiquidity(uint256 liquidity) public pure returns (bool) {
        return liquidity >= MIN_LIQUIDITY && 
               liquidity <= type(uint256).max / MAX_PRICE_MULTIPLIER;
    }

    // Add modifier to check DEX permissions
    modifier onlyDEX() {
        require(msg.sender == dex, "Only DEX can call this function");
        _;
    }

    // Add receive function to accept native CORAL token
    receive() external payable {}

    // Add fallback function to accept native CORAL token with data
    fallback() external payable {}

    // Add event for DEX updates
    event DEXUpdated(address indexed newDEX);

    /**
     * @dev Calculates the optimal amount of fees to deploy to a pool
     * @param targetPool The pool to deploy fees to
     * @param availableFees Total available fees
     * @return Amount of fees to deploy
     */
    function calculateOptimalDeployment(
        address targetPool,
        uint256 availableFees
    ) internal view returns (uint256) {
        // Safety check: Ensure valid target pool
        if (targetPool == address(0)) {
            return 0;
        }

        // Get current pool metrics
        uint256 currentLiquidity = coralReserves[targetPool];
        PoolActivity memory activity = poolActivity[targetPool];

        // If pool has low liquidity, deploy all available fees
        if (currentLiquidity < MIN_LIQUIDITY) {
            return availableFees;
        }

        // If pool is highly active, deploy 75% of available fees
        if (activity.tradingVolume24h > MIN_24H_VOLUME * 2) {
            return (availableFees * 75) / 100;
        }

        // Default case: Deploy 50% of available fees
        return availableFees / 2;
    }

    function transferCoralToDEX(uint256 amount) external onlyOwner {
    require(amount > 0, "Amount must be greater than zero");
    require(dex != address(0), "DEX address is not set");

    IERC20 coral = IERC20(coralToken);
    uint256 balance = coral.balanceOf(address(this));
    require(balance >= amount, "Insufficient CORAL balance");

    coral.safeTransfer(dex, amount); // Proper ERC-20 token transfer

    emit CoralTokenTransferred(dex, amount, block.timestamp);
   }


    // Update event to include timestamp
    event CoralTokenTransferred(
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

}