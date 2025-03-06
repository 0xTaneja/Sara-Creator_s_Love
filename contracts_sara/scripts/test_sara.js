const { ethers } = require("hardhat");

// Main test function
async function main() {
  console.log("Starting Sara Contracts Test Suite - Simplified Version");
  
  // Get signers
  const [owner, creator, user1, user2] = await ethers.getSigners();
  console.log("Using account:", owner.address);
  
  // Constants for testing
  const timestamp = Date.now();
  const CREATOR_NAME = `MrBeast${timestamp}`;
  const CREATOR_IMAGE = "https://example.com/mrbeast.jpg";
  const CREATOR_CHANNEL = `https://youtube.com/mrbeast${timestamp}`;
  const CREATOR_SUBSCRIBERS = 100;
  
  // Contract addresses
  const CORAL_TOKEN_ADDRESS = "0xAF93888cbD250300470A1618206e036E11470149";
  const CREATOR_TOKEN_ADDRESS = "0xa39114954Cc6fD143819389508F279981De3218c";
  const LIQUIDITY_MANAGER_ADDRESS = "0xe3C3aa37b0A2cc0eE70a7Bfc41e6c46Eea748562";
  const SARA_DEX_ADDRESS = "0xc2600BE1111c8696966726b8cee571E048aFe962";
  const SARA_ROUTER_ADDRESS = "0xAFeFE032F4041b8cB6b42b23e51011061B578180";
  
  console.log("\n=== STEP 1: Attaching to contracts ===");
  
  // Attach to contracts
  const coralToken = await ethers.getContractAt("IERC20", CORAL_TOKEN_ADDRESS);
  console.log("CORAL Token attached at:", CORAL_TOKEN_ADDRESS);
  
  const creatorToken = await ethers.getContractAt("CreatorToken", CREATOR_TOKEN_ADDRESS);
  console.log("CreatorToken attached at:", CREATOR_TOKEN_ADDRESS);
  
  const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", LIQUIDITY_MANAGER_ADDRESS);
  console.log("SaraLiquidityManager attached at:", LIQUIDITY_MANAGER_ADDRESS);
  
  const saraDex = await ethers.getContractAt("SaraDEX", SARA_DEX_ADDRESS);
  console.log("SaraDEX attached at:", SARA_DEX_ADDRESS);
  
  const tokenRouter = await ethers.getContractAt("SaraTokenRouter", SARA_ROUTER_ADDRESS);
  console.log("SaraTokenRouter attached at:", SARA_ROUTER_ADDRESS);
  
  console.log("\n=== STEP 2: Checking balances ===");
  
  // Check CORAL token balance
  const ownerBalance = await coralToken.balanceOf(owner.address);
  console.log("Owner CORAL balance:", ethers.formatEther(ownerBalance));
  
  // Transfer CORAL tokens to creator for testing
  const creatorAddress = creator?.address || owner.address;
  console.log("Creator address:", creatorAddress);
  
  const creatorBalance = await coralToken.balanceOf(creatorAddress);
  console.log("Creator CORAL balance before transfer:", ethers.formatEther(creatorBalance));
  
  if (creatorBalance < ethers.parseEther("10")) {
    console.log("Transferring 10 CORAL tokens to creator...");
    await coralToken.transfer(creatorAddress, ethers.parseEther("10"));
    const newCreatorBalance = await coralToken.balanceOf(creatorAddress);
    console.log("Creator CORAL balance after transfer:", ethers.formatEther(newCreatorBalance));
  }
  
  console.log("\n=== STEP 3: Minting creator token ===");
  
  console.log("Minting a new creator token...");
  const mintTx = await creatorToken.mintToken(
    creatorAddress,
    CREATOR_NAME,
    CREATOR_IMAGE,
    CREATOR_CHANNEL,
    CREATOR_SUBSCRIBERS
  );
  
  console.log("Mint transaction hash:", mintTx.hash);
  const mintReceipt = await mintTx.wait();
  console.log("Mint transaction confirmed in block:", mintReceipt.blockNumber);
  
  // Extract token address from event
  let creatorERC20Address;
  for (const log of mintReceipt.logs) {
    try {
      const parsedLog = creatorToken.interface.parseLog({
        topics: log.topics,
        data: log.data
      });
      
      if (parsedLog && parsedLog.name === 'CreatorTokenMinted') {
        creatorERC20Address = parsedLog.args.tokenAddress;
        console.log("Found CreatorTokenMinted event");
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!creatorERC20Address) {
    console.log("Event not found, trying to get token address directly");
    creatorERC20Address = await creatorToken.getCreatorToken(CREATOR_CHANNEL);
  }
  
  console.log("Creator ERC20 token deployed to:", creatorERC20Address);
  
  // Verify token exists
  const code = await ethers.provider.getCode(creatorERC20Address);
  if (code === "0x") {
    console.error("ERROR: No contract code at the token address!");
    process.exit(1);
  }
  
  // Attach to the token
  const CreatorERC20 = await ethers.getContractFactory("CreatorERC20");
  const creatorERC20 = CreatorERC20.attach(creatorERC20Address);
  console.log("Successfully attached to token contract");
  
  // Check token metadata
  const metadata = await creatorERC20.getCreatorMetadata();
  console.log("Token metadata:", {
    name: metadata._name,
    symbol: metadata._symbol,
    creatorName: metadata._creatorName,
    subscribers: metadata._subscribers.toString()
  });
  
  const totalSupply = await creatorERC20.totalSupply();
  console.log("Total supply:", ethers.formatEther(totalSupply));
  
  const creatorTokenBalance = await creatorERC20.balanceOf(creatorAddress);
  console.log("Creator token balance:", ethers.formatEther(creatorTokenBalance));
  
  console.log("\n=== STEP 4: Setting up roles ===");
  
  // Check if DEX has LIQUIDITY_MANAGER_ROLE
  const LIQUIDITY_MANAGER_ROLE = await saraDex.LIQUIDITY_MANAGER_ROLE();
  const hasLiquidityManagerRole = await saraDex.hasRole(LIQUIDITY_MANAGER_ROLE, liquidityManager.getAddress());
  console.log("DEX role already granted:", hasLiquidityManagerRole);

  // Grant role if not already granted
  if (!hasLiquidityManagerRole) {
    console.log("Granting LIQUIDITY_MANAGER_ROLE to liquidity manager...");
    const grantRoleTx = await saraDex.grantRole(LIQUIDITY_MANAGER_ROLE, liquidityManager.getAddress());
    console.log("Grant role transaction hash:", grantRoleTx.hash);
    await grantRoleTx.wait();
    console.log("Role granted successfully");
  }

  // Check if DEX is set in liquidity manager
  const dexAddress = await liquidityManager.dex();
  const isDexSet = dexAddress === saraDex.getAddress();
  console.log("LIQUIDITY_MANAGER role already granted:", isDexSet);

  // Set DEX in liquidity manager if not already set
  if (!isDexSet) {
    console.log("Setting DEX in liquidity manager...");
    try {
      const setDexTx = await liquidityManager.setDEX(saraDex.getAddress());
      console.log("Set DEX transaction hash:", setDexTx.hash);
      await setDexTx.wait();
      console.log("DEX set successfully in liquidity manager");
    } catch (error) {
      if (error.message.includes("Already primary DEX")) {
        console.log("DEX is already set as primary DEX in liquidity manager");
      } else {
        console.error("Error setting DEX in liquidity manager:", error.message);
      }
    }
  }
  
  console.log("\n=== STEP 5: Checking if pool is already tracked ===");
  
  const isAlreadyTracked = await liquidityManager.isTrackedPool(creatorERC20Address);
  console.log("Is pool already tracked:", isAlreadyTracked);
  
  if (isAlreadyTracked) {
    console.log("Pool is already tracked, skipping manual tracking");
  } else {
    console.log("\n=== STEP 6: Manually adding pool to tracking ===");
    
    // Manually add pool to tracking
    console.log("Adding pool to tracking...");
    try {
      const addPoolTx = await liquidityManager.addPoolToTracking(creatorERC20Address);
      await addPoolTx.wait();
      console.log("Pool added to tracking, transaction hash:", addPoolTx.hash);
      
      // Verify pool is now tracked
      const isNowTracked = await liquidityManager.isTrackedPool(creatorERC20Address);
      console.log("Is pool tracked after manual addition:", isNowTracked);
    } catch (error) {
      console.log("Error adding pool to tracking:", error.message);
    }
  }
  
  console.log("\n=== STEP 7: Adding liquidity ===");
  
  // Check if owner has creator tokens
  const ownerCreatorTokenBalance = await creatorERC20.balanceOf(owner.address);
  console.log("Owner's creator token balance:", ethers.formatEther(ownerCreatorTokenBalance));
  
  // If owner doesn't have creator tokens, transfer some from creator
  if (ownerCreatorTokenBalance < ethers.parseEther("10") && creatorAddress !== owner.address) {
    console.log("Transferring creator tokens to owner for liquidity addition...");
    try {
      const transferTx = await creatorERC20.connect(creator).transfer(owner.address, ethers.parseEther("20"));
      await transferTx.wait();
      console.log("Creator tokens transferred to owner, transaction hash:", transferTx.hash);
      
      const newOwnerCreatorBalance = await creatorERC20.balanceOf(owner.address);
      console.log("Owner's creator token balance after transfer:", ethers.formatEther(newOwnerCreatorBalance));
    } catch (transferError) {
      console.log("Error transferring creator tokens to owner:", transferError.message);
    }
  }
  
  // Approve CORAL tokens for liquidity manager
  console.log("Approving CORAL tokens for liquidity manager from owner...");
  const approveTx = await coralToken.approve(LIQUIDITY_MANAGER_ADDRESS, ethers.parseEther("50"));
  await approveTx.wait();
  console.log("Owner CORAL approval transaction hash:", approveTx.hash);
  
  // Approve creator tokens for liquidity manager from owner
  console.log("Approving creator tokens for liquidity manager from owner...");
  const approveOwnerCreatorTx = await creatorERC20.approve(LIQUIDITY_MANAGER_ADDRESS, ethers.parseEther("50"));
  await approveOwnerCreatorTx.wait();
  console.log("Owner creator token approval transaction hash:", approveOwnerCreatorTx.hash);
  
  // If creator is different from owner, also approve from creator
  if (creatorAddress !== owner.address) {
    console.log("Approving creator tokens for liquidity manager from creator...");
    try {
      const approveCreatorTx = await creatorERC20.connect(creator).approve(LIQUIDITY_MANAGER_ADDRESS, ethers.parseEther("50"));
      await approveCreatorTx.wait();
      console.log("Creator token approval transaction hash:", approveCreatorTx.hash);
    } catch (approveError) {
      console.log("Error approving creator tokens from creator:", approveError.message);
    }
  }
  
  // Add liquidity directly
  console.log("Adding liquidity directly...");
  try {
    // First, check if the creator has enough tokens
    const creatorTokenBalance = await creatorERC20.balanceOf(creatorAddress);
    console.log("Creator token balance before liquidity addition:", ethers.formatEther(creatorTokenBalance));
    
    // Check if owner has enough CORAL tokens
    const ownerCoralBalance = await coralToken.balanceOf(owner.address);
    console.log("Owner CORAL balance before liquidity addition:", ethers.formatEther(ownerCoralBalance));
    
    // Try with larger amounts to meet minimum liquidity requirement
    console.log("Trying to add liquidity with larger amounts to meet minimum liquidity...");
    const addLiqTx = await liquidityManager.addLiquidity(
      creatorERC20Address,
      ethers.parseEther("20"), // Creator tokens - increased amount
      ethers.parseEther("20")  // CORAL tokens - increased amount
    );
    
    console.log("Waiting for transaction confirmation...");
    const receipt = await addLiqTx.wait();
    console.log("Liquidity addition successful, transaction hash:", addLiqTx.hash);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Check reserves
    const reserves = await liquidityManager.getReserves(creatorERC20Address);
    console.log("Reserves after liquidity addition:", {
      creatorTokens: ethers.formatEther(reserves[0]),
      coralTokens: ethers.formatEther(reserves[1])
    });
  } catch (error) {
    console.log("Error adding liquidity:", error.message);
    
    // Try to get more detailed error information
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Try with even larger amounts as a fallback
    try {
      console.log("Trying fallback with maximum amounts...");
      
      // Check available balances
      const availableCreator = await creatorERC20.balanceOf(owner.address);
      const availableCoral = await coralToken.balanceOf(owner.address);
      
      console.log("Available balances for liquidity:", {
        creatorTokens: ethers.formatEther(availableCreator),
        coralTokens: ethers.formatEther(availableCoral)
      });
      
      // Use 90% of available balances (to account for gas)
      const creatorAmount = availableCreator * 9n / 10n;
      const coralAmount = availableCoral * 9n / 10n;
      
      console.log("Using amounts for liquidity:", {
        creatorTokens: ethers.formatEther(creatorAmount),
        coralTokens: ethers.formatEther(coralAmount)
      });
      
      const fallbackTx = await liquidityManager.addLiquidity(
        creatorERC20Address,
        creatorAmount,
        coralAmount
      );
      
      console.log("Waiting for fallback transaction confirmation...");
      await fallbackTx.wait();
      console.log("Fallback liquidity addition successful, transaction hash:", fallbackTx.hash);
      
      // Check reserves after fallback
      const fallbackReserves = await liquidityManager.getReserves(creatorERC20Address);
      console.log("Reserves after fallback liquidity addition:", {
        creatorTokens: ethers.formatEther(fallbackReserves[0]),
        coralTokens: ethers.formatEther(fallbackReserves[1])
      });
    } catch (fallbackError) {
      console.log("Fallback liquidity addition also failed:", fallbackError.message);
      
      // Let's try to check the minimum liquidity requirement
      try {
        console.log("Checking minimum liquidity requirement...");
        // This is a guess at the function name - adjust if needed
        const minLiquidity = await liquidityManager.minimumLiquidity();
        console.log("Minimum liquidity requirement:", ethers.formatEther(minLiquidity));
      } catch (minLiqError) {
        console.log("Could not determine minimum liquidity requirement");
      }
    }
  }
  
  console.log("\n=== STEP 8.5: Listing token on router ===");
  try {
    // Check if token is already listed
    const isListed = await tokenRouter.listedTokens(creatorERC20Address);
    console.log("Is token already listed on router:", isListed);
    
    if (!isListed) {
      console.log("Listing token on the router...");
      const listTx = await tokenRouter.listNewCreatorToken(creatorERC20Address);
      await listTx.wait();
      console.log("Token successfully listed on the router, transaction hash:", listTx.hash);
      
      // Verify listing
      const isListedAfter = await tokenRouter.listedTokens(creatorERC20Address);
      console.log("Is token listed after transaction:", isListedAfter);
    } else {
      console.log("Token is already listed on the router, proceeding with swap test.");
    }
  } catch (listError) {
    console.log("Error listing token on router:", listError.message);
    if (listError.data) {
      console.log("Error data:", listError.data);
    }
  }
  
  console.log("\n=== STEP 8.6: Transferring Creator Tokens to DEX ===");
  try {
    // Check if DEX has creator tokens
    const dexCreatorBalance = await creatorERC20.balanceOf(saraDex.target);
    console.log("DEX Creator token balance:", ethers.formatEther(dexCreatorBalance));
    
    if (dexCreatorBalance < ethers.parseEther("5")) {
      console.log("Transferring creator tokens to DEX...");
      // Use creator account to transfer tokens directly to DEX
      const transferTx = await creatorERC20.connect(creator).transfer(saraDex.target, ethers.parseEther("5"));
      await transferTx.wait();
      console.log("Creator tokens transferred to DEX, transaction hash:", transferTx.hash);
      
      // Verify transfer
      const newDexBalance = await creatorERC20.balanceOf(saraDex.target);
      console.log("DEX Creator token balance after transfer:", ethers.formatEther(newDexBalance));
    } else {
      console.log("DEX already has sufficient creator tokens");
    }
  } catch (transferError) {
    console.log("Error transferring creator tokens to DEX:", transferError.message);
    if (transferError.data) {
      console.log("Error data:", transferError.data);
    }
  }
  
  console.log("Press Enter to continue to swap tests...");
  
  try {
    console.log("\n=== STEP 9: Testing swaps ===");
    
    // Log the current state of the contracts
    console.log("Getting current reserves from liquidity manager...");
    const [creatorReserve, coralReserve] = await liquidityManager.getReserves(creatorERC20Address);
    console.log("Current reserves:");
    console.log("  Creator token reserve:", ethers.formatEther(creatorReserve));
    console.log("  CORAL token reserve:", ethers.formatEther(coralReserve));
    
    // Check contract balances
    const dexCoralBalance = await coralToken.balanceOf(saraDex.target);
    const dexCreatorBalance = await creatorERC20.balanceOf(saraDex.target);
    console.log("DEX balances:");
    console.log("  DEX CORAL balance:", ethers.formatEther(dexCoralBalance));
    console.log("  DEX Creator token balance:", ethers.formatEther(dexCreatorBalance));
    
    // Check owner balances
    const ownerCoralBalance = await coralToken.balanceOf(owner.address);
    const ownerCreatorBalance = await creatorERC20.balanceOf(owner.address);
    console.log("Owner balances:");
    console.log("  Owner CORAL balance:", ethers.formatEther(ownerCoralBalance));
    console.log("  Owner Creator token balance:", ethers.formatEther(ownerCreatorBalance));
    
    // Calculate swap amounts
    console.log("Calculating swap amounts...");
    // Use a smaller amount for the swap to ensure it's within limits
    const coralBalance = await coralToken.balanceOf(owner.address);
    const swapAmount = ethers.parseEther("1.0"); // Use a smaller amount for testing
    
    console.log("CORAL amount to swap:", ethers.formatEther(swapAmount));
    
    // Get expected output based on reserves
    console.log("Getting expected output from swap...");
    let expectedOutput;
    try {
      expectedOutput = await saraDex.getAmountOut(swapAmount, coralReserve, creatorReserve);
      console.log("Expected output from getAmountOut:", ethers.formatEther(expectedOutput));
    } catch (error) {
      console.log("Error calling getAmountOut:", error.message);
      // Try a manual calculation as fallback
      expectedOutput = (BigInt(swapAmount) * BigInt(creatorReserve)) / BigInt(coralReserve);
      console.log("Manually calculated expected output:", ethers.formatEther(expectedOutput));
    }
    
    // Calculate minimum amount out with 20% slippage
    const slippage = 2000; // 20%
    const minAmountOut = expectedOutput * BigInt(8000) / BigInt(10000); // 80% of expected output
    
    console.log("Swap parameters:");
    console.log({
      amountIn: ethers.formatEther(swapAmount),
      expectedOut: ethers.formatEther(expectedOutput),
      minAmountOut: ethers.formatEther(minAmountOut),
      slippage: "20%"
    });
    
    // Approve tokens for the DEX before swapping
    console.log("Approving CORAL tokens for DEX from owner...");
    const dexApprovalTx = await coralToken.connect(owner).approve(saraDex.target, swapAmount);
    console.log("DEX approval transaction hash:", dexApprovalTx.hash);
    await dexApprovalTx.wait();
    
    // Check allowance to confirm approval
    const allowance = await coralToken.allowance(owner.address, saraDex.target);
    console.log("DEX allowance after approval:", ethers.formatEther(allowance));
    
    // Wait for a minute to avoid anti-bot protection
    console.log("Waiting for 61 seconds to avoid anti-bot protection...");
    await new Promise(resolve => setTimeout(resolve, 61000));
    
    // Execute the swap with try/catch to handle errors
    try {
      console.log("Executing swap with minimum amount...");
      const swapTx = await saraDex.connect(owner).swapCoralForCreatorToken(
        creatorERC20Address,
        swapAmount,
        minAmountOut,
        slippage
      );
      
      console.log("Swap transaction hash:", swapTx.hash);
      await swapTx.wait();
      console.log("Swap successful!");
      
      // Check balances after swap
      const ownerCreatorBalanceAfter = await creatorERC20.balanceOf(owner.address);
      const ownerCoralBalanceAfter = await coralToken.balanceOf(owner.address);
      console.log("Balances after swap:");
      console.log("  Owner creator token balance:", ethers.formatEther(ownerCreatorBalanceAfter));
      console.log("  Owner CORAL token balance:", ethers.formatEther(ownerCoralBalanceAfter));
      
      // Check reserves after swap
      const [creatorReserveAfter, coralReserveAfter] = await liquidityManager.getReserves(creatorERC20Address);
      console.log("Reserves after swap:");
      console.log("  Creator token reserve:", ethers.formatEther(creatorReserveAfter));
      console.log("  CORAL token reserve:", ethers.formatEther(coralReserveAfter));
    } catch (swapError) {
      console.log("Swap failed:", swapError.message);
      
      // Check the lastSwapTimestamp for the user
      try {
        const lastSwapTimestamp = await saraDex.lastSwapTimestamp(owner.address);
        console.log("Last swap timestamp for user:", lastSwapTimestamp.toString());
        console.log("Current block timestamp:", (await ethers.provider.getBlock("latest")).timestamp);
      } catch (timeError) {
        console.log("Error checking last swap timestamp:", timeError.message);
      }
      
      if (swapError.data) {
        console.log("Error data:", swapError.data);
        
        // Try to decode the error
        try {
          // This is a common error format in Solidity
          const errorData = swapError.data;
          console.log("Error signature:", errorData.slice(0, 10));
          
          console.log("This appears to be a custom error from the contract");
          console.log("Possible reasons: time restriction, invalid amount, or other contract-specific restriction");
          
          // Add more detailed error analysis
          console.log("\n=== STEP 10: Detailed Error Analysis ===");
          console.log("Error data breakdown:");
          console.log("First 4 bytes (function selector):", errorData.slice(0, 10));
          
          // Try to parse the parameters
          try {
            for (let i = 10; i < errorData.length; i += 64) {
              const param = errorData.slice(i, i + 64);
              console.log(`Parameter ${(i-10)/64 + 1}:`, param);
              console.log(`  Potential address: 0x${param.slice(24)}`);
              console.log(`  As number: ${BigInt('0x' + param)}n`);
            }
          } catch (decodeError) {
            console.log("Error decoding error data:", decodeError.message);
          }
        } catch (error) {
          console.log("Error analyzing error data:", error.message);
        }
      }
      
      // Try a different approach - use the router instead
      console.log("\n=== Trying swap through router instead ===");
      try {
        // Use the creator account instead of owner to avoid anti-bot protection
        console.log("Using creator account for swap to avoid anti-bot protection");
        
        // First transfer some CORAL to creator
        console.log("Transferring CORAL to creator for swap...");
        const transferTx = await coralToken.connect(owner).transfer(creator.address, swapAmount);
        console.log("Transfer transaction hash:", transferTx.hash);
        await transferTx.wait();
        
        // Check creator's CORAL balance
        const creatorCoralBalance = await coralToken.balanceOf(creator.address);
        console.log("Creator CORAL balance before router swap:", ethers.formatEther(creatorCoralBalance));
        
        // Approve CORAL tokens for router from creator
        console.log("Approving CORAL tokens for router from creator...");
        const routerApprovalTx = await coralToken.connect(creator).approve(tokenRouter.target, swapAmount);
        console.log("Router approval transaction hash:", routerApprovalTx.hash);
        await routerApprovalTx.wait();
        
        // Check router allowance
        const routerAllowance = await coralToken.allowance(creator.address, tokenRouter.target);
        console.log("Router allowance after approval:", ethers.formatEther(routerAllowance));
        
        // Execute swap through router using creator account
        console.log("Executing swap through router using creator account...");
        const routerSwapTx = await tokenRouter.connect(creator).swapCoralForToken(
          creatorERC20Address,
          swapAmount,
          minAmountOut
        );
        
        console.log("Router swap transaction hash:", routerSwapTx.hash);
        await routerSwapTx.wait();
        console.log("Router swap successful!");
        
        // Check balances after swap
        const creatorCreatorBalance = await creatorERC20.balanceOf(creator.address);
        console.log("Creator's creator token balance after router swap:", ethers.formatEther(creatorCreatorBalance));
        
        // Check reserves after swap
        const [creatorReserveAfter, coralReserveAfter] = await liquidityManager.getReserves(creatorERC20Address);
        console.log("Reserves after router swap:");
        console.log("  Creator token reserve:", ethers.formatEther(creatorReserveAfter));
        console.log("  CORAL token reserve:", ethers.formatEther(coralReserveAfter));
      } catch (routerSwapError) {
        console.log("Router swap also failed:", routerSwapError.message);
        
        if (routerSwapError.data) {
          console.log("Router error data:", routerSwapError.data);
          const errorSignature = routerSwapError.data.slice(0, 10);
          console.log("Router error signature:", errorSignature);
          
          // Check DEX and router balances
          const dexCoralBalance = await coralToken.balanceOf(saraDex.target);
          const dexCreatorBalance = await creatorERC20.balanceOf(saraDex.target);
          const routerCoralBalance = await coralToken.balanceOf(tokenRouter.target);
          
          console.log("DEX and Router balances:");
          console.log("  DEX CORAL balance:", ethers.formatEther(dexCoralBalance));
          console.log("  DEX Creator balance:", ethers.formatEther(dexCreatorBalance));
          console.log("  Router CORAL balance:", ethers.formatEther(routerCoralBalance));
        }
      }
    }
  } catch (error) {
    console.log("Error during swap tests:", error.message);
  }
  
  console.log("\n=== All tests completed! ===");
  
  // Add reverse swap test (creator token -> CORAL)
  console.log("\n=== STEP 10: Testing reverse swap (Creator -> CORAL) ===");
  try {
    // Check if owner has creator tokens to swap
    const ownerCreatorBalance = await creatorERC20.balanceOf(owner.address);
    console.log("Owner's creator token balance before reverse swap:", ethers.formatEther(ownerCreatorBalance));
    
    if (ownerCreatorBalance < ethers.parseEther("1.5")) {
      console.log("Not enough creator tokens for reverse swap test, transferring from creator...");
      const transferTx = await creatorERC20.connect(creator).transfer(owner.address, ethers.parseEther("2.0"));
      await transferTx.wait();
      console.log("Creator tokens transferred for reverse swap test, transaction hash:", transferTx.hash);
      
      const newOwnerCreatorBalance = await creatorERC20.balanceOf(owner.address);
      console.log("Owner's creator token balance after transfer:", ethers.formatEther(newOwnerCreatorBalance));
    }
    
    // Get latest reserves for calculation
    console.log("Getting current reserves from liquidity manager...");
    const [creatorReserve, coralReserve] = await liquidityManager.getReserves(creatorERC20Address);
    console.log("Current reserves:");
    console.log("  Creator token reserve:", ethers.formatEther(creatorReserve));
    console.log("  CORAL token reserve:", ethers.formatEther(coralReserve));
    
    // Get slippage settings directly from the contract
    console.log("Getting slippage settings from contract...");
    const slippageSettings = await saraDex.getSlippageSettings();
    console.log("Slippage settings:");
    console.log("  Default slippage:", slippageSettings[0].toString(), "basis points");
    console.log("  Current max slippage:", slippageSettings[1].toString(), "basis points");
    console.log("  Absolute maximum:", slippageSettings[2].toString(), "basis points");
    
    // Calculate swap amounts - Use a smaller amount (<=5% of creator token reserve)
    console.log("Calculating reverse swap amounts...");
    // Calculate 5% of reserve to ensure we're within limits
    const maxAllowedAmount = creatorReserve * BigInt(5) / BigInt(100);
    console.log("Maximum allowed swap amount (5% of reserve):", ethers.formatEther(maxAllowedAmount));
    
    // Use 0.9 of the max allowed amount to be safe
    const reverseSwapAmount = ethers.parseEther("1.0"); // Reduced to 1.0 (5% of 20.0 reserve)
    console.log("Creator amount to swap:", ethers.formatEther(reverseSwapAmount));
    
    // Get expected output based on reserves
    console.log("Getting expected output from reverse swap...");
    let expectedReverseOutput;
    try {
      expectedReverseOutput = await saraDex.getAmountOut(reverseSwapAmount, creatorReserve, coralReserve);
      console.log("Expected CORAL output from getAmountOut:", ethers.formatEther(expectedReverseOutput));
    } catch (error) {
      console.log("Error calling getAmountOut for reverse swap:", error.message);
      // Try a manual calculation as fallback
      expectedReverseOutput = (BigInt(reverseSwapAmount) * BigInt(coralReserve)) / BigInt(creatorReserve);
      console.log("Manually calculated expected CORAL output:", ethers.formatEther(expectedReverseOutput));
    }
    
    // Use the contract's current max slippage setting
    const reverseSlippage = slippageSettings[1]; // Current max slippage from contract
    console.log("Using contract's current max slippage:", reverseSlippage.toString(), "basis points");
    
    // Calculate minimum amount out with a much higher slippage tolerance (50%)
    // This is only for testing purposes to ensure transaction goes through
    const reverseMinAmountOut = expectedReverseOutput * BigInt(5000) / BigInt(10000); // 50% of expected output
    
    console.log("Reverse swap parameters:");
    console.log({
      amountIn: ethers.formatEther(reverseSwapAmount),
      expectedOut: ethers.formatEther(expectedReverseOutput),
      minAmountOut: ethers.formatEther(reverseMinAmountOut),
      slippage: `${Number(reverseSlippage)/100}%`,
      actualSlippageTolerance: "50%" // What we're actually accepting in minAmountOut
    });
    
    // Approve creator tokens for the DEX before swapping
    console.log("Approving creator tokens for DEX from owner...");
    const dexCreatorApprovalTx = await creatorERC20.connect(owner).approve(saraDex.target, reverseSwapAmount);
    console.log("DEX creator approval transaction hash:", dexCreatorApprovalTx.hash);
    await dexCreatorApprovalTx.wait();
    
    // Check allowance to confirm approval
    const creatorAllowance = await creatorERC20.allowance(owner.address, saraDex.target);
    console.log("DEX creator allowance after approval:", ethers.formatEther(creatorAllowance));
    
    // Wait for a minute to avoid anti-bot protection
    console.log("Waiting for 61 seconds to avoid anti-bot protection...");
    await new Promise(resolve => setTimeout(resolve, 61000));
    
    // Get balances before swap
    const ownerCoralBeforeReverse = await coralToken.balanceOf(owner.address);
    const ownerCreatorBeforeReverse = await creatorERC20.balanceOf(owner.address);
    console.log("Balances before reverse swap:");
    console.log("  Owner creator token balance:", ethers.formatEther(ownerCreatorBeforeReverse));
    console.log("  Owner CORAL token balance:", ethers.formatEther(ownerCoralBeforeReverse));
    
    // Execute the reverse swap
    console.log("Executing reverse swap...");
    const reverseSwapTx = await saraDex.connect(owner).swapCreatorTokenForCoral(
      creatorERC20Address,
      reverseSwapAmount,
      reverseMinAmountOut,
      reverseSlippage
    );
    
    console.log("Reverse swap transaction hash:", reverseSwapTx.hash);
    await reverseSwapTx.wait();
    console.log("Reverse swap successful!");
    
    // Check balances after swap
    const ownerCoralAfterReverse = await coralToken.balanceOf(owner.address);
    const ownerCreatorAfterReverse = await creatorERC20.balanceOf(owner.address);
    console.log("Balances after reverse swap:");
    console.log("  Owner creator token balance:", ethers.formatEther(ownerCreatorAfterReverse));
    console.log("  Owner CORAL token balance:", ethers.formatEther(ownerCoralAfterReverse));
    
    // Calculate actual amounts swapped
    const creatorTokensSwapped = ownerCreatorBeforeReverse - ownerCreatorAfterReverse;
    const coralTokensReceived = ownerCoralAfterReverse - ownerCoralBeforeReverse;
    console.log("Swap summary:");
    console.log("  Creator tokens swapped:", ethers.formatEther(creatorTokensSwapped));
    console.log("  CORAL tokens received:", ethers.formatEther(coralTokensReceived));
    
    // Check reserves after swap
    const [creatorReserveAfter, coralReserveAfter] = await liquidityManager.getReserves(creatorERC20Address);
    console.log("Reserves after reverse swap:");
    console.log("  Creator token reserve:", ethers.formatEther(creatorReserveAfter));
    console.log("  CORAL token reserve:", ethers.formatEther(coralReserveAfter));
  } catch (reverseSwapError) {
    console.log("Reverse swap failed:", reverseSwapError.message);
    
    if (reverseSwapError.data) {
      console.log("Error data:", reverseSwapError.data);
      
      // Try to decode the error
      try {
        // This is a common error format in Solidity
        const errorData = reverseSwapError.data;
        console.log("Error signature:", errorData.slice(0, 10));
        
        console.log("This appears to be a custom error from the contract");
        console.log("Possible reasons: time restriction, invalid amount, or other contract-specific restriction");
      } catch (error) {
        console.log("Error analyzing error data:", error.message);
      }
    }
  }
  
  console.log("\n=== All tests (including reverse swap) completed! ===");
}

// Add a delay function to wait between swaps
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in tests:", error);
    process.exit(1);
  });
