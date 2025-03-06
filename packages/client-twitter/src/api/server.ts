import express, { Application } from 'express';
import cors from 'cors';
import tokenRoutes from './tokenRoutes';
import { connectDB } from '../db/connection';

// Initialize express app
const app: Application = express();
const PORT = process.env.API_PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tokens', tokenRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Sara API Server running on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}/api/tokens`);
});

export default app; 