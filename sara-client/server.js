// This file is a compatibility layer for production use

// Import the compiled server module and start it
import { createServer } from './dist/api/server.js';

console.log('Starting server in production mode...');
console.log('MongoDB URI available:', !!process.env.MONGODB_URI);

createServer().start(); 