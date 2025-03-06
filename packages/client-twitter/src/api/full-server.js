// Full API server implementation with MongoDB and token routes
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from '../db/connection';
import tokenRoutes from './tokenRoutes';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Starting Full Sara API Server...');

// Initialize express app
const app = express();
const PORT = process.env.API_PORT || 3001;

// Connect to MongoDB
try {
  console.log('Connecting to MongoDB...');
  connectDB()
    .then(() => {
      console.log('MongoDB connected successfully');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
    });
} catch (error) {
  console.error('Error during MongoDB connection setup:', error);
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', tokenRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ 
    status: 'ok',
    server: 'running',
    database: dbStatus
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Sara API Server running on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}/api/tokens`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
}); 