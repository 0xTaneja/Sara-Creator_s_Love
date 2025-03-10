import mongoose from 'mongoose';

// Define metrics schema separately for better organization
const metricsSchema = new mongoose.Schema({
    views: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    likes: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    subscribers: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    lastVideoId: { 
        type: String, 
        default: '' 
    },
    lastVideoTimestamp: { 
        type: Number, 
        default: 0 
    },
    lastUpdated24h: {
        type: Number,
        default: Date.now
    }
});

const creatorSchema = new mongoose.Schema({
    channelId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true // Add index for faster queries
    },
    name: { 
        type: String, 
        required: true 
    },
    description: {
        type: String,
        default: ''
    },
    imageUrl: {
        type: String,
        default: ''
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
    metrics: {
        type: metricsSchema,
        default: () => ({})
    },
    isTracking: { 
        type: Boolean, 
        default: true 
    },
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    },
    // New fields for tiered monitoring
    lastTrendingDate: {
        type: Date,
        default: Date.now
    },
    monitoringTier: {
        type: Number,
        default: 1,
        min: 1,
        max: 3
    },
    metricsHistory: {
        type: [metricsSchema],
        default: []
    },
    hasToken: {
        type: Boolean,
        default: false
    },
    tokenAddress: {
        type: String,
        default: ''
    },
    tokenSymbol: {
        type: String,
        default: ''
    },
    tokenPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    tokenPriceChange24h: {
        type: Number,
        default: 0
    },
    region: {
        type: String,
        default: 'US'
    },
    category: {
        type: String,
        default: ''
    },
    engagementScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    // Add options for better performance
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add a method to update metrics
creatorSchema.methods.updateMetrics = async function(newMetrics) {
    // Store current metrics in history before updating
    if (this.metrics && Object.keys(this.metrics).length > 0) {
        if (!this.metricsHistory) this.metricsHistory = [];
        this.metricsHistory.push(this.metrics);
        
        // Keep only the last 5 metrics entries
        if (this.metricsHistory.length > 5) {
            this.metricsHistory = this.metricsHistory.slice(-5);
        }
    }
    
    this.metrics = { ...this.metrics, ...newMetrics };
    this.lastUpdated = new Date();
    return this.save();
};

// Add a static method to find or create
creatorSchema.statics.findOrCreate = async function(channelData) {
    let creator = await this.findOne({ channelId: channelData.channelId });
    
    if (!creator) {
        creator = new this(channelData);
        await creator.save();
    }
    
    return creator;
};

// Ensure the model is only compiled once
export const Creator = mongoose.models.Creator || mongoose.model('Creator', creatorSchema); 