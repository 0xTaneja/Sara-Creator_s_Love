import { createServer } from './server.js';

// Start the server with error handling
try {
  console.log('Starting server in development mode...');
  createServer().start();
} catch (error) {
  console.error('Failed to start server:', error);
} 