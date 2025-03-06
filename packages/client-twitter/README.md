# Sara Client Twitter

This package contains the Twitter client for the Sara agent, which monitors YouTube creators, mints tokens, and posts tweets.

## Blockchain Integration

The Sara agent requires blockchain integration to mint creator tokens and manage liquidity. The following environment variables are required:

- `SONIC_RPC_URL`: The RPC URL for the blockchain network
- `SONIC_PRIVATE_KEY`: The private key for the wallet that will mint tokens
- `CONTRACT_ADDRESS`: The address of the CreatorToken contract
- `SARA_TOKEN_ROUTER_ADDRESS`: The address of the token router contract
- `SARA_LIQUIDITY_MANAGER_ADDRESS`: The address of the liquidity manager contract
- `CORAL_TOKEN_ADDRESS`: The address of the CORAL token contract

## Setup

1. Run the setup script to configure the environment variables:

```bash
./setup-env.sh
```

2. Start the Sara agent:

```bash
pnpm start --character="characters/sara.character.json"
```

3. Start the API server:

```bash
cd packages/client-twitter
pnpm run start-api
```

4. Start the frontend:

```bash
cd sara-client
npm start
```

## Troubleshooting

If you encounter blockchain initialization errors, check the following:

1. Make sure all required environment variables are set correctly
2. Verify that the RPC URL is accessible
3. Ensure the private key has sufficient funds for gas
4. Check that the contract addresses are correct

## Development

The main components of the Sara agent are:

- `YoutubeMonitor.ts`: Monitors YouTube creators, mints tokens, and posts tweets
- `TokenMetadata.ts`: Defines the schema for token metadata stored in MongoDB
- `api/server.ts`: API server for serving token data to the frontend
- `api/tokenRoutes.ts`: API routes for token data

## Testing

To test the blockchain integration without real tokens, you can use a local blockchain like Hardhat or Ganache. 