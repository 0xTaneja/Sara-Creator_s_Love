import mongoose from 'mongoose';
import { elizaLogger } from "@elizaos/core";

export async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://Rushab:Rushab%407499@cluster0.efpua.mongodb.net/youtube_monitor';
        
        // Set mongoose options for better stability
        mongoose.set('strictQuery', false);
        
        // Add connection event listeners
        mongoose.connection.on('connected', () => {
            elizaLogger.log('MongoDB connection established successfully');
        });
        
        mongoose.connection.on('error', (err) => {
            elizaLogger.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            elizaLogger.log('MongoDB connection disconnected');
        });
        
        // Handle process termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            elizaLogger.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });
        
        // Connect with improved options
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000, // Increased timeout
            socketTimeoutMS: 60000, // Increased timeout
            // Atlas specific options
            retryWrites: true,
            w: 'majority',
            maxPoolSize: 10, // Connection pooling
            connectTimeoutMS: 30000 // Increased connection timeout
        });
        
        // Test the connection by running a simple query
        const collections = await mongoose.connection.db.listCollections().toArray();
        elizaLogger.log(`Connected to MongoDB Atlas. Available collections: ${collections.map(c => c.name).join(', ')}`);
        
        return mongoose.connection;
    } catch (error) {
        elizaLogger.error('MongoDB connection error:', error);
        // Retry connection after delay instead of throwing
        elizaLogger.log('Retrying MongoDB connection in 5 seconds...');
        setTimeout(() => connectDB(), 5000);
    }
} 