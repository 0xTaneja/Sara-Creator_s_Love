const { ethers } = require("hardhat");

async function main() {
  console.log("Sara DEX - Transfer Creator Tokens (Simple Version)\n");

  // Get the deployer account
  const [owner] = await ethers.getSigners();
  console.log("Using account:", owner.address);

  // Contract addresses
  const coralTokenAddress = "0xAF93888cbD250300470A1618206e036E11470149";
  const saraDexAddress = "0xc2600BE1111c8696966726b8cee571E048aFe962";
  
  // The specific creator token address that's failing in the UI
  const creatorTokenAddress = process.argv[2] || "0xc8D712a12E9dEd00BC4F765BcE540CAd70319e58"; // Default to the token from your logs
  
  console.log(`Setting up liquidity for creator token: ${creatorTokenAddress}`);

  // Attach to the contracts
  const coralToken = await ethers.getContractAt("ERC20", coralTokenAddress);
  const creatorToken = await ethers.getContractAt("ERC20", creatorTokenAddress);

  console.log("Contracts loaded successfully");

  // Get token details
  try {
    const name = await creatorToken.name();
    const symbol = await creatorToken.symbol();
    console.log(`Token: ${name} (${symbol})`);
  } catch (error) {
    console.error(`Error getting token details: ${error.message}`);
    console.log("Continuing anyway...");
  }
  
  // Check if DEX has creator tokens
  const dexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
  console.log(`DEX creator token balance: ${ethers.formatEther(dexCreatorBalance)}`);
  
  // Check owner balance of creator tokens
  const ownerCreatorBalance = await creatorToken.balanceOf(owner.address);
  console.log(`Owner creator token balance: ${ethers.formatEther(ownerCreatorBalance)}`);
  
  // Transfer creator tokens to DEX if needed
  if (dexCreatorBalance < ethers.parseEther("5") && ownerCreatorBalance >= ethers.parseEther("5")) {
    console.log("Transferring creator tokens to DEX...");
    try {
      const transferAmount = ethers.parseEther("10"); // Transfer 10 tokens to ensure enough liquidity
      const transferTx = await creatorToken.transfer(saraDexAddress, transferAmount);
      await transferTx.wait();
      console.log(`Transferred creator tokens to DEX, tx hash: ${transferTx.hash}`);
      
      // Verify transfer
      const newDexBalance = await creatorToken.balanceOf(saraDexAddress);
      console.log(`DEX creator token balance after transfer: ${ethers.formatEther(newDexBalance)}`);
    } catch (error) {
      console.error(`Error transferring creator tokens: ${error.message}`);
    }
  } else if (dexCreatorBalance < ethers.parseEther("5")) {
    console.error("Owner doesn't have enough creator tokens to transfer to DEX");
    console.log("You need to obtain creator tokens first. Try minting or acquiring them from the creator.");
  } else {
    console.log("DEX already has sufficient creator tokens");
  }
  
  // Check if DEX has CORAL tokens
  const dexCoralBalance = await coralToken.balanceOf(saraDexAddress);
  console.log(`DEX CORAL token balance: ${ethers.formatEther(dexCoralBalance)}`);
  
  // Check owner balance of CORAL tokens
  const ownerCoralBalance = await coralToken.balanceOf(owner.address);
  console.log(`Owner CORAL token balance: ${ethers.formatEther(ownerCoralBalance)}`);
  
  if (dexCoralBalance < ethers.parseEther("5") && ownerCoralBalance >= ethers.parseEther("5")) {
    console.log("Transferring CORAL tokens to DEX...");
    try {
      const transferAmount = ethers.parseEther("10"); // Transfer 10 tokens to ensure enough liquidity
      const transferTx = await coralToken.transfer(saraDexAddress, transferAmount);
      await transferTx.wait();
      console.log(`Transferred CORAL tokens to DEX, tx hash: ${transferTx.hash}`);
      
      // Verify transfer
      const newDexBalance = await coralToken.balanceOf(saraDexAddress);
      console.log(`DEX CORAL token balance after transfer: ${ethers.formatEther(newDexBalance)}`);
    } catch (error) {
      console.error(`Error transferring CORAL tokens: ${error.message}`);
    }
  } else if (dexCoralBalance < ethers.parseEther("5")) {
    console.error("Owner doesn't have enough CORAL tokens to transfer to DEX");
  } else {
    console.log("DEX already has sufficient CORAL tokens");
  }
  
  // Check final balances
  const finalDexCreatorBalance = await creatorToken.balanceOf(saraDexAddress);
  const finalDexCoralBalance = await coralToken.balanceOf(saraDexAddress);
  
  console.log("\n=== Final DEX Balances ===");
  console.log(`Creator token: ${ethers.formatEther(finalDexCreatorBalance)}`);
  console.log(`CORAL token: ${ethers.formatEther(finalDexCoralBalance)}`);
  
  if (finalDexCreatorBalance >= ethers.parseEther("5") && finalDexCoralBalance >= ethers.parseEther("5")) {
    console.log("\n✅ DEX liquidity setup complete! The swap should now work in the UI.");
  } else {
    console.log("\n⚠️ DEX may still not have enough liquidity. Please check the balances and try again if needed.");
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in setup script:", error);
    process.exit(1);
  }); 