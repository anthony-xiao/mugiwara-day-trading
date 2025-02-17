// data-ingestion/polygon-websocket.js (modified)
import WebSocket from 'websocket';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import debug from 'debug';
import { OrderBookManager } from './orderbook-manager.js';
import { TickStore } from './tick-persistence.js';

const log = debug('polygon:ws');
dotenv.config();

const WS_STATES = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED'
};

class PolygonClient {
  constructor() {
    this.redis = null;
    this.tickStore = null;
    this.activeSocket = null;
    this.initialSymbols = process.env.INITIAL_SYMBOLS?.split(',') || ['AAPL'];
    this.keepAliveInterval = null;
  }

  initialize() {
    if (!this.redis) {
      this.redis = new Redis(process.env.REDIS_URL);
      this.tickStore = new TickStore(this.redis);
    }
  }

  connect() {
    this.initialize();
    this.activeSocket = this.createSocket();
    this.keepAliveInterval = setInterval(() => {}, 1 << 30);
    return this.activeSocket;
  }

  disconnect() {
    if (this.activeSocket) {
      this.activeSocket.close();
      this.activeSocket = null;
    }
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  createSocket() {
    const ws = new WebSocket.w3cwebsocket('wss://socket.polygon.io/stocks');

    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      ws.send(JSON.stringify({"action":"auth","params":process.env.POLYGON_API_KEY}));
    };

    // ... rest of the socket handlers (onclose, onerror, onmessage) ...
    ws.onclose = (event) => {
      console.log(`❌ Connection closed: ${event.code} ${event.reason}`);
    };
  
    ws.onerror = (error) => {
      console.error('⚠️ WebSocket Error:', error);
    };
  
    ws.onmessage = async (message) => {
      console.log('📨 Message received:', message.data);
      if (typeof message.data === 'string') {
        const messages = JSON.parse(message.data);
        for (const msg of messages) {
          console.log('Processing message type:', msg.ev);
          
          // Store raw data in Redis stream
          await redis.xadd('market-data:raw', '*', 'msg', JSON.stringify(msg));
  
          // Handle different message types
          switch (msg.ev) {
            case 'A': // Aggregate (minute bar)
              console.log('Processing aggregate:', msg);
              await updateRollingWindow(msg);
              // Persist aggregate tick
              await tickStore.saveTick(msg.sym, {
                timestamp: msg.e,
                open: msg.o,
                high: msg.h,
                low: msg.l,
                close: msg.c,
                volume: msg.v
              });
              break;
              
            case 'Q': // Quote
            console.log('Processing quote:', msg);
            await processQuote(msg);
            try {
              const obm = new OrderBookManager(msg.sym, redis);
              await obm.updateOrderBook(msg); // Pass the entire quote message
            
              // Verify update
              console.log(`📊 Updated order book for ${msg.sym}:`, {
                bid: msg.bp,
                ask: msg.ap,
                timestamp: new Date(msg.t).toISOString()
              });
              const bestBid = await obm.getBestBid();
              console.log(`Updated ${msg.sym} order book. Best bid:`, bestBid);
            } catch (err) {
              console.error('Error processing quote:', err);
            }
  
            case 'T': // Trade
            console.log('Processing trade:', msg);
            await processTrade(msg);
            try {
              await tickStore.saveTick(msg.sym, {
                timestamp: msg.t,
                price: msg.p,
                size: msg.s,
                conditions: msg.c,
                vwap: msg.vw
              });
            } catch (err) {
              console.error('Error processing trade:', err);
            }
  
              // Handle other message types if needed
              break;
          }
        }
      }
    };

    return ws;
  }

  subscribe(symbols) {
    if (!this.activeSocket) {
      console.log('⚠️ No active socket - connect first');
      return;
    }

    const subscriptions = symbols.flatMap(sym => 
      ['T', 'Q', 'A'].map(type => `${type}.${sym}`)
    );

    this.activeSocket.send(JSON.stringify({
      action: 'subscribe',
      params: subscriptions.join(',')
    }));
    
    console.log(`✅ Subscribed to: ${subscriptions.join(', ')}`);
  }

  async shutdown() {
    this.disconnect();
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
async function updateRollingWindow(agg) {
  try {
    const key = `rollingWindow:${agg.sym}`;
    await redis.lpush(key, JSON.stringify(agg));
    await redis.ltrim(key, 0, 59);
    console.log(`Updated rolling window for ${agg.sym}`);
    
    // Verify storage
    const length = await redis.llen(key);
    console.log(`Current window size for ${agg.sym}: ${length}`);
  } catch (err) {
    console.error('Error updating rolling window:', err);
  }
}

async function processQuote(quote) {
  // Store quote data
  const key = `quote:${quote.sym}`;
  await redis.hset(key, {
    bid: quote.bp,
    ask: quote.ap,
    bidSize: quote.bs,
    askSize: quote.as,
    timestamp: quote.t
  });
  console.log(`Updated quote for ${quote.sym}`);
}

async function processTrade(trade) {
  // Store trade data
  await redis.xadd(`trades:${trade.sym}`, '*', 'trade', JSON.stringify(trade));
  console.log(`Stored trade for ${trade.sym}`);
}

const flushOnExit = async () => {
  await tickStore.flush();
  process.exit();
};

process.on('SIGINT', flushOnExit);
process.on('SIGTERM', flushOnExit);
process.on('beforeExit', () => tickStore.flush());

// Export singleton instance but don't auto-connect
export const client = new PolygonClient();

// Remove these from global scope:
// - connectPolygon() call
// - setInterval
// - process event listeners
