# Sara AI Agent

Sara is an AI-powered social market maker that analyzes creator engagement metrics, market trends, and social sentiment to provide real-time insights and predictions for Creator Coins.

![Sara AI Agent](https://imgur.com/placeholder-image.jpg)

## 🚀 About Sara AI Agent

Sara AI Agent is a revolutionary platform for the creator economy that combines:

- **AI-Powered Creator Token Market** – Tokens minted based on engagement metrics
- **DEX Trading Platform** – Buy/sell creator tokens with a fully functional decentralized exchange
- **Real-Time Market Insights** – AI-generated predictions and market analysis
- **Dynamic Trending Leaderboard** – Discover top creator tokens

## 🌐 Connect With Sara

- **Twitter**: [https://x.com/Sara_AiAgent](https://x.com/Sara_AiAgent)
- **Discord**: Coming soon!

## Features

- Trade creator tokens with CORAL tokens
- View detailed information about creator tokens
- Connect your wallet to execute trades
- Real-time price updates and market data
- Responsive design for desktop and mobile
- AI-powered insights and predictions

## Technology Stack

- React with TypeScript
- Tailwind CSS for styling
- Ethers.js for blockchain interactions
- React Router for navigation
- AI-driven market analysis
- MongoDB for storing swap events and market data

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd sara-client
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up MongoDB:
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database named "sara"
   - Set the MongoDB URI in your environment variables (optional):
     ```
     export MONGODB_URI=mongodb://localhost:27017/sara
     ```

4. Start the development server
```bash
npm run dev
```

This command will start:
- The Vite frontend development server
- The Express API server for storing and retrieving swap events

5. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
src/
├── components/       # Reusable UI components
├── contexts/         # React contexts (Web3Context, etc.)
├── pages/            # Page components
├── utils/            # Utility functions
├── App.tsx           # Main application component
└── index.tsx         # Entry point
```

## Smart Contract Integration

The application interacts with the SaraDEX smart contract deployed on the Sonic Testnet. The contract address and ABI are configured in the Web3Context.

## Roadmap

Visit our [Roadmap](/roadmap) to see our future development plans and upcoming features.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Sara AI for powering the DEX
- Sonic Testnet for blockchain infrastructure

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up MongoDB:
   - Install MongoDB locally or use MongoDB Atlas
   - Create a database named "sara"
   - Set the MongoDB URI in your environment variables (optional):
     ```
     export MONGODB_URI=mongodb://localhost:27017/sara
     ```

3. Run the development server:
```bash
npm run dev
```

This command will start:
- The Vite frontend development server
- The Express API server for storing and retrieving swap events

## Features

- Trade tokens using the SARA DEX
- View real-time price charts with multiple timeframes
- See complete trade history for tokens
- Buy and sell creator tokens with CORAL

## Price Charts and Trade History

The application now includes:
- Real-time price updates using lightweight-charts
- MongoDB integration for persistent storage of swap events
- RESTful API for retrieving historical price data
- Candlestick charts with multiple timeframe options

## API Endpoints

- `POST /api/swaps` - Save a swap event
- `GET /api/swaps?tokenAddress={address}` - Get swap events for a token
- `GET /api/swaps/latest-price?tokenAddress={address}` - Get latest price for a token
- `GET /api/swaps/candles?tokenAddress={address}&timeframe=1h` - Get candlestick data

## Additional Information

For more details about the SARA protocol, please refer to the contract documentation.

## Server API

The project includes a TypeScript-based Express server that provides API endpoints for swap events and price data. The server is built with the following architecture:

### API Endpoints

- `POST /api/swaps` - Save a new swap event
- `GET /api/swaps` - Get swap events for a token
- `GET /api/price/:tokenAddress` - Get latest price for a token
- `GET /api/candles/:tokenAddress` - Get candle data for charts

### Running the Server

Development mode:
```bash
npm run server
```

Production mode:
```bash
npm run server:prod
```

### Server Configuration

The server uses MongoDB to store swap events and provides real-time price data for tokens. You can configure the MongoDB connection by setting the `MONGODB_URI` environment variable or it will default to `mongodb://localhost:27017/sara_db`.

### Server Build Process

The server TypeScript files are compiled using a dedicated tsconfig:
```bash
npm run build:server
```

This creates JavaScript files in the `dist/api` directory that are used in production.