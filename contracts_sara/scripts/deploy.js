const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Add Coral Chain S token address at the top
const CORAL_TOKEN_ADDRESS = "0xAF93888cbD250300470A1618206e036E11470149"; // Replace with actual Coral token address

async function main() {
  console.log("\n---------------------");
  console.log("🚀 Starting Deployment");
  console.log("---------------------\n");

  // Get the deployer's address and network info
  const [deployer] = await ethers.getSigners();
  const networkName = network.name || `chain-${network.chainId}`;

  console.log("Network:", networkName);
  console.log("Deploying with account:", deployer.address);
  
  // Log initial balance
  const initialBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Initial balance:", ethers.formatEther(initialBalance), "ETH\n");

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)){
    fs.mkdirSync(deploymentsDir);
  }

  // 1. Deploy CreatorToken Factory first
  console.log("1. Deploying CreatorToken Factory...");
  const CreatorToken = await ethers.getContractFactory("CreatorToken");
  
  const creatorToken = await upgrades.deployProxy(CreatorToken, 
    [deployer.address], 
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );

  await creatorToken.waitForDeployment();
  const creatorTokenAddress = await creatorToken.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(creatorTokenAddress);
  
  console.log("✅ CreatorToken deployed:");
  console.log("Proxy:", creatorTokenAddress);
  console.log("Implementation:", implementationAddress);

  // 2. Using existing Coral Token:
  console.log("\n2. Using existing Coral Token:", CORAL_TOKEN_ADDRESS);
  const coralTokenAddress = CORAL_TOKEN_ADDRESS;

  // 3. Deploy SaraLiquidityManager
  console.log("\n3. Deploying SaraLiquidityManager...");
  const SaraLiquidityManager = await ethers.getContractFactory("SaraLiquidityManager");
  const liquidityManager = await SaraLiquidityManager.deploy(coralTokenAddress);
  await liquidityManager.waitForDeployment();
  const liquidityManagerAddress = await liquidityManager.getAddress();
  console.log("✅ SaraLiquidityManager deployed to:", liquidityManagerAddress);


// 🚀 Send Initial S Tokens to Liquidity Manager
console.log("\n💰 Checking deployer's Coral Token balance...");
const coralToken = await ethers.getContractAt("IERC20", CORAL_TOKEN_ADDRESS);

const deployerBalance = await coralToken.balanceOf(deployer.address);
console.log(`Deployer Coral Token Balance: ${ethers.formatEther(deployerBalance)} S`);

const initialLiquidityAmount = ethers.parseEther("10"); // Send 1000 Coral tokens

// 🚨 Check if deployer has enough tokens
if (deployerBalance < initialLiquidityAmount) {
    console.error(`❌ Not enough Coral tokens! Required: ${ethers.formatEther(initialLiquidityAmount)}, Available: ${ethers.formatEther(deployerBalance)}`);
    process.exit(1); // Stop execution
}

// ✅ Proceed with transfer if deployer has enough S tokens
console.log("\n💰 Sending Initial Coral Tokens to Liquidity Manager...");
await coralToken.transfer(liquidityManagerAddress, initialLiquidityAmount);
console.log(`✅ Transferred ${ethers.formatEther(initialLiquidityAmount)} Coral tokens to Liquidity Manager`);


  // 4. Deploy SaraDEX
  console.log("\n4. Deploying SaraDEX...");
  const SaraDEX = await ethers.getContractFactory("SaraDEX");
  const saraDex = await SaraDEX.deploy(coralTokenAddress, liquidityManagerAddress);
  await saraDex.waitForDeployment();
  const saraDexAddress = await saraDex.getAddress();
  console.log("✅ SaraDEX deployed to:", saraDexAddress);

  // 5. Deploy SaraTokenRouter
  console.log("\n5. Deploying SaraTokenRouter...");
  const SaraTokenRouter = await ethers.getContractFactory("SaraTokenRouter");
  const saraRouter = await SaraTokenRouter.deploy(
    coralTokenAddress, 
    liquidityManagerAddress, 
    saraDexAddress,
    creatorTokenAddress  // Add creator token factory address
  );
  await saraRouter.waitForDeployment();
  const saraRouterAddress = await saraRouter.getAddress();
  console.log("✅ SaraTokenRouter deployed to:", saraRouterAddress);

  // Setup initial permissions with explicit await
  console.log("\nSetting up permissions...");
  console.log("1. Setting DEX in Liquidity Manager...");

  // Set DEX instead of granting role
  await liquidityManager.setDEX(saraDexAddress);
  console.log("✅ DEX set in Liquidity Manager");

  // Calculate and format gas cost once
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const gasCost = initialBalance - finalBalance;

  const formattedGasCost = ethers.formatEther(gasCost);
  
  console.log("\n⛽ Gas Report");
  console.log("------------");
  console.log(`Total Deploy Cost: ${formattedGasCost} ETH`);

  // Prepare deployment info with correct network name
  const deploymentInfo = {
    network: network.name || network.chainId.toString(), // Fallback to chainId if name is undefined
    creatorToken: {
      proxy: creatorTokenAddress,
      implementation: implementationAddress
    },
    sara: {
      coralToken: CORAL_TOKEN_ADDRESS,
      liquidityManager: liquidityManagerAddress,
      saraDex: saraDexAddress,
      saraRouter: saraRouterAddress
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    gasCost: formattedGasCost
  };

  // Save to deployments folder with network and timestamp
  const fileName = `deployment-${networkName}-${Date.now()}.json`;

  const filePath = path.join(deploymentsDir, fileName);
  
  fs.writeFileSync(
    filePath,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n📝 Deployment info saved to ${fileName}`);
  console.log("\nTo verify contracts:");
  console.log("1. CreatorToken Implementation:");
  console.log(`npx hardhat verify ${implementationAddress}`);
  console.log("\n2. CoralToken:");
  console.log(`npx hardhat verify ${CORAL_TOKEN_ADDRESS}`);
  console.log("\n3. SaraLiquidityManager:");
  console.log(`npx hardhat verify ${liquidityManagerAddress} "${CORAL_TOKEN_ADDRESS}"`);
  console.log("\n4. SaraDEX:");
  console.log(`npx hardhat verify ${saraDexAddress} "${CORAL_TOKEN_ADDRESS}" "${liquidityManagerAddress}"`);
  console.log("\n5. SaraTokenRouter:");
  console.log(
    `npx hardhat verify ${saraRouterAddress} "${CORAL_TOKEN_ADDRESS}" "${liquidityManagerAddress}" "${saraDexAddress}" "${creatorTokenAddress}"`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment Failed!");
    console.error(error);
    process.exit(1);
  });