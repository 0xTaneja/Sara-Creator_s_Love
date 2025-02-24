import mongoose from 'mongoose';

const tokenMetadataSchema = new mongoose.Schema({
    creatorName: String,
    channelId: String,
    tokenAddress: String,
    subscribers: Number,
    views: Number,
    imageUrl: String,
    mintTimestamp: Date,
    channelUrl: String,
    videoCount: Number,
    lastUpdated: Date
});

export const TokenMetadata = mongoose.model('TokenMetadata', tokenMetadataSchema); 