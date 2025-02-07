// shared/logger.js
import winston from 'winston';
import { DateTime } from 'luxon';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => DateTime.now().toISO()
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/risk-protocols.log',
      maxsize: 10 * 1024 * 1024 // 10MB
    })
  ]
});

export { logger };