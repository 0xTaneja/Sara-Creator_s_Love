const { ethers } = require("hardhat");

async function main() {
  console.log("Sara Contracts - Transfer Creator Tokens to DEX\n");

  // Get the deployer account
  const [owner] = await ethers.getSigners();
  console.log("Using account:", owner.address);

  // Contract addresses
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
  const trackedPools = await liquidityManager.getTrackedPools();
  console.log(`Found ${trackedPools.length} tracked pools`);
  
  // Get the most recently created token (last in the array)
  const mostRecentTokenAddress = trackedPools[trackedPools.length - 1];
  console.log(`Most recent token address: ${mostRecentTokenAddress}`);
  
  // Get token details
  const creatorToken = await ethers.getContractAt("CreatorERC20", mostRecentTokenAddress);
  const name = await creatorToken.name();
  const symbol = await creatorToken.symbol();
  console.log(`Token: ${name} (${symbol})`);
  
  // Check if token is listed on router
  const isListed = await tokenRouter.listedTokens(mostRecentTokenAddress);
  console.log(`Token is listed on router: ${isListed}`);
  
  // List token if not already listed
  if (!isListed) {
    console.log("Listing token on router...");
    try {
      const listTx = await tokenRouter.listNewCreatorToken(mostRecentTokenAddress);
      await listTx.wait();
      console.log(`Token listed successfully, tx hash: ${listTx.hash}`);
      
      // Verify listing
      const isNowListed = await tokenRouter.listedTokens(mostRecentTokenAddress);
      console.log(`Token is now listed: ${isNowListed}`);
    } catch (error) {
      console.log(`Error listing token: ${error.message}`);
    }
  }
  
  // Check reserves
  const [creatorReserve, coralReserve] = await liquidityManager.getReserves(mostRecentTokenAddress);
  console.log("Current reserves:");
  console.log(`  Creator token: ${ethers.formatEther(creatorReserve)}`);
  console.log(`  CORAL token: ${ethers.formatEther(coralReserve)}`);
  
  // Check if DEX has creator tokens
  const dexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
  console.log(`DEX creator token balance: ${ethers.formatEther(dexCreatorBalance)}`);
  
  // Check creator account
  const accounts = await ethers.getSigners();
  const creator = accounts[1] || accounts[0];
  console.log(`Using creator account: ${creator.address}`);
  
  // Check creator balance
  const creatorBalance = await creatorToken.balanceOf(creator.address);
  console.log(`Creator token balance: ${ethers.formatEther(creatorBalance)}`);
  
  // Transfer tokens from creator to DEX if needed
  if (dexCreatorBalance < ethers.parseEther("1") && creatorBalance >= ethers.parseEther("1")) {
    console.log("Transferring creator tokens to DEX...");
    try {
      // Connect with the creator account
      const transferAmount = ethers.parseEther("5"); // Transfer 5 tokens
      const transferTx = await creatorToken.connect(creator).transfer(saraDexAddress, transferAmount);
      await transferTx.wait();
      console.log(`Transferred creator tokens to DEX, tx hash: ${transferTx.hash}`);
      
      // Verify transfer
      const newDexBalance = await creatorToken.balanceOf(saraDexAddress);
      console.log(`DEX creator token balance after transfer: ${ethers.formatEther(newDexBalance)}`);
    } catch (error) {
      console.log(`Error transferring creator tokens: ${error.message}`);
    }
  } else if (dexCreatorBalance < ethers.parseEther("1")) {
    // Try with owner account if creator doesn't have enough
    const ownerBalance = await creatorToken.balanceOf(owner.address);
    console.log(`Owner token balance: ${ethers.formatEther(ownerBalance)}`);
    
    if (ownerBalance >= ethers.parseEther("1")) {
      console.log("Transferring creator tokens from owner to DEX...");
      try {
        const transferAmount = ethers.parseEther("5"); // Transfer 5 tokens
        const transferTx = await creatorToken.transfer(saraDexAddress, transferAmount);
        await transferTx.wait();
        console.log(`Transferred creator tokens to DEX, tx hash: ${transferTx.hash}`);
        
        // Verify transfer
        const newDexBalance = await creatorToken.balanceOf(saraDexAddress);
        console.log(`DEX creator token balance after transfer: ${ethers.formatEther(newDexBalance)}`);
      } catch (error) {
        console.log(`Error transferring creator tokens: ${error.message}`);
      }
    } else {
      console.log("Neither creator nor owner has enough tokens to transfer to DEX");
      
      // Try to get tokens from the creator's address stored in the token contract
      try {
        // Try to get the token metadata to find creator info
        if (typeof creatorToken.getMetadata === 'function') {
          const metadata = await creatorToken.getMetadata();
          console.log("Token metadata:", metadata);
          
          if (metadata && metadata.creatorAddress) {
            const actualCreatorBalance = await creatorToken.balanceOf(metadata.creatorAddress);
            console.log(`Actual creator (${metadata.creatorAddress}) token balance: ${ethers.formatEther(actualCreatorBalance)}`);
            
            if (actualCreatorBalance >= ethers.parseEther("1")) {
              console.log("Please transfer tokens from the actual creator to the DEX manually");
            }
          }
        }
      } catch (error) {
        console.log(`Error getting token metadata: ${error.message}`);
      }
    }
  } else {
    console.log("DEX already has sufficient creator tokens");
  }
  
  // Check if DEX has CORAL tokens
  const dexCoralBalance = await coralToken.balanceOf(saraDexAddress);
  console.log(`DEX CORAL token balance: ${ethers.formatEther(dexCoralBalance)}`);
  
  if (dexCoralBalance < ethers.parseEther("1")) {
    console.log("DEX needs CORAL tokens for swaps. Checking owner balance...");
    const ownerCoralBalance = await coralToken.balanceOf(owner.address);
    console.log(`Owner CORAL token balance: ${ethers.formatEther(ownerCoralBalance)}`);
    
    if (ownerCoralBalance >= ethers.parseEther("1")) {
      console.log("Transferring CORAL tokens to DEX...");
      try {
        const transferTx = await coralToken.transfer(saraDexAddress, ethers.parseEther("1"));
        await transferTx.wait();
        console.log(`Transferred CORAL tokens to DEX, tx hash: ${transferTx.hash}`);
        
        // Verify transfer
        const newDexBalance = await coralToken.balanceOf(saraDexAddress);
        console.log(`DEX CORAL token balance after transfer: ${ethers.formatEther(newDexBalance)}`);
      } catch (error) {
        console.log(`Error transferring CORAL tokens: ${error.message}`);
      }
    }
  } else {
    console.log("DEX already has sufficient CORAL tokens");
  }
  
  console.log("\n=== Transfer process completed ===");
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in transfer script:", error);
    process.exit(1);
  }); 