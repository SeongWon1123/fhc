require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { assertProductionReady, csvEnv, isProduction, productionConfigErrors, trustProxy } = require('./config');
const { supabase } = require('./middleware/auth');
const { configureRealtime } = require('./realtime');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

function createApp() {
  assertProductionReady();
  const app = express();
  app.set('trust proxy', trustProxy());
  const httpServer = createServer(app);

  // 허용된 오리진 설정
  const ALLOWED_ORIGINS = csvEnv(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173,http://localhost:8080'
  );

  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
  });

  // Socket.IO를 express app에 저장 (routes에서 접근 가능)
  app.set('io', io);

  // 미들웨어
  app.use(helmet());
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // 레이트 리밋
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
  app.use('/api', limiter);

  // 라우터 연결
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/realtime', require('./routes/realtime'));

  configureRealtime(io, supabase);

  // 상태 엔드포인트
  app.get('/', (req, res) => res.json({ message: 'FitConnect BFF v1.0', status: 'running' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));
  app.get('/ready', (req, res) => {
    const errors = productionConfigErrors();
    res.status(errors.length ? 503 : 200).json({
      status: errors.length ? 'not_ready' : 'ready',
      ...(!isProduction() && {
        environment: process.env.ENVIRONMENT || 'development',
        production_config_errors: errors,
      }),
    });
  });

  // 전역 에러 핸들러
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, httpServer, io };
}

if (require.main === module) {
  const { httpServer, io } = createApp();
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => logger.info(`BFF server listening on port ${PORT}`));
  module.exports.io = io;
}

module.exports.createApp = createApp;
