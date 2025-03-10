import express, { Request, Response } from 'express';
import mongoose, { Document, Schema } from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import { API_URL } from '../config';

// SwapEvent interface
export interface ISwapEvent {
  txHash: string;
  timestamp: number;
  tokenAddress: string;
  coralAmount: string;
  tokenAmount: string;
  sender: string;
  isCoralToCT: boolean;
  price: number;
  block?: number;
  createdAt?: Date;
}

// Mongoose document interface
interface ISwapEventDocument extends ISwapEvent, Document {}

// Initialize MongoDB connection
export const initMongoDB = async (): Promise<void> => {
  try {
    // Use the MongoDB Atlas URI
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://Rushab:Rushab%407499@cluster0.efpua.mongodb.net/sara_dex';
    
    // Log connection attempt with masked password for security
    const maskedURI = mongoURI.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)(@.+)/, '$1********$3');
    console.log('Connecting to MongoDB Atlas with URI:', maskedURI);
    
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }
    
    // Configure Mongoose to use the new parser and to handle deprecation warnings
    const mongooseOptions = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      heartbeatFrequencyMS: 1000,    // Ping every 1 second instead of 10 seconds
    };
    
    // Connect with timeout handling
    await mongoose.connect(mongoURI, mongooseOptions);
    console.log('MongoDB connected successfully!');
    
    // Verify connection by attempting a simple query
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`Connected to MongoDB with ${collections.length} collections`);
      
      // List collection names for debugging
      const collectionNames = collections.map(c => c.name).join(', ');
      console.log(`Available collections: ${collectionNames}`);
    } else {
      console.log('Connected to MongoDB but db object is not available');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.warn('WARNING: Continuing without MongoDB connection. Swap history will not persist between sessions.');
  }
};

// IMPORTANT: Define a consistent collection name as a constant
const COLLECTION_NAME = 'swapevents';

// Create Mongoose schema and model
const SwapEventSchema = new Schema<ISwapEventDocument>({
  txHash: { type: String, required: true, unique: true },
  timestamp: { type: Number, required: true },
  tokenAddress: { 
    type: String, 
    required: true, 
    index: true
  },
  coralAmount: { type: String, required: true },
  tokenAmount: { type: String, required: true },
  sender: { 
    type: String, 
    required: true
  },
  isCoralToCT: { type: Boolean, required: true },
  price: { type: Number, required: true },
  block: { type: Number },
  createdAt: { type: Date, default: Date.now }
}, {
  // Explicitly set collection name to ensure consistency
  collection: COLLECTION_NAME,
  // Add timestamps for automatic createdAt and updatedAt fields
  timestamps: true,
  // Return virtuals when using toJSON or toObject
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add standard indexes for efficient queries
SwapEventSchema.index({ tokenAddress: 1 });
SwapEventSchema.index({ timestamp: -1 });
SwapEventSchema.index({ txHash: 1 }, { unique: true });

// Add a text index for better searching
SwapEventSchema.index({ tokenAddress: 'text', txHash: 'text' });

// Add pre-save hook to normalize addresses and validate data
SwapEventSchema.pre('save', function(next) {
  try {
    // Normalize addresses
    if (this.tokenAddress) {
      this.tokenAddress = this.tokenAddress.toLowerCase();
    }
    if (this.sender) {
      this.sender = this.sender.toLowerCase();
    }
    
    // Ensure timestamp is in milliseconds
    if (this.timestamp && this.timestamp < 2000000000) {
      this.timestamp = this.timestamp * 1000;
    }
    
    // Validate price
    if (typeof this.price !== 'number' || isNaN(this.price)) {
      this.price = 0; // Default price if invalid
    }
    
    next();
  } catch (error) {
    console.error('Error in SwapEvent pre-save hook:', error);
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

// Define model with proper collection name
let SwapEventModel: mongoose.Model<ISwapEventDocument>;

// Create the model only if it doesn't exist
if (mongoose.models.SwapEvent) {
  SwapEventModel = mongoose.models.SwapEvent;
  console.log(`Using existing SwapEvent model with collection "${COLLECTION_NAME}"`);
} else {
  SwapEventModel = mongoose.model<ISwapEventDocument>('SwapEvent', SwapEventSchema, COLLECTION_NAME);
  console.log(`Created new SwapEvent model with collection "${COLLECTION_NAME}"`);
}

// Save a new swap event
export const saveSwapEvent = async (swapEvent: ISwapEvent): Promise<ISwapEventDocument> => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      console.error('MongoDB not connected when trying to save swap event');
      throw new Error('MongoDB not connected');
    }
    
    // Validate required fields
    if (!swapEvent.txHash) {
      throw new Error('Missing txHash in swap event');
    }
    
    if (!swapEvent.tokenAddress) {
      throw new Error('Missing tokenAddress in swap event');
    }
    
    // Ensure all fields are properly formatted
    const normalizedEvent = {
      ...swapEvent,
      txHash: swapEvent.txHash,
      timestamp: typeof swapEvent.timestamp === 'number' ? 
        (swapEvent.timestamp < 2000000000 ? swapEvent.timestamp * 1000 : swapEvent.timestamp) : 
        Date.now(),
      tokenAddress: swapEvent.tokenAddress?.toLowerCase(),
      sender: swapEvent.sender?.toLowerCase(),
      // Ensure these are strings
      coralAmount: String(swapEvent.coralAmount),
      tokenAmount: String(swapEvent.tokenAmount),
      // Convert to number if it's not already
      price: typeof swapEvent.price === 'number' ? swapEvent.price : 
        parseFloat(String(swapEvent.price) || '0') || 0,
      // Add created timestamp
      createdAt: new Date()
    };
    
    // Log the normalized event
    console.log('Saving normalized swap event to MongoDB collection:', COLLECTION_NAME, normalizedEvent);
    
    // Direct collection access for consistency with retrieval code
    const collection = mongoose.connection.db.collection(COLLECTION_NAME);
    
    // Check if this transaction already exists
    try {
      const existingEvent = await collection.findOne({ txHash: normalizedEvent.txHash });
      if (existingEvent) {
        console.log(`Event already exists in ${COLLECTION_NAME}:`, existingEvent.txHash);
        return existingEvent as unknown as ISwapEventDocument;
      }
    } catch (findError) {
      console.error('Error checking for existing event:', findError);
      // Continue with the save attempt
    }
    
    // Save directly to the collection for maximum reliability
    try {
      const result = await collection.insertOne(normalizedEvent);
      
      if (result.acknowledged) {
        console.log(`Successfully saved event to ${COLLECTION_NAME}:`, normalizedEvent.txHash);
        // Immediately verify the save was successful
        const verifyEvent = await collection.findOne({ txHash: normalizedEvent.txHash });
        if (verifyEvent) {
          console.log(`Verified save to ${COLLECTION_NAME}:`, verifyEvent.txHash);
          // Convert to document format
          return verifyEvent as unknown as ISwapEventDocument;
        }
      }
      
      // If we get here, the save worked but verification failed
      console.log('Save successful but verification failed, returning the original event');
      return normalizedEvent as unknown as ISwapEventDocument;
    } catch (saveError: any) {
      // Handle duplicate key errors more gracefully
      if (saveError.code === 11000) {
        console.log('Duplicate key error, event likely already exists');
        const existingEvent = await collection.findOne({ txHash: normalizedEvent.txHash });
        if (existingEvent) {
          return existingEvent as unknown as ISwapEventDocument;
        }
      }
      
      // Re-throw other errors
      console.error('Error during save operation:', saveError);
      throw saveError;
    }
  } catch (error) {
    console.error('Error in saveSwapEvent function:', error);
    
    // Create a dummy document without saving it
    const errorEvent = {
      ...swapEvent,
      txHash: swapEvent.txHash || `error-${Date.now()}`,
      timestamp: Date.now(),
      tokenAddress: swapEvent.tokenAddress || 'unknown',
      coralAmount: swapEvent.coralAmount || '0',
      tokenAmount: swapEvent.tokenAmount || '0',
      sender: swapEvent.sender || 'unknown',
      isCoralToCT: !!swapEvent.isCoralToCT,
      price: swapEvent.price || 0,
      createdAt: new Date()
    };
    
    console.warn('Returning unsaved error event');
    return errorEvent as unknown as ISwapEventDocument;
  }
};

// Get swap events for a token
export const getSwapEvents = async (tokenAddress: string, limit: number = 100): Promise<ISwapEventDocument[]> => {
  try {
    // Normalize the token address
    const normalizedTokenAddress = tokenAddress ? tokenAddress.toLowerCase() : '';
    
    const events = await SwapEventModel.find({ tokenAddress: normalizedTokenAddress })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
    return events;
  } catch (error) {
    console.error('Error getting swap events from database:', error);
    throw error;
  }
};

// Get latest price for a token
export const getLatestPrice = async (tokenAddress: string): Promise<number> => {
  try {
    // Normalize the token address
    const normalizedTokenAddress = tokenAddress ? tokenAddress.toLowerCase() : '';
    
    const latestEvent = await SwapEventModel.findOne({ tokenAddress: normalizedTokenAddress })
      .sort({ timestamp: -1 })
      .exec();
    
    if (!latestEvent) {
      console.log('No price data found for token:', tokenAddress);
      return 0;
    }
    
    return latestEvent.price;
  } catch (error) {
    console.error('Error getting latest price from database:', error);
    throw error;
  }
};

// Candle data interface for charts
export interface CandleData {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Get candle data for charts
export const getCandleData = async (
  tokenAddress: string, 
  timeframe: string = '1h', 
  limit: number = 100
): Promise<CandleData[]> => {
  try {
    // Normalize the token address
    const normalizedTokenAddress = tokenAddress ? tokenAddress.toLowerCase() : '';
    
    const events = await SwapEventModel.find({ tokenAddress: normalizedTokenAddress })
      .sort({ timestamp: 1 })
      .exec();
    
    if (!events.length) {
      return [];
    }

    const candleData: CandleData[] = [];
    let timeframeMs: number;

    // Set timeframe in milliseconds
    switch (timeframe) {
      case '1m':
        timeframeMs = 60 * 1000;
        break;
      case '5m':
        timeframeMs = 5 * 60 * 1000;
        break;
      case '15m':
        timeframeMs = 15 * 60 * 1000;
        break;
      case '30m':
        timeframeMs = 30 * 60 * 1000;
        break;
      case '1h':
        timeframeMs = 60 * 60 * 1000;
        break;
      case '4h':
        timeframeMs = 4 * 60 * 60 * 1000;
        break;
      case '1d':
        timeframeMs = 24 * 60 * 60 * 1000;
        break;
      default:
        timeframeMs = 60 * 60 * 1000; // Default to 1h
    }

    // Group events by timeframe
    const groupedEvents: { [key: string]: ISwapEventDocument[] } = {};
    
    events.forEach(event => {
      const timeKey = Math.floor(event.timestamp / timeframeMs) * timeframeMs;
      if (!groupedEvents[timeKey]) {
        groupedEvents[timeKey] = [];
      }
      groupedEvents[timeKey].push(event);
    });

    // Calculate OHLC for each timeframe
    Object.keys(groupedEvents).forEach(timeKey => {
      const timeEvents = groupedEvents[timeKey];
      const prices = timeEvents.map(event => event.price);
      
      const open = timeEvents[0].price;
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const close = timeEvents[timeEvents.length - 1].price;
      
      candleData.push({
        time: new Date(parseInt(timeKey)),
        open,
        high,
        low,
        close
      });
    });

    // Sort by time and limit results
    return candleData.sort((a, b) => a.time.getTime() - b.time.getTime()).slice(-limit);
    
  } catch (error) {
    console.error('Error getting candle data from database:', error);
    throw error;
  }
};

// Create Express app
export const createServer = () => {
  const app = express();
  // Force use of port 3005
  const DEFAULT_PORT = 3005;
  let PORT = DEFAULT_PORT;

  // Create HTTP server
  const server = http.createServer(app);

  // Middleware
  app.use(cors());
  app.use(bodyParser.json());

  // Initialize MongoDB as soon as the server is created
  initMongoDB().catch(err => {
    console.error('Failed to initialize MongoDB:', err);
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    // Return MongoDB connection status
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({ 
      status: 'ok',
      mongodb: mongoStatus
    });
  });

  // API endpoints
  app.post('/api/swaps', async (req: Request, res: Response) => {
    try {
      const swapEvent = req.body as ISwapEvent;
      console.log('Received swap event:', swapEvent);
      
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        console.error('MongoDB not connected when trying to handle POST /api/swaps');
        return res.status(503).json({ error: 'MongoDB not connected' });
      }
      
      // Input validation
      if (!swapEvent.txHash) {
        console.error('Missing txHash in swap event');
        return res.status(400).json({ error: 'Missing txHash in swap event' });
      }
      
      if (!swapEvent.tokenAddress) {
        console.error('Missing tokenAddress in swap event');
        return res.status(400).json({ error: 'Missing tokenAddress in swap event' });
      }
      
      // Direct collection access for consistency
      const collection = mongoose.connection.db.collection(COLLECTION_NAME);
      
      // Check if this transaction already exists
      const existingEvent = await collection.findOne({ txHash: swapEvent.txHash });
      if (existingEvent) {
        console.log(`Event already exists in ${COLLECTION_NAME}:`, existingEvent.txHash);
        return res.status(200).json({ message: 'Swap event already exists', event: existingEvent });
      }
      
      // Normalize the event data
      const normalizedEvent = {
        ...swapEvent,
        txHash: swapEvent.txHash,
        tokenAddress: swapEvent.tokenAddress.toLowerCase(),
        timestamp: swapEvent.timestamp < 2000000000 ? swapEvent.timestamp * 1000 : swapEvent.timestamp,
        createdAt: new Date()
      };
      
      console.log(`Saving event to ${COLLECTION_NAME} collection:`, normalizedEvent);
      
      // Save directly to collection
      const result = await collection.insertOne(normalizedEvent);
      
      if (result.acknowledged) {
        console.log(`Successfully saved to ${COLLECTION_NAME}:`, normalizedEvent.txHash);
        
        // Also save using our utility function for consistency (this will be a no-op if already saved)
        try {
          await saveSwapEvent(swapEvent);
        } catch (saveError) {
          console.error('Error in secondary save via utility function (ignoring):', saveError);
        }
        
        return res.status(201).json({ 
          message: 'Swap event saved', 
          collection: COLLECTION_NAME 
        });
      }
      
      throw new Error('MongoDB insert was not acknowledged');
    } catch (error) {
      console.error('Error handling swap event post:', error);
      res.status(500).json({ error: 'Failed to save swap event', details: String(error) });
    }
  });

  app.get('/api/swaps', async (req: Request, res: Response) => {
    try {
      const { tokenAddress, limit } = req.query;
      console.log('GET /api/swaps - Fetching swap events for token:', tokenAddress, 'limit:', limit);
      
      // Check MongoDB connection first
      if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB not connected when trying to fetch swap events');
        return res.status(503).json({ 
          error: 'MongoDB not connected',
          readyState: mongoose.connection.readyState
        });
      }
      
      if (!tokenAddress) {
        console.error('Missing tokenAddress in query');
        return res.status(400).json({ error: 'Missing tokenAddress in query' });
      }
      
      // Normalize token address to lowercase
      const normalizedTokenAddress = (tokenAddress as string).toLowerCase();
      console.log('Normalized tokenAddress:', normalizedTokenAddress);
      
      try {
        // Check if the model and collection exist
        if (!mongoose.connection.db) {
          console.error('MongoDB db object is not available');
          return res.status(503).json({ error: 'MongoDB not fully connected' });
        }
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
        console.log(`Collection "${COLLECTION_NAME}" exists: ${collectionExists}`);
        
        // Verify the schema directly on the database
        if (collectionExists) {
          const sampleDoc = await mongoose.connection.db.collection(COLLECTION_NAME).findOne({});
          if (sampleDoc) {
            console.log(`Sample document from ${COLLECTION_NAME} collection:`, sampleDoc);
          } else {
            console.log(`No documents found in ${COLLECTION_NAME} collection`);
          }
        } else {
          // If collection doesn't exist yet, create it
          console.log(`Collection "${COLLECTION_NAME}" does not exist yet. It will be created when first document is saved.`);
        }
        
        // Find all documents in the collection first to see what's there
        const allDocuments = await mongoose.connection.db.collection(COLLECTION_NAME).find({}).limit(10).toArray();
        console.log(`DEBUG: Found ${allDocuments.length} total documents in ${COLLECTION_NAME} collection`);
        
        if (allDocuments.length > 0) {
          console.log('DEBUG: Sample document:', allDocuments[0]);
        }
        
        // Now do the actual filtered query 
        // Use direct collection access instead of the Mongoose model to bypass any potential model issues
        const events = await mongoose.connection.db.collection(COLLECTION_NAME)
          .find({ tokenAddress: normalizedTokenAddress })
          .sort({ timestamp: -1 })
          .limit(limit ? parseInt(limit as string) : 100)
          .toArray();
        
        console.log(`Found ${events.length} swap events for token ${normalizedTokenAddress} (direct query)`);
        
        // Send the events directly without mapping (lean already returns plain objects)
        res.status(200).json(events);
      } catch (dbError) {
        console.error('Database query error:', dbError);
        return res.status(500).json({ 
          error: 'Database query failed', 
          details: String(dbError) 
        });
      }
    } catch (error) {
      console.error('Error in /api/swaps endpoint:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve swap events', 
        details: String(error)
      });
    }
  });

  // Debug endpoint to check MongoDB collections and contents
  app.get('/api/debug/collections', async (req: Request, res: Response) => {
    try {
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return res.status(503).json({ 
          error: 'MongoDB not connected',
          readyState: mongoose.connection.readyState 
        });
      }
      
      // Get all collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Sample data from our target collection if it exists
      let sampleData: any[] = [];
      if (collectionNames.includes(COLLECTION_NAME)) {
        sampleData = await mongoose.connection.db.collection(COLLECTION_NAME)
          .find({})
          .limit(10)
          .toArray();
      }
      
      return res.status(200).json({
        collections: collectionNames,
        targetCollection: COLLECTION_NAME,
        targetExists: collectionNames.includes(COLLECTION_NAME),
        sampleCount: sampleData.length,
        sampleData: sampleData.length > 0 ? sampleData : null
      });
    } catch (error) {
      console.error('Error in debug endpoint:', error);
      return res.status(500).json({ error: String(error) });
    }
  });

  // Debug endpoint to explicitly fetch all swap events for a token
  app.get('/api/debug/swaps/:tokenAddress', async (req: Request, res: Response) => {
    try {
      const { tokenAddress } = req.params;
      
      if (!tokenAddress) {
        return res.status(400).json({ error: 'Missing tokenAddress parameter' });
      }
      
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return res.status(503).json({ 
          error: 'MongoDB not connected',
          readyState: mongoose.connection.readyState 
        });
      }
      
      const normalizedTokenAddress = tokenAddress.toLowerCase();
      
      // Try multiple query approaches
      const results = {
        exactMatch: await mongoose.connection.db.collection(COLLECTION_NAME)
          .find({ tokenAddress: normalizedTokenAddress })
          .toArray(),
        
        regexMatch: await mongoose.connection.db.collection(COLLECTION_NAME)
          .find({ tokenAddress: { $regex: new RegExp(normalizedTokenAddress, 'i') } })
          .toArray(),
        
        allDocuments: await mongoose.connection.db.collection(COLLECTION_NAME)
          .find({})
          .limit(20)
          .toArray()
      };
      
      return res.status(200).json({
        tokenAddress: normalizedTokenAddress,
        collection: COLLECTION_NAME,
        exactMatchCount: results.exactMatch.length,
        regexMatchCount: results.regexMatch.length,
        totalDocuments: results.allDocuments.length,
        exactMatches: results.exactMatch,
        regexMatches: results.regexMatch,
        sampleDocuments: results.allDocuments
      });
    } catch (error) {
      console.error('Error in debug swaps endpoint:', error);
      return res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/price/:tokenAddress', async (req: Request, res: Response) => {
    try {
      const { tokenAddress } = req.params;
      const price = await getLatestPrice(tokenAddress);
      res.status(200).json({ price });
    } catch (error) {
      console.error('Error retrieving latest price:', error);
      res.status(500).json({ error: 'Failed to retrieve latest price' });
    }
  });

  app.get('/api/candles/:tokenAddress', async (req: Request, res: Response) => {
    try {
      const { tokenAddress } = req.params;
      const { timeframe, limit } = req.query;
      const candles = await getCandleData(
        tokenAddress,
        timeframe as string,
        limit ? parseInt(limit as string) : 100
      );
      res.status(200).json(candles);
    } catch (error) {
      console.error('Error retrieving candle data:', error);
      res.status(500).json({ error: 'Failed to retrieve candle data' });
    }
  });

  // Start the server
  const start = () => {
    // Kill any process using port 3005
    try {
      console.log(`Ensuring port ${PORT} is available...`);
      // This is a hacky solution, but for development it's fine
      // In production, we would handle this more gracefully
      const http = require('http');
      const tempServer = http.createServer();
      tempServer.listen(PORT);
      tempServer.close(() => {
        console.log(`Port ${PORT} is now available`);
        // Initialize MongoDB connection when server starts
        initMongoDB().then(() => {
          server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API accessible at http://localhost:${PORT}/api`);
            console.log(`MongoDB status: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
          });
        }).catch(err => {
          console.error('Failed to initialize MongoDB:', err);
          // Start server anyway
          server.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (without MongoDB)`);
            console.log(`API accessible at http://localhost:${PORT}/api`);
          });
        });
      });
    } catch (error) {
      console.error(`Failed to secure port ${PORT}:`, error);
      console.log(`Attempting to start server on port ${PORT} anyway...`);
      // Initialize MongoDB connection when server starts
      initMongoDB().then(() => {
        server.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
          console.log(`API accessible at http://localhost:${PORT}/api`);
          console.log(`MongoDB status: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
        });
      }).catch(err => {
        console.error('Failed to initialize MongoDB:', err);
        // Start server anyway
        server.listen(PORT, () => {
          console.log(`Server running on port ${PORT} (without MongoDB)`);
          console.log(`API accessible at http://localhost:${PORT}/api`);
        });
      });
    }
  };
  
  return {
    app,
    server,
    start
  };
};

export const server = {
  createServer,
  initMongoDB,
  saveSwapEvent,
  getSwapEvents,
  getLatestPrice,
  getCandleData
};

export default server; 