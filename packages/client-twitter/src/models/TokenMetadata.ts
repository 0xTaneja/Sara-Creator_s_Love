import mongoose from 'mongoose';

// Define price history schema
const priceHistorySchema = new mongoose.Schema({
    price: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const tokenMetadataSchema = new mongoose.Schema({
    creatorName: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true,
        index: true // Add index for faster queries
    },
    tokenAddress: {
        type: String,
        required: true,
        unique: true,
        index: true // Add index for faster queries
    },
    subscribers: {
        type: Number,
        default: 0,
        min: 0
    },
    views: {
        type: Number,
        default: 0,
        min: 0
    },
    imageUrl: {
        type: String,
        default: ''
    },
    mintTimestamp: {
        type: Date,
        default: Date.now
    },
    channelUrl: {
        type: String,
        default: ''
    },
    videoCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    // Fields for tracking trading status
    isListedForTrading: { 
        type: Boolean, 
        default: false 
    },
    priceDiscoveryCompleted: { 
        type: Boolean, 
        default: false 
    },
    hasLiquidity: { 
        type: Boolean, 
        default: false 
    },
    currentPrice: { 
        type: Number, 
        default: 0,
        min: 0
    },
    priceHistory: [priceHistorySchema],
    tradingVolume24h: { 
        type: Number, 
        default: 0,
        min: 0
    },
    // New fields for liquidity and price discovery
    initialLiquidityAmount: {
        type: String,
        default: '0'
    },
    liquidityAddedAt: {
        type: Date
    },
    creatorTokenReserve: {
        type: String,
        default: '0'
    },
    coralTokenReserve: {
        type: String,
        default: '0'
    },
    lastSwapTimestamp: {
        type: Date
    },
    totalSwapVolume: {
        type: String,
        default: '0'
    }
}, {
    timestamps: true,
    // Add options for better performance
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add method to update price
tokenMetadataSchema.methods.updatePrice = async function(newPrice) {
    // Add to price history
    this.priceHistory.push({
        price: newPrice,
        timestamp: new Date()
    });
    
    // Limit history to last 100 entries
    if (this.priceHistory.length > 100) {
        this.priceHistory = this.priceHistory.slice(-100);
    }
    
    this.currentPrice = newPrice;
    this.lastUpdated = new Date();
    return this.save();
};

// Add static method to find or create
tokenMetadataSchema.statics.findOrCreate = async function(tokenData) {
    let token = await this.findOne({ tokenAddress: tokenData.tokenAddress });
    
    if (!token) {
        token = new this(tokenData);
        await token.save();
    }
    
    return token;
};

// Ensure the model is only compiled once
export const TokenMetadata = mongoose.models.TokenMetadata || mongoose.model('TokenMetadata', tokenMetadataSchema); 