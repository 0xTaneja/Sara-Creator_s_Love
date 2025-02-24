import mongoose from 'mongoose';
import { elizaLogger } from "@elizaos/core";

export async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://Rushab:Rushab%407499@cluster0.efpua.mongodb.net/youtube_monitor';
        
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            // Atlas specific options
            retryWrites: true,
            w: 'majority'
        });
        
        elizaLogger.log('Connected to MongoDB Atlas');
    } catch (error) {
        elizaLogger.error('MongoDB connection error:', error);
        throw error;
    }
} 