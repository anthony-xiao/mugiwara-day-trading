import { TickStore } from '../data-ingestion/tick-persistence.js';
import Redis from 'ioredis';

describe('Tick Persistence', () => {
  let redis;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL);
  });

  afterAll(async () => {
    await redis.quit();
  });

  test('basic storage', async () => {
    const store = new TickStore(redis);
    await store.saveTick('TEST', { timestamp: Date.now(), price: 100 });
    await store.flush();
    const count = await redis.zcount(`ticks:TEST:20240101`, '-inf', '+inf');
    expect(count).toBe(1);
  });
});