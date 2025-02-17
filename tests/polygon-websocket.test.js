import { client } from '../data-ingestion/polygon-websocket.js';
import Redis from 'ioredis';
import { jest } from '@jest/globals';

console.log('[DEBUG] Test file loading started'); // 1. First debug point

// WebSocket mock setup
const mockWS = {
  onopen: jest.fn(),
  onclose: jest.fn(),
  onerror: jest.fn(),
  onmessage: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1
};

console.log('[DEBUG] WebSocket mock created'); // 2. After mock setup

jest.mock('websocket', () => {
  console.log('[DEBUG] Websocket module being mocked'); // 3. During mock initialization
  return {
    w3cwebsocket: jest.fn(() => {
      setImmediate(() => mockWS.onopen());
      return mockWS;
    })
  };
});

console.log('[DEBUG] About to start describe block'); // 4. Before test suite

describe('Polygon WebSocket Integration', () => {
  console.log('[DEBUG] Inside describe block'); // 5. When suite initializes

  let redis;
  const testSymbol = 'AAPL';

  beforeAll(async () => {
    console.log('[DEBUG] Starting beforeAll'); // 6. First line of beforeAll
    if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL environment variable is not set');
      }
  
      redis = new Redis(process.env.REDIS_URL, {
        // Force quicker failure in CI environments
        reconnectOnError: () => false,
        maxRetriesPerRequest: 1
      });
  
      // Connection handling with timeout
      await Promise.race([
        new Promise((resolve, reject) => {
          redis.once('ready', resolve);
          redis.once('error', reject);
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);
  }, 15000);
  beforeEach(async () => {
    await redis.flushall();
    jest.clearAllMocks();
    
    // Reset WebSocket state
    if (client.getSocket()) {
      client.getSocket().onopen();
    }
  }, 5000);

  afterAll(async () => {
    await redis.quit();
    client.getSocket()?.close();
  }, 5000);

  test('processes trade messages', async () => {
    const mockTrade = JSON.stringify({
      ev: 'T',
      sym: testSymbol,
      t: Date.now(),
      p: 150.25,
      s: 100,
      c: ['@'],
      vw: 150.1
    });

    // Trigger message
    client.getSocket().onmessage({ data: mockTrade });

    // Verify with retry logic
    const key = `ticks:${testSymbol}:${new Date().toISOString().slice(0,10).replace(/-/g, '')}`;
    await expect(() => 
      redis.zrange(key, '-inf', '+inf')
    ).toEventually(
      expect.arrayContaining([
        expect.stringContaining('"price":150.25')
      ]),
      { timeout: 3000, interval: 100 }
    );
  }, 10000);
});
