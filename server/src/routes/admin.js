const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const AdminUser = require('../models/AdminUser');
const Lead = require('../models/Lead');
const { requireAdmin } = require('../middleware/auth');
const { issueCsrfToken, requireCsrfToken } = require('../middleware/csrf');
const { loginLimiter } = require('../middleware/rateLimiters');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

// A fixed dummy hash so login timing doesn't reveal whether an email exists in the
// database (bcrypt.compare always runs, whether or not the user was found).
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeOoyxV.j0y9K3f0m0Y5vJ7kK9k0Q3s3S6';

router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isString().isLength({ min: 1, max: 200 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const { email, password } = req.body;
    const user = await AdminUser.findOne({ email });

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH); // keep timing constant
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isLocked()) {
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed attempts. Try again later.' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.registerFailedAttempt();
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await user.registerSuccessfulLogin(req.ip);

    // Regenerate the session on privilege change to prevent session fixation.
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed. Please try again.' });
      }
      req.session.adminId = user._id.toString();
      req.session.role = user.role;
      const csrfToken = issueCsrfToken(req);
      return res.json({ email: user.email, role: user.role, csrfToken });
    });
  })
);

router.post('/logout', requireAdmin, requireCsrfToken, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('pm.sid');
    res.json({ message: 'Logged out.' });
  });
});

router.get('/session', requireAdmin, asyncHandler(async (req, res) => {
  const user = await AdminUser.findById(req.session.adminId).select('email role');
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const csrfToken = issueCsrfToken(req);
  return res.json({ email: user.email, role: user.role, csrfToken });
}));

router.get(
  '/leads',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['new', 'contacted', 'qualified', 'closed']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid query parameters.' });
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 25;
    const filter = req.query.status ? { status: req.query.status } : {};

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.json({ leads, total, page, limit });
  })
);

router.patch(
  '/leads/:id',
  requireAdmin,
  requireCsrfToken,
  [
    param('id').custom((value) => mongoose.isValidObjectId(value)).withMessage('Invalid lead id'),
    body('status').isIn(['new', 'contacted', 'qualified', 'closed']).withMessage('Invalid status'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid request.' });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).lean();

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    res.json({ lead });
  })
);

module.exports = router;
