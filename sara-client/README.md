# Sara DEX Client

A decentralized exchange (DEX) for trading creator tokens, powered by AI.

## Features

- Trade creator tokens with CORAL tokens
- View detailed information about creator tokens
- Connect your wallet to execute trades
- Real-time price updates and market data
- Responsive design for desktop and mobile

## Technology Stack

- React with TypeScript
- Tailwind CSS for styling
- Ethers.js for blockchain interactions
- React Router for navigation

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

3. Start the development server
```bash
npm start
# or
yarn start
```

4. Open your browser and navigate to `http://localhost:3000`

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Sara AI for powering the DEX
- Sonic Testnet for blockchain infrastructure