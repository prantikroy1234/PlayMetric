const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { connectDB } = require('./config/db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 8420;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/playmetric';
const SESSION_SECRET = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!SESSION_SECRET || SESSION_SECRET === 'replace-with-a-long-random-value') {
  console.error(
    '[startup] SESSION_SECRET is missing or still the placeholder value. ' +
      'Set a real random secret in server/.env before starting the server.'
  );
  process.exit(1);
}

if (isProduction && !allowedOrigins.every((origin) => origin.startsWith('https://'))) {
  console.warn('[startup] Running in production with a non-HTTPS allowed origin. Double-check ALLOWED_ORIGINS.');
}

async function main() {
  await connectDB(MONGODB_URI);

  const app = createApp({
    mongoUri: MONGODB_URI,
    sessionSecret: SESSION_SECRET,
    allowedOrigins,
    isProduction,
  });

  const server = app.listen(PORT, () => {
    console.log(`[startup] PlayMetric server listening on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });

  const shutdown = (signal) => {
    console.log(`[shutdown] Received ${signal}, closing server...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[startup] Fatal error starting server:', err);
  process.exit(1);
});
