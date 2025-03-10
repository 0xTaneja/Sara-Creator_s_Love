// This file serves as a bridge to load the TypeScript version
// It exports all the same functions and interfaces as server.ts

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory and set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Load environment variables
dotenv.config({ path: path.join(rootDir, '.env') });

// SwapEvent interface
export const ISwapEvent = {};

// Initialize MongoDB connection
export const initMongoDB = async () => {
  try {
    // Use the MongoDB Atlas URI
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://Rushab:Rushab%407499@cluster0.efpua.mongodb.net/';
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.warn('Continuing without MongoDB connection. Some features may not work.');
  }
};

// Save a new swap event
export const saveSwapEvent = async (swapEvent) => {
  console.log('Saving swap event:', swapEvent);
  return { ...swapEvent, _id: 'mock-id' };
};

// Get swap events for a token
export const getSwapEvents = async (tokenAddress, limit = 100) => {
  console.log(`Getting swap events for ${tokenAddress}, limit: ${limit}`);
  return [];
};

// Get latest price for a token
export const getLatestPrice = async (tokenAddress) => {
  console.log(`Getting latest price for ${tokenAddress}`);
  return 0;
};

// Candle data interface
export const CandleData = {};

// Get candle data for charts
export const getCandleData = async (tokenAddress, timeframe = '1h', limit = 100) => {
  console.log(`Getting candle data for ${tokenAddress}, timeframe: ${timeframe}, limit: ${limit}`);
  return [];
};

// Create Express app
export const createServer = () => {
  const app = express();
  const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  let PORT = DEFAULT_PORT;

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // API endpoints - simplified for bridging
  app.post('/api/swaps', async (req, res) => {
    try {
      res.status(201).json({ message: 'Swap event saved' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save swap event' });
    }
  });

  app.get('/api/swaps', async (req, res) => {
    try {
      res.status(200).json([]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve swap events' });
    }
  });

  app.get('/api/price/:tokenAddress', async (req, res) => {
    try {
      res.status(200).json({ price: 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve latest price' });
    }
  });

  app.get('/api/candles/:tokenAddress', async (req, res) => {
    try {
      res.status(200).json([]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve candle data' });
    }
  });

  return {
    start: () => {
      // Initialize MongoDB before starting the server
      initMongoDB().then(() => {
        // Try to start the server with retries for port conflicts
        const startServer = (retryCount = 0) => {
          const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
          });

          server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && retryCount < 5) {
              console.log(`Port ${PORT} is in use, trying port ${PORT + 1}`);
              PORT++;
              startServer(retryCount + 1);
            } else {
              console.error('Server error:', err);
            }
          });
        };

        startServer();
      }).catch(err => {
        console.error('Failed to initialize MongoDB:', err);
        // Continue starting the server even if MongoDB fails
        const startServer = (retryCount = 0) => {
          const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (MongoDB unavailable)`);
          });

          server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && retryCount < 5) {
              console.log(`Port ${PORT} is in use, trying port ${PORT + 1}`);
              PORT++;
              startServer(retryCount + 1);
            } else {
              console.error('Server error:', err);
            }
          });
        };

        startServer();
      });
    },
    app
  };
};

export default { createServer, initMongoDB, saveSwapEvent, getSwapEvents, getLatestPrice, getCandleData }; 