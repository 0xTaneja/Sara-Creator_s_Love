const { ethers } = require("hardhat");

async function checkCreatorToken(factory, creatorId, deployer, admin) {
  try {
    const isMinted = await factory.isTokenMinted(creatorId);
    console.log(`\n📊 Checking token for ${creatorId}`);
    console.log("------------------------");
    
    if (!isMinted) {
      console.log("❌ Token not minted yet");
      return;
    }

    const tokenAddress = await factory.getCreatorToken(creatorId);
    console.log("Token Address:", tokenAddress);

    const creatorToken = await ethers.getContractAt("CreatorERC20", tokenAddress);
    
    // Get token metadata
    const metadata = await creatorToken.getCreatorMetadata();
    console.log("\nToken Details:");
    console.log("-------------");
    console.log("Name:", metadata[0]);
    console.log("Symbol:", metadata[1]);
    console.log("Creator Name:", metadata[2]);
    console.log("Image URL:", metadata[3]);
    console.log("Channel Link:", metadata[4]);
    console.log("Subscribers:", metadata[5].toString());
    console.log("Milestone:", metadata[6]);

    // Get supply and balance information
    const totalSupply = await creatorToken.totalSupply();
    console.log("\nSupply Information:");
    console.log("------------------");
    console.log("Total Supply:", ethers.formatEther(totalSupply), "tokens");
    
    // Check balances
    const deployerBalance = await creatorToken.balanceOf(deployer);
    const adminBalance = await creatorToken.balanceOf(admin);
    
    console.log("\nBalance Information:");
    console.log("-------------------");
    console.log("Deployer Balance:", ethers.formatEther(deployerBalance), "tokens");
    console.log("Admin Balance:", ethers.formatEther(adminBalance), "tokens");

    return true;
  } catch (error) {
    console.error(`Error checking token for ${creatorId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("\n------------------------");
  console.log("🔍 Token Details Checker");
  console.log("------------------------");

  const [deployer] = await ethers.getSigners();
  const factoryAddress = process.env.CONTRACT_ADDRESS;
  
  if (!factoryAddress) {
    throw new Error("CONTRACT_ADDRESS not set in environment variables");
  }

  console.log("\nFactory Address:", factoryAddress);
  console.log("Checking from:", deployer.address);

  const factory = await ethers.getContractAt("CreatorToken", factoryAddress);
  const admin = await factory.owner();

  // List of creators to check
  const creators = [
    "https://youtube.com/@PewDiePie",
    "https://youtube.com/@MrBeast",
    // Add more creators as needed
  ];

  console.log("\n📝 Checking", creators.length, "creators...");
  
  let successCount = 0;
  for (const creator of creators) {
    const success = await checkCreatorToken(factory, creator, deployer.address, admin);
    if (success) successCount++;
  }

  console.log("\n✅ Check Complete");
  console.log("----------------");
  console.log(`Successfully checked ${successCount}/${creators.length} tokens`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Check Failed!");
    console.error("Error Details:", error.message);
    process.exit(1);
  });