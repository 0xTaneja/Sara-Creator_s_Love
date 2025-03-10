const { ethers } = require("hardhat");

async function main() {
  console.log("Sara DEX - Setup Liquidity for Creator Token\n");

  // Hardcoded values from .env file
  const adminPrivateKey = "3b276053b4b7da6024f2848662ed58e6837c3a87b417fb5d1e00a9f3ba10065e";
  const coralTokenAddress = "0xAF93888cbD250300470A1618206e036E11470149";
  const liquidityManagerAddress = "0xe3C3aa37b0A2cc0eE70a7Bfc41e6c46Eea748562";
  const saraDexAddress = "0xc2600BE1111c8696966726b8cee571E048aFe962";
  
  // The specific creator token address that's failing in the UI
  // This can be passed as a command line argument or hardcoded
  const creatorTokenAddress = process.argv[2] || "0xc8D712a12E9dEd00BC4F765BcE540CAd70319e58"; // Default to the token from your logs
  
  // Create a wallet from the private key
  const provider = ethers.provider;
  const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
  console.log("Using admin account:", adminWallet.address);
  
  console.log(`Setting up liquidity for creator token: ${creatorTokenAddress}`);

  // Attach to the contracts
  const coralToken = await ethers.getContractAt("ERC20", coralTokenAddress);
  const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", liquidityManagerAddress);
  const saraDex = await ethers.getContractAt("SaraDEX", saraDexAddress);
  const creatorToken = await ethers.getContractAt("ERC20", creatorTokenAddress);

  console.log("Contracts loaded successfully");

  // Get token details
  try {
    const name = await creatorToken.name();
    const symbol = await creatorToken.symbol();
    console.log(`Token: ${name} (${symbol})`);
  } catch (error) {
    console.error(`❌ Error getting token details: ${error.message}`);
    console.log("Continuing anyway...");
  }
  
  // Helper function to safely format ether values
  const safeFormatEther = (value) => {
    try {
      if (!value) return "0";
      return ethers.utils.formatUnits(value, 18);
    } catch (error) {
      return "Error formatting value";
    }
  };
  
  // Helper function to safely parse ether values
  const safeParseEther = (value) => {
    try {
      return ethers.utils.parseUnits(value, 18);
    } catch (error) {
      console.error(`Error parsing ether value: ${error.message}`);
      return ethers.BigNumber.from(0);
    }
  };
  
  // Check reserves
  try {
    const reserves = await liquidityManager.getReserves(creatorTokenAddress);
    const creatorReserve = reserves[0];
    const coralReserve = reserves[1];
    console.log("Current reserves:");
    console.log(`  Creator token: ${safeFormatEther(creatorReserve)}`);
    console.log(`  CORAL token: ${safeFormatEther(coralReserve)}`);
  } catch (error) {
    console.error(`❌ Error getting reserves: ${error.message}`);
  }
  
  // Check if DEX has creator tokens
  try {
    const dexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
    console.log(`DEX creator token balance: ${safeFormatEther(dexCreatorBalance)}`);
    
    // Check admin balance of creator tokens
    const adminCreatorBalance = await creatorToken.balanceOf(adminWallet.address);
    console.log(`Admin creator token balance: ${safeFormatEther(adminCreatorBalance)}`);
    
    // Transfer creator tokens to DEX if needed
    const minAmount = safeParseEther("5");
    if (dexCreatorBalance.lt(minAmount)) {
      console.log("DEX needs creator tokens for swaps");
      
      if (adminCreatorBalance.gte(minAmount)) {
        console.log("Transferring creator tokens from admin to DEX...");
        try {
          const transferAmount = safeParseEther("10"); // Transfer 10 tokens to ensure enough liquidity
          const transferTx = await creatorToken.connect(adminWallet).transfer(saraDexAddress, transferAmount);
          console.log(`Transaction submitted: ${transferTx.hash}`);
          await transferTx.wait();
          console.log(`✅ Transferred creator tokens to DEX`);
          
          // Verify transfer
          const newDexBalance = await creatorToken.balanceOf(saraDexAddress);
          console.log(`DEX creator token balance after transfer: ${safeFormatEther(newDexBalance)}`);
        } catch (error) {
          console.error(`❌ Error transferring creator tokens: ${error.message}`);
        }
      } else {
        console.error("❌ Admin doesn't have enough creator tokens to transfer to DEX");
        console.log("You need to obtain creator tokens first. Try minting or acquiring them from the creator.");
      }
    } else {
      console.log("✅ DEX already has sufficient creator tokens");
    }
  } catch (error) {
    console.error(`❌ Error checking creator token balances: ${error.message}`);
  }
  
  // Check if DEX has CORAL tokens
  try {
    const dexCoralBalance = await coralToken.balanceOf(saraDexAddress);
    console.log(`DEX CORAL token balance: ${safeFormatEther(dexCoralBalance)}`);
    
    // Check admin balance of CORAL tokens
    const adminCoralBalance = await coralToken.balanceOf(adminWallet.address);
    console.log(`Admin CORAL token balance: ${safeFormatEther(adminCoralBalance)}`);
    
    const minAmount = safeParseEther("5");
    if (dexCoralBalance.lt(minAmount)) {
      console.log("DEX needs CORAL tokens for swaps");
      
      if (adminCoralBalance.gte(minAmount)) {
        console.log("Transferring CORAL tokens from admin to DEX...");
        try {
          const transferAmount = safeParseEther("10"); // Transfer 10 tokens to ensure enough liquidity
          const transferTx = await coralToken.connect(adminWallet).transfer(saraDexAddress, transferAmount);
          console.log(`Transaction submitted: ${transferTx.hash}`);
          await transferTx.wait();
          console.log(`✅ Transferred CORAL tokens to DEX`);
          
          // Verify transfer
          const newDexBalance = await coralToken.balanceOf(saraDexAddress);
          console.log(`DEX CORAL token balance after transfer: ${safeFormatEther(newDexBalance)}`);
        } catch (error) {
          console.error(`❌ Error transferring CORAL tokens: ${error.message}`);
        }
      } else {
        console.error("❌ Admin doesn't have enough CORAL tokens to transfer to DEX");
      }
    } else {
      console.log("✅ DEX already has sufficient CORAL tokens");
    }
  } catch (error) {
    console.error(`❌ Error checking CORAL token balances: ${error.message}`);
  }
  
  // Check final balances
  try {
    const finalDexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
    const finalDexCoralBalance = await coralToken.balanceOf(saraDexAddress);
    
    console.log("\n=== Final DEX Balances ===");
    console.log(`Creator token: ${safeFormatEther(finalDexCreatorBalance)}`);
    console.log(`CORAL token: ${safeFormatEther(finalDexCoralBalance)}`);
    
    const minAmount = safeParseEther("5");
    if (finalDexCreatorBalance.gte(minAmount) && finalDexCoralBalance.gte(minAmount)) {
      console.log("\n✅ DEX liquidity setup complete! The swap should now work in the UI.");
    } else {
      console.log("\n⚠️ DEX may still not have enough liquidity. Please check the balances and try again if needed.");
    }
  } catch (error) {
    console.error(`❌ Error checking final balances: ${error.message}`);
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in setup script:", error);
    process.exit(1);
  }); 