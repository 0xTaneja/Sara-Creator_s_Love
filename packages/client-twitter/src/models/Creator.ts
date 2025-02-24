import mongoose from 'mongoose';

const creatorSchema = new mongoose.Schema({
    channelId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    metrics: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        subscribers: { type: Number, default: 0 },
        lastVideoId: { type: String, default: '' },
        lastVideoTimestamp: { type: Number, default: 0 }
    },
    isTracking: { 
        type: Boolean, 
        default: true 
    },
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

export const Creator = mongoose.model('Creator', creatorSchema); 