// data-ingestion/polygon-websocket.js
const WebSocket = require('ws');
const Redis = require('ioredis');
const redis = new Redis();

const connectPolygon = () => {
  const ws = new WebSocket('wss://socket.polygon.io/stocks', {
    perMessageDeflate: false
  });

  ws.on('open', () => {
    ws.send(JSON.stringify({"action":"auth","params":process.env.POLYGON_KEY}));
    ws.send(JSON.stringify({"action":"subscribe","params":"T.*,Q.*,A.*"}));
  });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    // Store raw data in Redis stream
    await redis.xadd('market-data:raw', '*', 'msg', JSON.stringify(msg));
    
    // Update rolling window
    if(msg.ev === 'A') { // Aggregates
      await updateRollingWindow(msg);
    }
  });
};

async function updateRollingWindow(agg) {
  // Maintain 60-period window in Redis
  const key = `rollingWindow:${agg.sym}`;
  await redis.lpush(key, JSON.stringify(agg));
  await redis.ltrim(key, 0, 59);
}