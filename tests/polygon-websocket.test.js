// tests/polygon-websocket.test.js
import { client } from '../data-ingestion/polygon-websocket.js';
import WS from 'jest-websocket-mock';
import Redis from 'ioredis';
import { jest } from '@jest/globals';

// Set test timeout to 15s
jest.setTimeout(15000);

describe('Polygon WebSocket Integration', () => {
  let redis;
  let server;
  const testSymbol = 'AAPL';
  const wsUrl = 'wss://socket.polygon.io/stocks';

  beforeAll(async () => {
    // 1. Initialize Redis with connection timeout
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      reconnectOnError: false
    });

    await Promise.race([
      new Promise((resolve) => redis.once('ready', resolve)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      )
    ]);

    // 2. Create WebSocket mock server
    server = new WS(wsUrl, {
      jsonProtocol: true,
      verifyClient: () => true
    });
  });

  beforeEach(async () => {
    await redis.flushall();
    WS.clean();
    client.connect(); // Explicit connection
    await server.connected;
  });

  afterEach(async () => {
    client.disconnect();
    server.close();
  });

  afterAll(async () => {
    await redis.quit();
    WS.clean();
  });

  test('processes trade messages', async () => {
    // 1. Prepare mock trade message
    const mockTrade = {
      ev: 'T',
      sym: testSymbol,
      t: Date.now(),
      p: 150.25,
      s: 100,
      c: ['@'],
      vw: 150.1
    };

    // 2. Send mock message through server
    server.send([mockTrade]);
    
    // 3. Verify Redis storage using retry logic
    const key = `ticks:${testSymbol}:${new Date().toISOString().slice(0,10).replace(/-/g, '')}`;
    
    await expect(async () => {
      const ticks = await redis.zrange(key, '-inf', '+inf');
      expect(ticks.length).toBe(1);
      expect(JSON.parse(ticks[0])).toMatchObject({
        price: 150.25,
        symbol: testSymbol
      });
    }).toPass({ timeout: 3000, interval: 200 });
  });
});
