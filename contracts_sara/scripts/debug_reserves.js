const { ethers } = require("hardhat");

async function main() {
  console.log("Sara Contracts - DEBUG Reserves & Balances\n");

  // Get the deployer account
  const [owner] = await ethers.getSigners();
  console.log("Using account:", owner.address);

  // Contract addresses - replace with your actual deployed addresses
  const coralTokenAddress = "0xAF93888cbD250300470A1618206e036E11470149";
  const liquidityManagerAddress = "0xe3C3aa37b0A2cc0eE70a7Bfc41e6c46Eea748562";
  const saraDexAddress = "0xc2600BE1111c8696966726b8cee571E048aFe962";
  const saraTokenRouterAddress = "0xAFeFE032F4041b8cB6b42b23e51011061B578180";

  // Attach to the contracts
  const coralToken = await ethers.getContractAt("ERC20", coralTokenAddress);
  const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", liquidityManagerAddress);
  const saraDex = await ethers.getContractAt("SaraDEX", saraDexAddress);
  const tokenRouter = await ethers.getContractAt("SaraTokenRouter", saraTokenRouterAddress);

  console.log("Contracts loaded successfully");

  // Get the addresses of the creator tokens that have been deployed
  // Check the tracking status of pools
  const trackedPools = await liquidityManager.getTrackedPools();
  console.log("Tracked Pools:", trackedPools);

  // Loop through each tracked pool
  for (const pool of trackedPools) {
    console.log("\n=== Pool Data for", pool, "===");

    // Get the token contract
    const creatorToken = await ethers.getContractAt("CreatorERC20", pool);
    const name = await creatorToken.name();
    const symbol = await creatorToken.symbol();
    console.log("Token:", name, "(", symbol, ")");

    // Get reserves
    const [creatorReserve, coralReserve] = await liquidityManager.getReserves(pool);
    console.log("Reserves in LiquidityManager:");
    console.log("  Creator token reserve:", ethers.formatEther(creatorReserve));
    console.log("  CORAL token reserve:", ethers.formatEther(coralReserve));

    // Get actual balances
    const lmCreatorBalance = await creatorToken.balanceOf(liquidityManagerAddress);
    const lmCoralBalance = await coralToken.balanceOf(liquidityManagerAddress);
    const dexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
    const dexCoralBalance = await coralToken.balanceOf(saraDexAddress);
    const routerCreatorBalance = await creatorToken.balanceOf(saraTokenRouterAddress);
    const routerCoralBalance = await coralToken.balanceOf(saraTokenRouterAddress);

    console.log("Actual Token Balances:");
    console.log("  LiquidityManager Creator token:", ethers.formatEther(lmCreatorBalance));
    console.log("  LiquidityManager CORAL token:", ethers.formatEther(lmCoralBalance));
    console.log("  DEX Creator token:", ethers.formatEther(dexCreatorBalance));
    console.log("  DEX CORAL token:", ethers.formatEther(dexCoralBalance));
    console.log("  Router Creator token:", ethers.formatEther(routerCreatorBalance));
    console.log("  Router CORAL token:", ethers.formatEther(routerCoralBalance));

    // Check token metrics
    try {
      const isTradingEnabled = await saraDex.isTradingEnabled(pool);
      console.log("Trading Enabled:", isTradingEnabled);
    } catch (error) {
      console.log("Error checking if trading is enabled:", error.message);
    }

    // Check if the token is listed on the router
    const isTokenListed = await tokenRouter.listedTokens(pool);
    console.log("Listed on Router:", isTokenListed);

    // Check DEX configuration
    console.log("\nDEX Configuration for this token:");
    const swapFee = await saraDex.swapFee();
    console.log("  Swap Fee:", Number(swapFee) / 100, "%");

    const minSwapAmount = await saraDex.MIN_SWAP_AMOUNT();
    console.log("  Minimum Swap Amount:", ethers.formatEther(minSwapAmount));

    const maxSingleSwap = await saraDex.MAX_SINGLE_SWAP();
    console.log("  Maximum Single Swap:", ethers.formatEther(maxSingleSwap));

    // Check swap timing restrictions
    const minTimeBetweenSwaps = await saraDex.MIN_TIME_BETWEEN_SWAPS();
    console.log("  Minimum Time Between Swaps:", Number(minTimeBetweenSwaps), "seconds");

    const maxSwapAmountPercent = await saraDex.MAX_SWAP_AMOUNT_PERCENT();
    console.log("  Maximum Swap Amount % of Reserve:", Number(maxSwapAmountPercent), "%");

    // Check the current timestamp
    const currentBlock = await ethers.provider.getBlock('latest');
    console.log("  Current Block Timestamp:", currentBlock.timestamp);

    // Test a hypothetical swap
    try {
      console.log("\nHypothetical Swap Simulation:");
      const testSwapAmount = ethers.parseEther("1.0");
      
      // Check if this amount is valid for swap
      const validSwapAmount = testSwapAmount >= minSwapAmount && testSwapAmount <= maxSingleSwap;
      console.log("  Valid Swap Amount:", validSwapAmount);
      
      // Check if amount exceeds max percentage of reserve
      const exceedsMaxPercent = testSwapAmount > (coralReserve * BigInt(maxSwapAmountPercent) / 100n);
      console.log("  Exceeds Max % of Reserve:", exceedsMaxPercent);
      
      // Calculate expected output
      const expectedOutput = await saraDex.getAmountOut(testSwapAmount, coralReserve, creatorReserve);
      console.log("  Expected Output for 1 CORAL:", ethers.formatEther(expectedOutput));
      
      // Calculate fee
      const fee = (expectedOutput * swapFee) / 10000n;
      const amountAfterFee = expectedOutput - fee;
      console.log("  Fee Amount:", ethers.formatEther(fee));
      console.log("  Final Amount After Fee:", ethers.formatEther(amountAfterFee));
      
      // Check if output exceeds reserve
      const exceedsCreatorReserve = expectedOutput > creatorReserve;
      console.log("  Output Exceeds Creator Reserve:", exceedsCreatorReserve);
    } catch (error) {
      console.log("  Error in swap simulation:", error.message);
    }
  }

  console.log("\n==== Additional Info ====");
  try {
    // Get liquidity manager roles
    const DEX_ROLE = await liquidityManager.DEX_ROLE();
    const isDexRole = await liquidityManager.hasRole(DEX_ROLE, saraDexAddress);
    console.log("DEX has DEX_ROLE:", isDexRole);
    
    // Get the primary DEX
    const primaryDex = await liquidityManager.primaryDex();
    console.log("Primary DEX set in LiquidityManager:", primaryDex);
    console.log("Matches our DEX address:", primaryDex === saraDexAddress);
    
    // Get min liquidity
    const minLiquidity = await liquidityManager.MIN_LIQUIDITY();
    console.log("Minimum Liquidity Required:", ethers.formatEther(minLiquidity));
  } catch (error) {
    console.log("Error getting additional info:", error.message);
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in debug script:", error);
    process.exit(1);
  }); 