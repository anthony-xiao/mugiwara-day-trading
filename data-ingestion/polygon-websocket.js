// data-ingestion/polygon-websocket.mjs
import WebSocket from 'websocket';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import debug from 'debug';
import { OrderBookManager } from './orderbook-manager.js'


const log = debug('polygon:ws');
dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

const connectPolygon = () => {
  const ws = new WebSocket.w3cwebsocket('wss://socket.polygon.io/stocks');

  ws.onopen = () => {
    console.log('✅ WebSocket Connected');
    ws.send(JSON.stringify({"action":"auth","params":process.env.POLYGON_API_KEY}));
    ws.send(JSON.stringify({"action":"subscribe","params":"T.*,Q.*,A.*"}));
    
  };

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
            break;
            
          case 'Q': // Quote
          console.log('Processing quote:', msg);
          const obm = new OrderBookManager(msg.sym);
          await obm.updateOrderBook({
            bids: msg.bids.slice(0, 5),
            asks: msg.asks.slice(0, 5)
          });
          await processQuote(msg);

          case 'T': // Trade
          console.log('Processing trade:', msg);
          await redis.zadd(`ticks:${msg.sym}`, 
            msg.t, 
            JSON.stringify({
              price: msg.p,
              size: msg.s,
              conditions: msg.c,
              vwap: msg.vw
            })
          );
          await processTrade(msg);

            // Handle other message types if needed
            break;
        }
      }
    }
  };
};

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

// Start connection
connectPolygon();

// Keep process alive
setInterval(() => {}, 1 << 30);