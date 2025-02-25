const { ethers } = require("hardhat");

async function main() {
    console.log("\n------------------------");
    console.log("🚀 Starting Sara Test Suite");
    console.log("------------------------\n");

    const [deployer, user] = await ethers.getSigners();
    console.log("Deployer Address:", deployer.address);
    console.log("User Address:", user.address, "\n");

    // Track initial balance for gas reporting
    const initialBalance = await ethers.provider.getBalance(deployer.address);

    // Contract Addresses
    const CREATOR_TOKEN_FACTORY = "0xdE229f0F195f5D34cf985648e1A8A18dE4979904";
    const SARA_LIQUIDITY_MANAGER = "0x12017A0e4F08d839703f69D54Bee63c25e063dA0";
    const SARA_DEX = "0x214bBfA09Ff868bCb5380B0Bf2A24050478Ac958";
    const SARA_ROUTER = "0x52082A86FA7b602b29b98d56dAE6e58C61F6E201";
    const CORAL_TOKEN = "0xAF93888cbD250300470A1618206e036E11470149";

    // Constants for timing
    let snapshotInterval;
    let discoveryPeriod;

    // Get contract instances once and reuse them
    const CreatorTokenFactory = await ethers.getContractAt("CreatorToken", CREATOR_TOKEN_FACTORY);
    const LiquidityManager = await ethers.getContractAt("SaraLiquidityManager", SARA_LIQUIDITY_MANAGER);
    const DEX = await ethers.getContractAt("SaraDEX", SARA_DEX);
    const Router = await ethers.getContractAt("SaraTokenRouter", SARA_ROUTER);
    const CoralToken = await ethers.getContractAt("IERC20", CORAL_TOKEN);

    try {
        // 1. Test Creator Token Minting
        console.log("🪙 Test 1: Creator Token Minting");
        const creatorDetails = {
            name: "OhSher",
            image: "https://test.image.url",
            channelLink: "https://youtube.com/OhSher",
            subscribers: 200000
        };

        const mintTx = await CreatorTokenFactory.mintToken(
            user.address,
            creatorDetails.name,
            creatorDetails.image,
            creatorDetails.channelLink,
            creatorDetails.subscribers
        );
        await mintTx.wait();
        console.log("✅ Creator Token Minted");

        // Get the minted token address from events
        const creatorTokenAddress = await CreatorTokenFactory.getCreatorToken(creatorDetails.channelLink);
        console.log("Creator Token Address:", creatorTokenAddress);
        
        // Get the CreatorERC20 instance
        const CreatorToken = await ethers.getContractAt("CreatorERC20", creatorTokenAddress);

        // Approve Router before listing
        await CreatorToken.connect(user).approve(SARA_ROUTER, ethers.parseEther("1000000"));
        console.log("✅ Approved Router to spend Creator Tokens");

        // 2. Test Token Listing
        console.log("\n📜 Test 2: Token Listing");

        try {
            console.log("Attempting to list token:", creatorTokenAddress);
            const listTx = await Router.connect(deployer).listNewCreatorToken(
                creatorTokenAddress,
                { gasLimit: 3000000 }
            );
            
            console.log("Waiting for transaction...");
            const receipt = await listTx.wait();
            console.log("Transaction receipt:", receipt.hash);
            console.log("✅ Token Listed Successfully");
        } catch (error) {
            console.error("Listing Error Details:", error);
            throw error;
        }

        // 3. Test Liquidity Management
        console.log("\n💧 Test 3: Liquidity Management");
        
        // Check all balances
        const userBalance = await CoralToken.balanceOf(user.address);
        const deployerBalance = await CoralToken.balanceOf(deployer.address);
        console.log("User CORAL Balance:", ethers.formatEther(userBalance));
        console.log("Deployer CORAL Balance:", ethers.formatEther(deployerBalance));

        const creatorTokenBalance = await CreatorToken.balanceOf(user.address);
        console.log("User's Creator Token Balance:", ethers.formatEther(creatorTokenBalance));

        // Transfer creator tokens to deployer for liquidity
        await CreatorToken.connect(user).approve(deployer.address, ethers.parseEther("1000"));
        await CreatorToken.connect(user).transfer(
            deployer.address,
            ethers.parseEther("1000")
        );
        console.log("✅ Transferred Creator Tokens to deployer");

        // Check contract details using existing LiquidityManager instance
        const owner = await LiquidityManager.owner();
        console.log("Contract Owner:", owner);
        console.log("Deployer Address:", deployer.address);

        const coralToken = await LiquidityManager.coralToken();
        console.log("CORAL Token Address:", coralToken);

        const minLiquidity = await LiquidityManager.MIN_LIQUIDITY();
        console.log("Minimum Liquidity Required:", ethers.formatEther(minLiquidity));

        try {
            // Start price discovery
            console.log("\n🔍 Starting Price Discovery...");
            await LiquidityManager.startPriceDiscovery(
                creatorTokenAddress,
                creatorDetails.subscribers
            );
            console.log("✅ Price Discovery Started");

            // Get discovery period and snapshot interval
            discoveryPeriod = await LiquidityManager.DISCOVERY_PERIOD();
            snapshotInterval = await LiquidityManager.SNAPSHOT_INTERVAL();
            console.log("Discovery Period:", discoveryPeriod.toString(), "seconds");
            console.log("Snapshot Interval:", snapshotInterval.toString(), "seconds");

            // Take engagement snapshots
            console.log("\n📊 Taking Engagement Snapshots...");
            const baseSubscribers = BigInt(creatorDetails.subscribers);
            const growthRate = BigInt(50000);

            // Take only 5 snapshots instead of 6, with 20 second intervals
            for (let i = 0; i < 5; i++) {
                const newSubscribers = baseSubscribers + (growthRate * BigInt(i));
                
                const snapshotTx = await LiquidityManager.recordEngagementSnapshot(
                    creatorTokenAddress,
                    newSubscribers
                );
                await snapshotTx.wait();
                console.log(`✅ Snapshot ${i+1} Recorded (${newSubscribers.toString()} subscribers)`);
                
                const discoveryData = await LiquidityManager.priceDiscovery(creatorTokenAddress);
                console.log(`- Is In Discovery: ${discoveryData.isInDiscovery}`);
                
                const engagement = await LiquidityManager.tokenEngagement(creatorTokenAddress);
                console.log(`- Current Count: ${engagement.lastSubscriberCount}`);
                console.log(`- Smoothed Count: ${engagement.smoothedSubscriberCount}`);
                console.log(`- Updates: ${engagement.updateCount}`);
                
                if (i < 4) { // Wait after first 4 snapshots
                    console.log(`Waiting ${snapshotInterval} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, Number(snapshotInterval) * 1000));
                }
            }

            // Wait for full discovery period after all snapshots
            console.log("\n⌛ Waiting for discovery period to complete...");
            await new Promise(resolve => setTimeout(resolve, 120000)); // Wait full 2 minutes

            // Complete price discovery
            console.log("\n🎯 Attempting to Complete Price Discovery...");
            try {
                const completeTx = await LiquidityManager.completePriceDiscovery(creatorTokenAddress);
                await completeTx.wait();
                console.log("✅ Price Discovery Completed Successfully!");
            } catch (error) {
                console.error("Failed to complete price discovery:", error.message);
                throw error;
            }

            // Add liquidity
            console.log("\nAdding initial liquidity...");
            const creatorTokenAmount = ethers.parseEther("10");
            const coralTokenAmount = ethers.parseEther("5");

            // Approve both tokens before adding liquidity
            await CreatorToken.connect(deployer).approve(SARA_LIQUIDITY_MANAGER, creatorTokenAmount);
            console.log("✅ Approved LiquidityManager to spend Creator Tokens");

            await CoralToken.connect(deployer).approve(SARA_LIQUIDITY_MANAGER, coralTokenAmount);
            console.log("✅ Approved LiquidityManager to spend CORAL Tokens");

            // Check balances before adding liquidity
            const deployerCreatorBalance = await CreatorToken.balanceOf(deployer.address);
            const deployerCoralBalance = await CoralToken.balanceOf(deployer.address);
            
            console.log("\nBalances before adding liquidity:");
            console.log("Deployer Creator Token Balance:", ethers.formatEther(deployerCreatorBalance));
            console.log("Deployer CORAL Balance:", ethers.formatEther(deployerCoralBalance));

            // Verify sufficient balances
            if (deployerCreatorBalance < creatorTokenAmount) {
                console.error("❌ Insufficient Creator Token balance");
                process.exit(1);
            }
            if (deployerCoralBalance < coralTokenAmount) {
                console.error("❌ Insufficient CORAL balance");
                process.exit(1);
            }

            // Add liquidity
            const addLiquidityTx = await LiquidityManager.connect(deployer).addLiquidity(
                creatorTokenAddress,
                creatorTokenAmount,
                coralTokenAmount,
                { gasLimit: 3000000 }
            );
            
            console.log("Waiting for liquidity transaction...");
            const receipt = await addLiquidityTx.wait();
            console.log("Transaction hash:", receipt.hash);
            console.log("✅ Initial Liquidity Added");

            // Verify liquidity
            const [creatorReserve, coralReserve] = await LiquidityManager.getReserves(creatorTokenAddress);
            console.log("\nFinal Reserves:");
            console.log("Creator Token Reserve:", ethers.formatEther(creatorReserve));
            console.log("CORAL Reserve:", ethers.formatEther(coralReserve));

        } catch (error) {
            console.error("Liquidity Addition Error:", error);
            throw error;
        }

        // Wait for engagement snapshot
        console.log(`Waiting ${snapshotInterval.toString()} seconds before next snapshot...`);
        await new Promise(resolve => setTimeout(resolve, Number(snapshotInterval) * 1000));

        // 4. Test Token Swapping
        console.log("\n🔄 Test 4: Token Swapping");

        try {
            // Check reserves before swap
            const [creatorReserve, coralReserve] = await LiquidityManager.getReserves(creatorTokenAddress);
            console.log("Checking if reserves are sufficient for swap...");
            console.log("- Creator Token Reserve:", ethers.formatEther(creatorReserve));
            console.log("- CORAL Reserve:", ethers.formatEther(coralReserve));

            const swapAmount = ethers.parseEther("5");
            if (creatorReserve < swapAmount || coralReserve < swapAmount) {
                console.error("❌ Insufficient reserves for swap!");
                return;
            }

            // Check balances before swap
            console.log("\nChecking balances before swap...");
            const dexBalance = await CoralToken.balanceOf(SARA_DEX);
            const lmBalance = await CoralToken.balanceOf(SARA_LIQUIDITY_MANAGER);
            console.log("DEX CORAL Balance:", ethers.formatEther(dexBalance));
            console.log("Liquidity Manager CORAL Balance:", ethers.formatEther(lmBalance));

            // Approve DEX to spend Creator tokens before swap
            await CreatorToken.connect(user).approve(SARA_DEX, swapAmount);
            console.log("✅ Approved DEX to spend Creator Tokens for swap");

            // Perform swap
            console.log("\nAttempting swap...");
            const swapTx = await DEX.connect(user).swapCreatorTokenForCoral(
                    creatorTokenAddress,
                swapAmount,
                0,  // minAmountOut
                    500, // 5% slippage
                    { gasLimit: 3000000 }
                );

            const receipt = await swapTx.wait();
            console.log("✅ Swap successful! Transaction:", receipt.hash);

            // Check balances after swap
            const newDexBalance = await CoralToken.balanceOf(SARA_DEX);
            const newLmBalance = await CoralToken.balanceOf(SARA_LIQUIDITY_MANAGER);
            console.log("\nBalances after swap:");
            console.log("DEX CORAL Balance:", ethers.formatEther(newDexBalance));
            console.log("Liquidity Manager CORAL Balance:", ethers.formatEther(newLmBalance));

        } catch (error) {
            console.error("❌ Swap failed:", error);
            throw error;
        }

        console.log("\n✅ All Tests Completed Successfully!");

        // Report gas usage
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        console.log("\n⛽ Gas Report");
        console.log("------------");
        console.log("Total Cost:", ethers.formatEther(initialBalance.sub(finalBalance)), "ETH");

    } catch (error) {
        console.error("\n❌ Test Failed!");
        console.error(error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test Suite Failed!");
        console.error(error);
        process.exit(1);
    });