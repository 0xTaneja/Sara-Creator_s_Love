const { ethers } = require("hardhat");

async function main() {
    console.log("\n------------------------");
    console.log("🚀 Transferring CORAL Tokens to DEX");
    console.log("------------------------\n");

    const [deployer] = await ethers.getSigners();

    // Contract addresses - Updated from latest deployment
    const CONTRACT_ADDRESSES = {
        CORAL_TOKEN: "0xAF93888cbD250300470A1618206e036E11470149",
        SARA_DEX: "0x380c13351758294cCF41CA0c14B3bb6f8268Acd4",
        LIQUIDITY_MANAGER: "0x818A94419E0D1B9e990A912d601Ae66c517B9B82"
    };

    // Get contract instances
    const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", CONTRACT_ADDRESSES.LIQUIDITY_MANAGER);
    const coralTokenContract = await ethers.getContractAt("IERC20", CONTRACT_ADDRESSES.CORAL_TOKEN);

    console.log("Checking initial balances...");
    const initialDexBalance = await coralTokenContract.balanceOf(CONTRACT_ADDRESSES.SARA_DEX);
    const initialLmBalance = await coralTokenContract.balanceOf(CONTRACT_ADDRESSES.LIQUIDITY_MANAGER);

    console.log("DEX CORAL Balance:", ethers.formatEther(initialDexBalance));
    console.log("Liquidity Manager CORAL Balance:", ethers.formatEther(initialLmBalance));

    const amountToTransfer = ethers.parseEther("5");

    if (initialLmBalance < amountToTransfer) {
        console.error("❌ Not enough CORAL tokens in Liquidity Manager");
        return;
    }

    try {
        console.log("\nApproving Liquidity Manager to transfer CORAL tokens...");
        const approveTx = await coralTokenContract.connect(deployer).approve(CONTRACT_ADDRESSES.LIQUIDITY_MANAGER, amountToTransfer);
        await approveTx.wait();
        console.log("✅ Approval granted");

        console.log("\nCalling `transferCoralToDEX()` from Liquidity Manager...");
        const tx = await liquidityManager.connect(deployer).transferCoralToDEX(amountToTransfer);
        const receipt = await tx.wait();
        console.log("Transaction Hash:", receipt.hash);
        console.log("✅ CORAL tokens transferred to DEX, Gas Used:", receipt.gasUsed.toString());

        // Verify new balances
        const finalDexBalance = await coralTokenContract.balanceOf(CONTRACT_ADDRESSES.SARA_DEX);
        const finalLmBalance = await coralTokenContract.balanceOf(CONTRACT_ADDRESSES.LIQUIDITY_MANAGER);

        console.log("\n🔍 Balance Updates:");
        console.log("- DEX CORAL Balance Change:", ethers.formatEther(finalDexBalance.sub(initialDexBalance)));
        console.log("- Liquidity Manager CORAL Balance Change:", ethers.formatEther(initialLmBalance.sub(finalLmBalance)));

    } catch (error) {
        console.error("❌ Transfer failed:", error.reason || error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
