/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades"); // Proxy Support
// require("@nomiclabs/hardhat-etherscan");   // Optional: Contract Verification
require("dotenv").config();                // Environment Management
require("hardhat-gas-reporter");           // Gas Reporting

const { DEPLOYER_PRIVATE_KEY, SONIC_RPC_URL,USER_PRIVATE_KEY} = process.env;

module.exports = {
  solidity:{ 
  version:"0.8.28",
  settings:{
    optimizer:{
      enabled:true,
      runs:200
    },
    viaIR:true
  }
  },
  networks: {
    sonic: {
      url: SONIC_RPC_URL || "https://rpc.blaze.soniclabs.com",
      accounts: [DEPLOYER_PRIVATE_KEY,
        USER_PRIVATE_KEY
      ],
      chainId: 57054,
    },
    // etherscan: {
    //   apiKey: SONIC_ETHERSCAN_API_KEY // Only useful if Sonic supports Etherscan-compatible verification
    // },
   
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 20
  },
  etherscan: {
    apiKey: {
      sonic: process.env.SONIC_ETHERSCAN_API_KEY
    },
    customChains: [
      {
        network: "sonic",
        chainId: 57054,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org"
        }
      }
    ]
  }
};
