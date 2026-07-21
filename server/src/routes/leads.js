const express = require('express');
const { body, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const { leadLimiter } = require('../middleware/rateLimiters');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

const validators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('A valid email is required').isLength({ max: 254 }).normalizeEmail(),
  body('academyName').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 32 }).matches(/^[0-9+\-\s()]*$/).withMessage('Invalid phone number'),
  body('message').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  // Honeypot: real visitors never see or fill this field (hidden via CSS). Bots that
  // blindly fill every form field will trip it.
  body('website').optional({ checkFalsy: true }).isLength({ max: 0 }).withMessage('bot'),
];

router.post('/', leadLimiter, validators, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Honeypot trip: pretend success so the bot doesn't learn it was caught.
    const isHoneypot = errors.array().some((e) => e.path === 'website');
    if (isHoneypot) {
      return res.status(201).json({ message: "Thanks! We'll be in touch." });
    }
    return res.status(400).json({ error: 'Please check the form and try again.', details: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
  }

  const { name, email, academyName, phone, message } = req.body;

  await Lead.create({
    name,
    email,
    academyName: academyName || '',
    phone: phone || '',
    message: message || '',
    source: 'hero-book-demo',
    ip: req.ip || '',
  });

  return res.status(201).json({ message: "Thanks! We'll be in touch." });
}));

module.exports = router;
