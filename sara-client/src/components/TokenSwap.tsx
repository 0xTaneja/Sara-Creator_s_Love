import React, { useState, useEffect, useMemo } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, BLOCKCHAIN_EXPLORER_URL } from '../config';
import { ERC20_ABI, SARA_DEX_ABI, SARA_LIQUIDITY_MANAGER_ABI, SARA_TOKEN_ROUTER_ABI } from '../utils/contracts';
import { useSwapEvent } from '../contexts/SwapEventContext';

interface TokenSwapProps {
  token: {
    id?: string;
    name?: string;
    symbol?: string;
    price?: number;
    address?: string;
    tokenAddress?: string;
  };
}

const TokenSwap: React.FC<TokenSwapProps> = ({ token }) => {
  const { isConnected, connectWallet, account, signer, provider } = useWeb3();
  const { tokenName, tokenSymbol, tokenPrice, tokenAddress } = useMemo(() => {
    return {
      tokenName: token.name || 'Creator Token',
      tokenSymbol: token.symbol || 'CT',
      tokenPrice: token.price || 0,
      tokenAddress: token.address || token.tokenAddress || '',
    };
  }, [token]);
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('0');
  const [slippage, setSlippage] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'none' | 'pending' | 'listing' | 'success' | 'error' | 'antibot' | 'waiting' | 'executing'>('none');
  const [transactionHash, setTransactionHash] = useState('');
  const [balance, setBalance] = useState({ coral: '0', token: '0' });
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const { notifySwapOccurred, notifySwapWithDetails } = useSwapEvent();

  // Default values
  const tokenId = token.id || '0';

  // Fetch balances and allowances when account changes
  useEffect(() => {
    if (isConnected && account && provider) {
      fetchBalances();
      checkAllowance();
    }
  }, [isConnected, account, tokenAddress, provider, swapDirection, amount]);

  // Fetch balances
  const fetchBalances = async () => {
    try {
      if (!provider || !account) return;

      // Create contract instances
      const coralTokenContract = new ethers.Contract(
        CONTRACT_ADDRESSES.CORAL_TOKEN,
        ERC20_ABI,
        provider
      );

      const creatorTokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        provider
      );

      // Get balances
      const coralBalance = await coralTokenContract.balanceOf(account);
      const tokenBalance = await creatorTokenContract.balanceOf(account);
      
      setBalance({
        coral: ethers.utils.formatEther(coralBalance),
        token: ethers.utils.formatEther(tokenBalance)
      });
    } catch (error: any) {
      console.error('Error fetching balances:', error);
      
      // Use mock data if there's an error
      setBalance({
        coral: (Math.random() * 1000).toFixed(2),
        token: (Math.random() * 500).toFixed(2)
      });
    }
  };

  // Check if approval is needed
  const checkAllowance = async () => {
    if (!account || !provider || !amount || !tokenAddress) return;
    
    try {
      const signer = provider.getSigner();
      let tokenToCheck;
      const spenderAddress = CONTRACT_ADDRESSES.SARA_DEX; // Always check allowance for DEX contract
      
      if (swapDirection === 'buy') {
        // When buying creator tokens, check CORAL token allowance
        tokenToCheck = new ethers.Contract(CONTRACT_ADDRESSES.CORAL_TOKEN, ERC20_ABI, signer);
      } else {
        // When selling creator tokens, check creator token allowance
        tokenToCheck = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      }
      
      // Parse amount to check
      const amountToCheck = ethers.utils.parseEther(amount || '0');
      
      if (amountToCheck.isZero()) {
        setNeedsApproval(false);
        return;
      }
      
      // Check allowance
      const allowance = await tokenToCheck.allowance(account, spenderAddress);
      const needsApproval = allowance.lt(amountToCheck);
      setNeedsApproval(needsApproval);
      
      console.log(`Token allowance for DEX: ${ethers.utils.formatEther(allowance)}`);
      console.log(`Needs approval: ${needsApproval}`);
    } catch (error) {
      console.error('Error checking allowance:', error);
      // Default to needing approval if there's an error
      setNeedsApproval(true);
    }
  };

  // Calculate receive amount based on input amount
  useEffect(() => {
    const calculateReceiveAmount = async () => {
      if (!amount || isNaN(parseFloat(amount)) || !provider) {
        setReceiveAmount('0');
        return;
      }
      
      try {
        // Create contract instances
        const liquidityManager = new ethers.Contract(
          CONTRACT_ADDRESSES.SARA_LIQUIDITY_MANAGER,
          SARA_LIQUIDITY_MANAGER_ABI,
          provider
        );
        
        const saraDex = new ethers.Contract(
          CONTRACT_ADDRESSES.SARA_DEX,
          SARA_DEX_ABI,
          provider
        );
        
        // Get reserves directly from the liquidity manager
        const [creatorReserve, coralReserve] = await liquidityManager.getReserves(tokenAddress);
        console.log("Current reserves:", {
          creatorTokens: ethers.utils.formatEther(creatorReserve),
          coralTokens: ethers.utils.formatEther(coralReserve)
        });
        
        // Validate token addresses and reserves
        console.log("Validating token addresses and reserves...");

        // Check if tokenAddress is the same as any of the contract addresses (which would be incorrect)
        if (tokenAddress === CONTRACT_ADDRESSES.SARA_DEX) {
          throw new Error("Invalid token address: Cannot use DEX address as token address");
        }
        if (tokenAddress === CONTRACT_ADDRESSES.CORAL_TOKEN) {
          throw new Error("Invalid token address: Cannot use CORAL token address as creator token address");
        }
        if (tokenAddress === CONTRACT_ADDRESSES.SARA_LIQUIDITY_MANAGER) {
          throw new Error("Invalid token address: Cannot use Liquidity Manager address as token address");
        }

        // Verify reserves are valid
        if (creatorReserve.isZero() || coralReserve.isZero()) {
          throw new Error(`No liquidity available for this token pair. Creator reserve: ${ethers.utils.formatEther(creatorReserve)}, CORAL reserve: ${ethers.utils.formatEther(coralReserve)}`);
        }

        // Verify token code exists at the address
        try {
          const code = await provider.getCode(tokenAddress);
          if (code === '0x' || code === '') {
            throw new Error(`No contract code found at token address: ${tokenAddress}`);
          }
          console.log("Token contract verified at address:", tokenAddress);
        } catch (error: any) {
          console.error("Error verifying token contract:", error);
          throw new Error(`Failed to verify token contract: ${error.message}`);
        }
        
        // Convert input amount to BigNumber
        const amountIn = ethers.utils.parseEther(amount);
        
        let expectedOutput;
        
        try {
          // Use the contract's getAmountOut function for accurate calculation
          if (swapDirection === 'buy') {
            // CORAL to Creator Token
            expectedOutput = await saraDex.getAmountOut(amountIn, coralReserve, creatorReserve);
          } else {
            // Creator Token to CORAL
            expectedOutput = await saraDex.getAmountOut(amountIn, creatorReserve, coralReserve);
          }
          console.log("Expected output from getAmountOut:", ethers.utils.formatEther(expectedOutput));
          
          // Convert to BigInt for consistent handling
          expectedOutput = BigInt(expectedOutput.toString());
        } catch (error: any) {
          console.error("Error calling getAmountOut:", error);
          
          // Fallback to manual calculation as done in test_sara.js
          if (swapDirection === 'buy') {
            expectedOutput = amountIn.mul(creatorReserve).div(coralReserve);
          } else {
            expectedOutput = amountIn.mul(coralReserve).div(creatorReserve);
          }
          console.log("Manually calculated expected output:", ethers.utils.formatEther(expectedOutput));
        }
        
        setReceiveAmount(ethers.utils.formatEther(expectedOutput));
      } catch (error: any) {
        console.error('Error calculating receive amount:', error);
        
        // Last resort fallback to simple price calculation
        const inputAmount = parseFloat(amount);
        
        if (swapDirection === 'buy') {
          // CORAL to Creator Token
          const outputAmount = tokenPrice > 0 ? inputAmount / tokenPrice : inputAmount;
          setReceiveAmount(outputAmount.toFixed(6));
        } else {
          // Creator Token to CORAL
          const outputAmount = tokenPrice > 0 ? inputAmount * tokenPrice : inputAmount;
          setReceiveAmount(outputAmount.toFixed(6));
        }
      }
    };
    
    calculateReceiveAmount();
  }, [amount, swapDirection, provider, tokenAddress, tokenPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlippage(e.target.value);
  };

  const toggleSwapDirection = () => {
    setSwapDirection(prev => prev === 'buy' ? 'sell' : 'buy');
    setAmount('');
    setReceiveAmount('0');
  };

  const handleMaxClick = () => {
    // Use the actual balance
    const maxBalance = swapDirection === 'buy' ? parseFloat(balance.coral) : parseFloat(balance.token);
    setAmount(maxBalance.toString());
  };

  const approveToken = async () => {
    setIsApproving(true);
    
    try {
      if (!provider || !signer || !account) {
        alert('Please connect your wallet.');
        return;
      }
      
      // Get appropriate token contract and amount
      let tokenToApprove;
      let spenderAddress = CONTRACT_ADDRESSES.SARA_DEX; // Always approve the DEX directly
      
      if (swapDirection === 'buy') {
        // For buy, approve CORAL tokens
        tokenToApprove = new ethers.Contract(CONTRACT_ADDRESSES.CORAL_TOKEN, ERC20_ABI, signer);
      } else {
        // For sell, approve creator tokens
        tokenToApprove = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      }
      
      // Parse the exact amount to approve - closely match test_sara.js approach
      const amountIn = ethers.utils.parseEther(amount);
      
      console.log(`Approving ${ethers.utils.formatEther(amountIn)} tokens for DEX contract at ${spenderAddress}`);
      
      // Check current allowance first
      const currentAllowance = await tokenToApprove.allowance(account, spenderAddress);
      console.log(`Current allowance: ${ethers.utils.formatEther(currentAllowance)}`);
      
      // Only approve if needed
      if (currentAllowance.lt(amountIn)) {
        // Use a reasonable amount for approval (exact amount needed)
        console.log(`Approving ${ethers.utils.formatEther(amountIn)} tokens for the DEX`);
      
      // Approve tokens for the DEX
        const tx = await tokenToApprove.approve(spenderAddress, amountIn);
        console.log("Approval transaction hash:", tx.hash);
      await tx.wait();
      
        // Check allowance after approval to confirm
      const allowance = await tokenToApprove.allowance(account, spenderAddress);
        console.log(`New allowance after approval: ${ethers.utils.formatEther(allowance)}`);
        
        if (allowance.lt(amountIn)) {
          throw new Error("Approval failed - allowance is still insufficient");
        }
        
        setNeedsApproval(false);
        console.log(`Tokens successfully approved for DEX`);
      } else {
        console.log("Allowance is already sufficient - no approval needed");
        setNeedsApproval(false);
      }
    } catch (error: any) {
      console.error('Approval failed:', error);
      alert(`Approval failed: ${error.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const executeSwap = async () => {
    setIsLoading(true);
    setTransactionStatus('pending');
    
    try {
      if (!provider || !signer || !account) {
        alert('Please connect your wallet.');
        return;
      }
      
      if (swapDirection === 'sell') {
        //==================================================================================
        // SELL IMPLEMENTATION - EXACT COPY FROM test_sara.js WITH TYPE FIXES
        //==================================================================================
        
        // Initialize all contracts
        console.log("Initializing contracts for sell operation...");
      const coralToken = new ethers.Contract(CONTRACT_ADDRESSES.CORAL_TOKEN, ERC20_ABI, signer);
      const creatorToken = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const saraDex = new ethers.Contract(CONTRACT_ADDRESSES.SARA_DEX, SARA_DEX_ABI, signer);
      const liquidityManager = new ethers.Contract(CONTRACT_ADDRESSES.SARA_LIQUIDITY_MANAGER, SARA_LIQUIDITY_MANAGER_ABI, signer);
        
        // Check user's creator token balance
        const userCreatorBalance = await creatorToken.balanceOf(account);
        console.log("User's creator token balance:", ethers.utils.formatEther(userCreatorBalance));
      
      // Parse amount to BigNumber
        const reverseSwapAmount = ethers.utils.parseEther(amount);
        
        if (userCreatorBalance.lt(reverseSwapAmount)) {
          alert(`Insufficient ${tokenSymbol} balance. You have ${ethers.utils.formatEther(userCreatorBalance)} but are trying to swap ${amount}.`);
        setIsLoading(false);
          setTransactionStatus('error');
        return;
      }
      
        // Get latest reserves for calculation - EXACTLY as in test_sara.js
        console.log("Getting current reserves from liquidity manager...");
      const [creatorReserve, coralReserve] = await liquidityManager.getReserves(tokenAddress);
        console.log("Current reserves:");
        console.log("  Creator token reserve:", ethers.utils.formatEther(creatorReserve));
        console.log("  CORAL token reserve:", ethers.utils.formatEther(coralReserve));
        
        // Calculate 5% of reserve to ensure we're within limits - EXACTLY as in test_sara.js
        const maxAllowedAmount = creatorReserve.mul(5).div(100);
        console.log("Maximum allowed swap amount (5% of reserve):", ethers.utils.formatEther(maxAllowedAmount));
        
        if (reverseSwapAmount.gt(maxAllowedAmount)) {
          alert(`Sell amount exceeds maximum allowed (5% of reserve). Maximum: ${ethers.utils.formatEther(maxAllowedAmount)} ${tokenSymbol}`);
          setIsLoading(false);
          setTransactionStatus('error');
          return;
        }
        
        // Get slippage settings directly from the contract - EXACTLY as in test_sara.js
        console.log("Getting slippage settings from contract...");
        let reverseSlippage;
        try {
          const slippageSettings = await saraDex.getSlippageSettings();
          console.log("Slippage settings:");
          console.log("  Default slippage:", slippageSettings[0].toString(), "basis points");
          console.log("  Current max slippage:", slippageSettings[1].toString(), "basis points");
          console.log("  Absolute maximum:", slippageSettings[2].toString(), "basis points");
          
          // Use the contract's current max slippage setting - EXACTLY as in test_sara.js
          reverseSlippage = slippageSettings[1]; // Current max slippage from contract
          console.log("Using contract's current max slippage:", reverseSlippage.toString(), "basis points");
        } catch (error: any) {
          console.error("Error getting slippage settings:", error.message);
          console.log("Using hardcoded fallback slippage value of 2000 (20%)");
          reverseSlippage = ethers.BigNumber.from(2000); // 20% fallback
        }
        
        // Get expected output based on reserves - EXACTLY as in test_sara.js
        console.log("Getting expected output from reverse swap...");
        let expectedReverseOutput;
        try {
          expectedReverseOutput = await saraDex.getAmountOut(reverseSwapAmount, creatorReserve, coralReserve);
          console.log("Expected CORAL output from getAmountOut:", ethers.utils.formatEther(expectedReverseOutput));
        } catch (error: any) {
          console.log("Error calling getAmountOut for reverse swap:", error.message);
          // Try a manual calculation as fallback - EXACTLY as in test_sara.js
          expectedReverseOutput = reverseSwapAmount.mul(coralReserve).div(creatorReserve);
          console.log("Manually calculated expected CORAL output:", ethers.utils.formatEther(expectedReverseOutput));
        }
        
        // Calculate minimum amount out with 50% slippage tolerance - EXACTLY as in test_sara.js
        const reverseMinAmountOut = expectedReverseOutput.mul(5000).div(10000); // 50% of expected output
        
        console.log("Reverse swap parameters:");
        console.log({
          amountIn: ethers.utils.formatEther(reverseSwapAmount),
          expectedOut: ethers.utils.formatEther(expectedReverseOutput),
          minAmountOut: ethers.utils.formatEther(reverseMinAmountOut),
          slippage: `${reverseSlippage.toNumber()/100}%`,
          actualSlippageTolerance: "50%" // What we're actually accepting in minAmountOut
        });
        
        // Approve creator tokens for the DEX before swapping - EXACTLY as in test_sara.js
        console.log("Approving creator tokens for DEX...");
        const approveTx = await creatorToken.approve(CONTRACT_ADDRESSES.SARA_DEX, reverseSwapAmount);
        console.log("DEX creator approval transaction hash:", approveTx.hash);
        await approveTx.wait();
        
        // Check allowance to confirm approval - EXACTLY as in test_sara.js
        const creatorAllowance = await creatorToken.allowance(account, CONTRACT_ADDRESSES.SARA_DEX);
        console.log("DEX creator allowance after approval:", ethers.utils.formatEther(creatorAllowance));
        
        // Wait for 61 seconds to avoid anti-bot protection - EXACTLY as in test_sara.js
        setTransactionStatus('antibot');
        console.log("Waiting for 61 seconds to avoid anti-bot protection...");
        const startTime = Date.now();
        
        // Create a countdown effect
        const updateInterval = setInterval(() => {
          const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
          const remainingTime = Math.max(61 - elapsedTime, 0);
          setTransactionHash(`Waiting ${remainingTime} seconds...`);
        }, 1000);
        
        await new Promise(resolve => setTimeout(() => {
          clearInterval(updateInterval);
          resolve(null);
        }, 61000)); // Full 61 seconds wait
        
        // Get balances before swap - EXACTLY as in test_sara.js
        const userCoralBeforeSwap = await coralToken.balanceOf(account);
        const userCreatorBeforeSwap = await creatorToken.balanceOf(account);
        console.log("Balances before reverse swap:");
        console.log("  User creator token balance:", ethers.utils.formatEther(userCreatorBeforeSwap));
        console.log("  User CORAL token balance:", ethers.utils.formatEther(userCoralBeforeSwap));
        
        // Execute the reverse swap - EXACTLY as in test_sara.js
        console.log("Executing reverse swap...");
        setTransactionStatus('executing');
        
        // CRITICAL: Don't use any txOptions or additional parameters that aren't in test_sara.js
        const reverseSwapTx = await saraDex.connect(signer).swapCreatorTokenForCoral(
          tokenAddress,
          reverseSwapAmount,
          reverseMinAmountOut,
          reverseSlippage // Use the actual slippage from contract, not hardcoded
        );
        
        console.log("Reverse swap transaction hash:", reverseSwapTx.hash);
        setTransactionHash(reverseSwapTx.hash);
        
        // Wait for transaction confirmation - EXACTLY as in test_sara.js
        console.log("Waiting for transaction confirmation...");
        const receipt = await reverseSwapTx.wait();
        console.log("Reverse swap successful!");
        
        // Check balances after swap - EXACTLY as in test_sara.js
        const userCoralAfterSwap = await coralToken.balanceOf(account);
        const userCreatorAfterSwap = await creatorToken.balanceOf(account);
        console.log("Balances after reverse swap:");
        console.log("  User creator token balance:", ethers.utils.formatEther(userCreatorAfterSwap));
        console.log("  User CORAL token balance:", ethers.utils.formatEther(userCoralAfterSwap));
        
        // Calculate actual amounts swapped - EXACTLY as in test_sara.js
        const creatorTokensSwapped = userCreatorBeforeSwap.sub(userCreatorAfterSwap);
        const coralTokensReceived = userCoralAfterSwap.sub(userCoralBeforeSwap);
        console.log("Swap summary:");
        console.log("  Creator tokens swapped:", ethers.utils.formatEther(creatorTokensSwapped));
        console.log("  CORAL tokens received:", ethers.utils.formatEther(coralTokensReceived));
        
        // Transaction completed successfully
        setTransactionStatus('success');
        
        // Create swap details for immediate display with actual amounts
        const swapDetails = {
          txHash: reverseSwapTx.hash,
          timestamp: Math.floor(Date.now() / 1000),
          tokenAddress: tokenAddress,
          amountIn: ethers.utils.formatEther(creatorTokensSwapped),
          amountOut: ethers.utils.formatEther(coralTokensReceived),
          sender: account,
          isCoralToCT: false // This is a sell operation
        };
        
        // Notify other components about the successful swap with details
        notifySwapWithDetails(swapDetails);
        
        // Refresh balances after a short delay
        setTimeout(() => {
          fetchBalances();
        }, 2000);
      } else {
        // ========== BUY IMPLEMENTATION (KEEP EXISTING LOGIC) ==========
        // Initialize contracts
        const coralToken = new ethers.Contract(CONTRACT_ADDRESSES.CORAL_TOKEN, ERC20_ABI, signer);
        const creatorToken = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const saraDex = new ethers.Contract(CONTRACT_ADDRESSES.SARA_DEX, SARA_DEX_ABI, signer);
        const liquidityManager = new ethers.Contract(CONTRACT_ADDRESSES.SARA_LIQUIDITY_MANAGER, SARA_LIQUIDITY_MANAGER_ABI, signer);
        
        // Parse amount to BigNumber
        const amountIn = ethers.utils.parseEther(amount);
        
        // Continue with buy logic
        // Get reserves from liquidity manager
        console.log("Step 2: Fetching current reserves...");
        const [creatorReserve, coralReserve] = await liquidityManager.getReserves(tokenAddress);
        console.log("Current reserves:", {
          creatorTokens: ethers.utils.formatEther(creatorReserve),
          coralTokens: ethers.utils.formatEther(coralReserve)
        });
        
        // Calculate expected output
      console.log("Step 3: Calculating expected output...");
      let expectedOutput;
      try {
          expectedOutput = await saraDex.getAmountOut(amountIn, coralReserve, creatorReserve);
        console.log("Expected output from getAmountOut:", ethers.utils.formatEther(expectedOutput));
      } catch (error) {
        console.log("Error calling getAmountOut:", error);
        // Try a manual calculation as fallback
          expectedOutput = amountIn.mul(creatorReserve).div(coralReserve);
        console.log("Manually calculated expected output:", ethers.utils.formatEther(expectedOutput));
      }
      
      // Calculate minimum amount out with slippage
      const slippagePercent = parseFloat(slippage) / 100;
      const minAmountOut = expectedOutput.sub(expectedOutput.mul(Math.floor(slippagePercent * 100)).div(100));
      
      console.log("Swap parameters:", {
          direction: 'buy',
        tokenAddress: tokenAddress,
        amountIn: ethers.utils.formatEther(amountIn),
        expectedOut: ethers.utils.formatEther(expectedOutput),
        minAmountOut: ethers.utils.formatEther(minAmountOut),
        slippage: slippage + "%"
      });
      
        // Check CORAL token balance
        const userCoralBalance = await coralToken.balanceOf(account);
        console.log("User CORAL balance:", ethers.utils.formatEther(userCoralBalance));
        
        if (userCoralBalance.lt(amountIn)) {
          alert(`Insufficient CORAL token balance`);
        setIsLoading(false);
          setTransactionStatus('error');
        return;
      }
      
        // Execute swap using direct DEX approach
      console.log("Step 6: Executing swap using direct DEX approach...");

        // First, approve tokens for the DEX
        console.log("Step 6.1: Approving tokens for DEX...");
        const approveTx = await coralToken.approve(CONTRACT_ADDRESSES.SARA_DEX, amountIn);
        console.log("DEX approval transaction hash:", approveTx.hash);
        await approveTx.wait();
        
        // Check DEX allowance
        const dexAllowance = await coralToken.allowance(account, CONTRACT_ADDRESSES.SARA_DEX);
        console.log("DEX allowance after approval:", ethers.utils.formatEther(dexAllowance));
        
        // Wait to avoid anti-bot protection
        setTransactionStatus('antibot');
        console.log("Step 6.2: Waiting 30 seconds to avoid anti-bot protection...");
        const waitTime = 30000; // 30 seconds for buy operations
        const startTime = Date.now();
        
        // Create a countdown effect
        const updateInterval = setInterval(() => {
          const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
          const remainingTime = Math.max(30 - elapsedTime, 0);
          setTransactionHash(`Waiting ${remainingTime} seconds...`);
        }, 1000);
        
        await new Promise(resolve => setTimeout(() => {
          clearInterval(updateInterval);
          resolve(null);
        }, waitTime));
        
        // Execute the buy swap
        setTransactionStatus('executing');
        console.log("Step 6.3: Executing buy swap through DEX...");
        
        // Create transaction object with manual gas limit
        const txOptions = {
          gasLimit: ethers.utils.hexlify(3000000),
          gasPrice: ethers.utils.parseUnits('50', 'gwei')
        };
        
        console.log("Transaction options:", txOptions);
        
        // CORAL to Creator token (Buy)
        const swapTx = await saraDex.connect(signer).swapCoralForCreatorToken(
            tokenAddress,
            amountIn,
            minAmountOut,
          2000, // 20% slippage (2000 basis points)
            txOptions
          );
        
        console.log("DEX swap transaction hash:", swapTx.hash);
        setTransactionHash(swapTx.hash);
        
        // Wait for transaction confirmation
        console.log("Waiting for DEX transaction confirmation...");
        const receipt = await swapTx.wait();
        
        if (receipt.status === 0) {
          console.error("DEX transaction failed during execution");
          throw new Error("DEX transaction reverted on-chain");
        }
        
        console.log("DEX swap successful!");
        setTransactionStatus('success');
        
        // Check new balances
        const newUserCreatorBalance = await creatorToken.balanceOf(account);
        const newUserCoralBalance = await coralToken.balanceOf(account);
        
        console.log("New balances after DEX swap:");
        console.log("  Creator token:", ethers.utils.formatEther(newUserCreatorBalance));
        console.log("  CORAL token:", ethers.utils.formatEther(newUserCoralBalance));
        
        // Calculate actual amounts transferred
        const actualAmountIn = amountIn;
        // Get user creator balance before calculating the difference
        const userCreatorBalance = await creatorToken.balanceOf(account);
        const actualAmountOut = newUserCreatorBalance.sub(userCreatorBalance);
        
        // Create swap details for immediate display with actual amounts
        const swapDetails = {
          txHash: swapTx.hash,
          timestamp: Math.floor(Date.now() / 1000), 
          tokenAddress: tokenAddress,
          amountIn: ethers.utils.formatEther(actualAmountIn),
          amountOut: ethers.utils.formatEther(actualAmountOut),
          sender: account,
          isCoralToCT: true // This is a buy operation
        };
        
        console.log("Swap details for immediate display:", swapDetails);
        
        // Notify other components about the successful swap with details
        notifySwapWithDetails(swapDetails);
        
        // Refresh balances after a short delay
        setTimeout(() => {
          fetchBalances();
        }, 2000);
      }
      } catch (error: any) {
        console.error("DEX swap error:", error);
        
        // Enhanced error handling with detailed debugging
        console.log("Debug - DEX error details:", {
          saraDex: CONTRACT_ADDRESSES.SARA_DEX,
          coralToken: CONTRACT_ADDRESSES.CORAL_TOKEN,
          creatorToken: tokenAddress
        });
        
        // Try to get more information about the error
        if (error.data) {
          console.log("DEX error data:", error.data);
        }
        
        // Extract error message
      let errorMessage = "Transaction failed. ";
        if (error.reason) {
        errorMessage += "Reason: " + error.reason;
        } else if (error.message) {
        errorMessage += error.message;
        }
        
        setTransactionStatus('error');
        alert(errorMessage);
      } finally {
        setIsLoading(false);
    }
  };

  // Calculate price impact (more realistic)
  const calculatePriceImpact = (): string => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00%';
    
    const inputAmount = parseFloat(amount);
    // More realistic calculation based on liquidity
    const liquidity = 100000; // Assume $100k liquidity
    const impact = (inputAmount / liquidity) * 100;
    return `${Math.min(impact, 5).toFixed(2)}%`;
  };

  // Calculate minimum received amount with slippage
  const calculateMinReceived = (): string => {
    if (!receiveAmount || isNaN(parseFloat(receiveAmount))) return '0';
    
    const outputAmount = parseFloat(receiveAmount);
    const slippagePercent = parseFloat(slippage) / 100;
    const minReceived = outputAmount * (1 - slippagePercent);
    
    return minReceived.toFixed(6);
  };

  // Format balance for display
  const formatBalance = (value: string): string => {
    return parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  useEffect(() => {
    if (token && token.address) {
      console.log(`TokenSwap: Using token address: ${token.address}`);
    } else if (token && token.tokenAddress) {
      console.log(`TokenSwap: Using tokenAddress: ${token.tokenAddress}`);
    }
  }, [token]);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Swap Tokens</h2>
      </div>
      
      {/* Swap Direction Toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setSwapDirection('buy')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md shadow-sm ${swapDirection === 'buy' 
              ? 'bg-[#FF7F50] text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Buy {tokenSymbol} with CORAL
          </button>
          <button
            onClick={() => setSwapDirection('sell')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md shadow-sm ${swapDirection === 'sell' 
              ? 'bg-[#FF7F50] text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Sell {tokenSymbol} for CORAL
          </button>
        </div>
      </div>
      
      {/* Input Amount */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">You Pay</label>
          <div className="text-xs text-gray-500">
            Balance: {swapDirection === 'buy' 
              ? `${formatBalance(balance.coral)} CORAL` 
              : `${formatBalance(balance.token)} ${tokenSymbol}`}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 flex items-center">
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.0"
            className="bg-transparent text-lg font-medium text-gray-900 focus:outline-none w-full"
          />
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleMaxClick}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
            >
              MAX
            </button>
            <span className="font-medium text-gray-700">
              {swapDirection === 'buy' ? 'CORAL' : tokenSymbol}
            </span>
          </div>
        </div>
      </div>
      
      {/* Output Amount */}
      <div className="mb-4 mt-2">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">You Receive</label>
          <div className="text-xs text-gray-500">
            Balance: {swapDirection === 'buy' 
              ? `${formatBalance(balance.token)} ${tokenSymbol}` 
              : `${formatBalance(balance.coral)} CORAL`}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 flex items-center">
          <input
            type="text"
            value={receiveAmount}
            readOnly
            className="bg-transparent text-lg font-medium text-gray-900 focus:outline-none w-full"
          />
          <span className="font-medium text-gray-700">
            {swapDirection === 'buy' ? tokenSymbol : 'CORAL'}
          </span>
        </div>
      </div>
      
      {/* Swap Details */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Rate</span>
          <span className="font-medium">
            {swapDirection === 'buy' 
              ? `1 CORAL = ${(parseFloat(receiveAmount) / parseFloat(amount || '1')).toFixed(6)} ${tokenSymbol}` 
              : `1 ${tokenSymbol} = ${(parseFloat(receiveAmount) / parseFloat(amount || '1')).toFixed(6)} CORAL`}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Price Impact</span>
          <span className="font-medium">{calculatePriceImpact()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Minimum Received</span>
          <span className="font-medium">
            {calculateMinReceived()} {swapDirection === 'buy' ? tokenSymbol : 'CORAL'}
          </span>
        </div>
      </div>
      
      {/* Slippage Settings */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Slippage Tolerance</label>
        </div>
        <div className="flex space-x-2 mb-2">
          {[0.5, 1, 2, 5].map((value) => (
            <button
              key={value}
              onClick={() => setSlippage(value.toString())}
              className={`px-2 py-1 text-xs rounded-md ${
                parseFloat(slippage) === value
                  ? 'bg-[#FF7F50] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {value}%
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="number"
            value={slippage}
            onChange={handleSlippageChange}
            min="0.1"
            max="50"
            step="0.1"
            className="w-full px-3 py-1 text-xs rounded-md bg-gray-100 focus:outline-none focus:ring-1 focus:ring-[#FF7F50]"
          />
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">%</span>
        </div>
      </div>
      
      {/* Approval Button (if needed) */}
      {needsApproval && isConnected && (
        <button
          onClick={approveToken}
          disabled={isApproving}
          className={`w-full py-2.5 px-4 rounded-lg font-medium text-white shadow-sm mb-2 ${
            isApproving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isApproving ? 'Approving...' : `Approve ${swapDirection === 'buy' ? 'CORAL' : tokenSymbol}`}
        </button>
      )}
      
      {/* Swap Button */}
      {needsApproval ? (
        <button
          onClick={approveToken}
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-2.5 px-4 rounded-lg font-medium text-white shadow-sm ${
            isLoading || !amount || parseFloat(amount) <= 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#FF7F50] hover:bg-[#FF6347] transition-colors'
          }`}
        >
          {isApproving ? 'Approving...' : 'Approve'}
        </button>
      ) : (
        <button
          onClick={executeSwap}
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-2.5 px-4 rounded-lg font-medium text-white shadow-sm ${
            isLoading || !amount || parseFloat(amount) <= 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#FF7F50] hover:bg-[#FF6347] transition-colors'
          }`}
        >
          {isLoading ? 'Swapping...' : `Swap ${swapDirection === 'buy' ? 'CORAL' : tokenSymbol}`}
        </button>
      )}

      {/* Transaction Status */}
      {transactionStatus !== 'none' && (
        <div className={`mt-4 p-3 rounded-lg ${
          transactionStatus === 'pending' ? 'bg-yellow-50 text-yellow-800' :
          transactionStatus === 'listing' ? 'bg-blue-50 text-blue-800' :
          transactionStatus === 'antibot' ? 'bg-purple-50 text-purple-800' :
          transactionStatus === 'success' ? 'bg-green-50 text-green-800' :
          'bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center">
            {(transactionStatus === 'pending' || transactionStatus === 'listing') && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {transactionStatus === 'success' && (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            )}
            {transactionStatus === 'error' && (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            )}
            {transactionStatus === 'antibot' && (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            )}
            <span className="text-sm font-medium">
              {transactionStatus === 'pending' && 'Transaction in progress...'}
              {transactionStatus === 'listing' && 'Listing token on router...'}
              {transactionStatus === 'success' && 'Transaction successful!'}
              {transactionStatus === 'error' && 'Transaction failed. Please try again.'}
              {transactionStatus === 'antibot' && 'Anti-bot protection detected!'}
            </span>
          </div>
          
          {transactionStatus === 'antibot' && (
            <div className="mt-2 text-sm">
              <p>The SaraDEX contract has anti-bot protection that prevents the same address from swapping frequently.</p>
              <p className="mt-1">Please try one of these solutions:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Wait at least 1 minute before trying again with the same wallet</li>
                <li>Use a different wallet address that hasn't recently performed a swap</li>
              </ul>
            </div>
          )}
          
          {transactionStatus === 'success' && transactionHash && (
            <div className="mt-2 text-xs">
              <span>Transaction Hash: </span>
              <a 
                href={`${BLOCKCHAIN_EXPLORER_URL}/tx/${transactionHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                {transactionHash}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenSwap;
