const { ethers } = require("hardhat");

async function main() {
  console.log("Updating Reserves in Liquidity Manager");
  
  // Get signers
  const [owner] = await ethers.getSigners();
  console.log("Using owner account:", owner.address);
  
  // Contract addresses (from previous test)
  const CORAL_TOKEN_ADDRESS = "0xAF93888cbD250300470A1618206e036E11470149";
  const CREATOR_TOKEN_ADDRESS = "0x306fcE70272D522B412dD7bB958F7e6DC23cadeF";
  const SARA_DEX_ADDRESS = "0xc2600BE1111c8696966726b8cee571E048aFe962";
  
  // Attach to contracts
  console.log("Attaching to contracts...");
  const coralToken = await ethers.getContractAt("IERC20", CORAL_TOKEN_ADDRESS);
  const creatorToken = await ethers.getContractAt("IERC20", CREATOR_TOKEN_ADDRESS);
  const saraDex = await ethers.getContractAt("SaraDEX", SARA_DEX_ADDRESS);
  
  // Get the liquidity manager address
  const liquidityManagerAddress = await saraDex.liquidityManager();
  console.log("Liquidity Manager Address:", liquidityManagerAddress);
  const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", liquidityManagerAddress);
  
  // Check current reserves
  const currentReserves = await liquidityManager.getReserves(CREATOR_TOKEN_ADDRESS);
  console.log("Current Reserves in Liquidity Manager:");
  console.log("Creator Token Reserve:", ethers.formatEther(currentReserves[0]));
  console.log("CORAL Reserve:", ethers.formatEther(currentReserves[1]));
  
  // Check actual balances
  const dexCoralBalance = await coralToken.balanceOf(SARA_DEX_ADDRESS);
  const dexCreatorBalance = await creatorToken.balanceOf(SARA_DEX_ADDRESS);
  const liquidityManagerCoralBalance = await coralToken.balanceOf(liquidityManagerAddress);
  const liquidityManagerCreatorBalance = await creatorToken.balanceOf(liquidityManagerAddress);
  
  console.log("\nActual Balances:");
  console.log("DEX CORAL Balance:", ethers.formatEther(dexCoralBalance));
  console.log("DEX Creator Token Balance:", ethers.formatEther(dexCreatorBalance));
  console.log("Liquidity Manager CORAL Balance:", ethers.formatEther(liquidityManagerCoralBalance));
  console.log("Liquidity Manager Creator Token Balance:", ethers.formatEther(liquidityManagerCreatorBalance));
  
  // Try to find functions to update reserves
  console.log("\nLooking for functions to update reserves...");
  
  // Check if the owner has the LIQUIDITY_MANAGER_ROLE
  const LIQUIDITY_MANAGER_ROLE = await saraDex.LIQUIDITY_MANAGER_ROLE();
  const hasRole = await saraDex.hasRole(LIQUIDITY_MANAGER_ROLE, owner.address);
  console.log("Owner has LIQUIDITY_MANAGER_ROLE:", hasRole);
  
  if (!hasRole) {
    console.log("Granting LIQUIDITY_MANAGER_ROLE to owner...");
    try {
      const grantRoleTx = await saraDex.grantRole(LIQUIDITY_MANAGER_ROLE, owner.address);
      console.log("Grant role transaction hash:", grantRoleTx.hash);
      await grantRoleTx.wait();
      console.log("Role granted successfully");
    } catch (error) {
      console.log("Failed to grant role:", error.message);
    }
  }
  
  // Try to find a function to update reserves
  console.log("\nChecking available functions in the Liquidity Manager...");
  
  try {
    // Check if there's an updateReserves function
    if (typeof liquidityManager.updateReserves === 'function') {
      console.log("Found updateReserves function. Attempting to update reserves...");
      const updateTx = await liquidityManager.updateReserves(CREATOR_TOKEN_ADDRESS);
      console.log("Update reserves transaction hash:", updateTx.hash);
      await updateTx.wait();
      console.log("Reserves updated successfully");
    } else if (typeof liquidityManager.syncReserves === 'function') {
      console.log("Found syncReserves function. Attempting to sync reserves...");
      const syncTx = await liquidityManager.syncReserves(CREATOR_TOKEN_ADDRESS);
      console.log("Sync reserves transaction hash:", syncTx.hash);
      await syncTx.wait();
      console.log("Reserves synced successfully");
    } else {
      console.log("No direct reserve update function found.");
      
      // Try to add liquidity to force an update
      console.log("Attempting to add a small amount of liquidity to force an update...");
      
      // Approve tokens for liquidity manager
      const minLiquidity = ethers.parseEther("10"); // 10 CORAL minimum liquidity
      
      console.log("Approving CORAL tokens for Liquidity Manager...");
      const coralApprovalTx = await coralToken.approve(liquidityManagerAddress, minLiquidity);
      console.log("CORAL approval transaction hash:", coralApprovalTx.hash);
      await coralApprovalTx.wait();
      
      console.log("Approving Creator tokens for Liquidity Manager...");
      const creatorApprovalTx = await creatorToken.approve(liquidityManagerAddress, minLiquidity);
      console.log("Creator token approval transaction hash:", creatorApprovalTx.hash);
      await creatorApprovalTx.wait();
      
      if (typeof liquidityManager.addLiquidity === 'function') {
        console.log("Found addLiquidity function. Attempting to add liquidity...");
        const addLiquidityTx = await liquidityManager.addLiquidity(
          CREATOR_TOKEN_ADDRESS,
          minLiquidity,
          minLiquidity
        );
        console.log("Add liquidity transaction hash:", addLiquidityTx.hash);
        await addLiquidityTx.wait();
        console.log("Liquidity added successfully");
      } else {
        console.log("No addLiquidity function found.");
      }
    }
    
    // Check reserves after update attempt
    const updatedReserves = await liquidityManager.getReserves(CREATOR_TOKEN_ADDRESS);
    console.log("\nReserves after update attempt:");
    console.log("Creator Token Reserve:", ethers.formatEther(updatedReserves[0]));
    console.log("CORAL Reserve:", ethers.formatEther(updatedReserves[1]));
  } catch (error) {
    console.log("Error updating reserves:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in tests:", error);
    process.exit(1);
  }); 