const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const leadsRouter = require('./routes/leads');
const adminRouter = require('./routes/admin');
const { apiLimiter } = require('./middleware/rateLimiters');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const ADMIN_DIR = path.join(__dirname, '..', '..', 'admin');

function createApp({ mongoUri, sessionSecret, allowedOrigins, isProduction }) {
  const app = express();

  // We sit behind a reverse proxy in production (TLS terminated upstream); this
  // makes req.ip and req.secure reflect the real client instead of the proxy hop.
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https://picsum.photos', 'https://fastly.picsum.photos', 'https://i.pravatar.cc'],
          mediaSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(hpp());

  app.use(
    session({
      name: 'pm.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'sessions', ttl: 4 * 60 * 60 }),
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 4 * 60 * 60 * 1000, // 4 hours
      },
    })
  );

  app.use('/api', apiLimiter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/admin', adminRouter);

  // Keep the admin shell out of search engines even though it holds no data itself.
  app.get('/admin/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /admin\n');
  });
  app.use('/admin', express.static(ADMIN_DIR));

  app.use(express.static(PUBLIC_DIR));

  // 404 for anything unmatched under /api.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralized error handler — never leak stack traces or internals to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
