// scripts/start-websocket.js
import dotenv from 'dotenv';
import { client } from '../data-ingestion/polygon-websocket.js';

dotenv.config();

// Initialize and connect
client.connect();

// Handle shutdown signals
const shutdown = async () => {
  console.log('\n🚨 Shutting down gracefully...');
  await client.shutdown();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep process alive
const keepAlive = () => setTimeout(keepAlive, 1 << 30);
keepAlive();

console.log('🚀 Polygon WebSocket client started');
