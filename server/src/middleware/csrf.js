const crypto = require('crypto');

// Synchronizer-token CSRF protection: the token lives server-side in the session
// (never guessable from outside) and the client must echo it back in a custom
// header on every state-changing request. A cross-site form post can't read
// response bodies or set custom headers cross-origin, so it can't forge this.

function issueCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function requireCsrfToken(req, res, next) {
  const headerToken = req.get('X-CSRF-Token');
  const sessionToken = req.session && req.session.csrfToken;

  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  return next();
}

module.exports = { issueCsrfToken, requireCsrfToken };
