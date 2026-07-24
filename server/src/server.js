const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createApp } = require('./app');

const PORT = process.env.PORT || 8420;
const isProduction = process.env.NODE_ENV === 'production';

const app = createApp({ isProduction });

const server = app.listen(PORT, () => {
  console.log(`[startup] PlayMetric static site on port ${PORT} (${isProduction ? 'production' : 'development'})`);
});

const shutdown = (signal) => {
  console.log(`[shutdown] Received ${signal}, closing server...`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
