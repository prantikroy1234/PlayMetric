const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

// Since moving auth + data onto Supabase, this server no longer has a database
// or any API of its own. Its whole job is to serve the static marketing site
// with a strict Content-Security-Policy. Auth and lead capture happen in the
// browser via the vendored Supabase client (see public/js/supabase-config.js).

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
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
