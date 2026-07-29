const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { createIntegrationsRouter } = require('./routes/integrations');

// Since moving auth + data onto Supabase, this server no longer has a database
// or any API of its own. Its whole job is to serve the static marketing site
// with a strict Content-Security-Policy. Auth and lead capture happen in the
// browser via the vendored Supabase client (see public/js/supabase-config.js).

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
// The React admin console is built (Vite) into console/dist and served here
// under /app, so it shares the marketing origin — and therefore the Supabase
// auth session in localStorage set on /signin. Run `npm run build` in console/
// to (re)generate this directory.
const CONSOLE_DIR = path.join(__dirname, '..', '..', 'console', 'dist');
const SUPABASE_ORIGIN = process.env.SUPABASE_ORIGIN || 'https://mjkkrgpntlqbioevxdvw.supabase.co';

function createApp({ isProduction }) {
  const app = express();

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
          // The browser Supabase client calls the project's REST + Auth
          // endpoints over HTTPS; allow exactly that origin, nothing wider.
          connectSrc: ["'self'", SUPABASE_ORIGIN],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(morgan(isProduction ? 'combined' : 'dev'));

  // Partner booking integration TEST RIG (mock feed + webhook receiver).
  // The only server-side API surface; everything else is still static.
  // Mounted before the static handlers so /api/* never falls through to them.
  app.use('/api', createIntegrationsRouter());

  // Admin console (built SPA) under /app. Static assets first, then a catch-all
  // that hands any deeper client-side route back to the console's index.html so
  // react-router (basename="/app") can take over.
  app.use('/app', express.static(CONSOLE_DIR));
  app.get('/app/*', (req, res) => {
    res.sendFile(path.join(CONSOLE_DIR, 'index.html'), (err) => {
      if (err) res.status(404).send('Console not built — run `npm run build` in console/.');
    });
  });

  // Marketing site.
  app.use(express.static(PUBLIC_DIR));

  // Anything else is a genuine 404 — there is no API surface anymore.
  app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
      if (err) res.status(404).send('Not found');
    });
  });

  return app;
}

module.exports = { createApp };
