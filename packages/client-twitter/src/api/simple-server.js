// Simple server implementation without MongoDB
import express from 'express';
import cors from 'cors';

console.log('Starting Simple Sara API Server...');

// Initialize express app
const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple routes for testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Sara API Server running on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}/api/test`);
}); 