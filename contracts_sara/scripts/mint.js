const { ethers } = require("hardhat");

async function main() {
  console.log("\n---------------------");
  console.log("🎯 Starting Token Mint");
  console.log("---------------------\n");

  const [deployer] = await ethers.getSigners();
  const factoryAddress = process.env.CONTRACT_ADDRESS;
  
  if (!factoryAddress) {
    throw new Error("CONTRACT_ADDRESS not set in environment variables");
  }

  console.log("Factory Address:", factoryAddress);
  console.log("Minting from:", deployer.address);

  const factory = await ethers.getContractAt("CreatorToken", factoryAddress);

  // Creator details
  const creatorDetails = {
    address: deployer.address,
    name: "PewDiePie",
    imageUrl: "https://yt3.ggpht.com/vik8mAiwHQbXiFyKfZ3__p55_VBdGvwxPpuPJBBwdbF0PjJxikXhrP-C3nLQAMAxGNd_-xQCIg=s176-c-k-c0x00ffffff-no-rj-mo",
    channelLink: "https://youtube.com/@PewDiePie",
    subscribers: 111000000
  };

  try {
    // Check if token already exists
    console.log("\nChecking if creator token already exists...");
    const exists = await factory.isTokenMinted(creatorDetails.channelLink);
    
    if (exists) {
      const existingAddress = await factory.getCreatorToken(creatorDetails.channelLink);
      throw new Error(`Token already exists for this creator at address: ${existingAddress}`);
    }

    console.log("Creator token doesn't exist. Proceeding with mint...\n");

    // Log initial balance for gas reporting
    const initialBalance = await ethers.provider.getBalance(deployer.address);

    // Mint new token
    console.log("Minting new creator token...");
    const tx = await factory.mintToken(
      creatorDetails.address,
      creatorDetails.name,
      creatorDetails.imageUrl,
      creatorDetails.channelLink,
      creatorDetails.subscribers
    );

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (!receipt.status) {
      throw new Error("Transaction failed");
    }

    // Get new token details
    const tokenAddress = await factory.getCreatorToken(creatorDetails.channelLink);
    const creatorToken = await ethers.getContractAt("CreatorERC20", tokenAddress);

    console.log("\n✅ Token Minted Successfully!");
    console.log("------------------------");
    console.log("Token Address:", tokenAddress);
    console.log("\n📊 Token Details");
    console.log("---------------");
    console.log("Name:", await creatorToken.name());
    console.log("Symbol:", await creatorToken.symbol());
    console.log("Creator Name:", await creatorToken.creatorName());
    console.log("Channel Link:", await creatorToken.channelLink());
    console.log("Subscribers:", (await creatorToken.subscribers()).toString());
    console.log("Milestone:", await creatorToken.milestone());

    // Gas reporting
    const finalBalance = await ethers.provider.getBalance(deployer.address);
    const gasCost = initialBalance - finalBalance;
    
    console.log("\n⛽ Gas Report");
    console.log("------------");
    console.log("Mint Cost:", ethers.formatEther(gasCost), "ETH");
    
  } catch (error) {
    console.error("\n❌ Minting Failed!");
    console.error("Error Details:");
    
    if (error.message) {
      console.error("- Message:", error.message);
    }
    
    if (error.data) {
      console.error("- Contract Error:", error.data.message);
    }
    
    if (error.transaction) {
      console.error("- Failed Transaction:", error.transaction);
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script Execution Failed!");
    console.error(error);
    process.exit(1);
  });