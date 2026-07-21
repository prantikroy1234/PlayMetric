const rateLimit = require('express-rate-limit');

// Public lead-capture form: generous enough for real visitors, tight enough to blunt spam bots.
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this network. Please try again later.' },
});

// Admin login: strict, on top of the per-account lockout in AdminUser, to blunt distributed
// credential-stuffing that spreads attempts across many accounts from one source.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Baseline limiter for the rest of the API surface.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { leadLimiter, loginLimiter, apiLimiter };
