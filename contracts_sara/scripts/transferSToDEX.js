const { ethers } = require("hardhat");

async function main() {
    console.log("\n------------------------");
    console.log("🚀 Transferring CORAL Tokens to DEX");
    console.log("------------------------\n");

    const [deployer] = await ethers.getSigners();

    // Contract addresses
    const SARA_LIQUIDITY_MANAGER = "0x12017A0e4F08d839703f69D54Bee63c25e063dA0";
    const SARA_DEX = "0x214bBfA09Ff868bCb5380B0Bf2A24050478Ac958";
    const CORAL_TOKEN = "0xAF93888cbD250300470A1618206e036E11470149";

    // Get contract instances
    const liquidityManager = await ethers.getContractAt("SaraLiquidityManager", SARA_LIQUIDITY_MANAGER);
    const coralTokenContract = await ethers.getContractAt("IERC20", CORAL_TOKEN);

    console.log("Checking initial balances...");
    const initialDexBalance = await coralTokenContract.balanceOf(SARA_DEX);
    const initialLmBalance = await coralTokenContract.balanceOf(SARA_LIQUIDITY_MANAGER);

    console.log("DEX CORAL Balance:", ethers.formatEther(initialDexBalance));
    console.log("Liquidity Manager CORAL Balance:", ethers.formatEther(initialLmBalance));

    const amountToTransfer = ethers.parseEther("5");

    if (initialLmBalance < amountToTransfer) {
        console.error("❌ Not enough CORAL tokens in Liquidity Manager");
        return;
    }

    try {
        console.log("\nApproving Liquidity Manager to transfer CORAL tokens...");
        const approveTx = await coralTokenContract.connect(deployer).approve(SARA_LIQUIDITY_MANAGER, amountToTransfer);
        await approveTx.wait();
        console.log("✅ Approval granted");

        console.log("\nCalling `transferCoralToDEX()` from Liquidity Manager...");
        const tx = await liquidityManager.connect(deployer).transferCoralToDEX(amountToTransfer);
        const receipt = await tx.wait();
        console.log("Transaction Hash:", receipt.hash);
        console.log("✅ CORAL tokens transferred to DEX, Gas Used:", receipt.gasUsed.toString());

        // Verify new balances
        const finalDexBalance = await coralTokenContract.balanceOf(SARA_DEX);
        const finalLmBalance = await coralTokenContract.balanceOf(SARA_LIQUIDITY_MANAGER);

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
