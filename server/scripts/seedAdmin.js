// Creates (or updates the password of) the first admin account.
// Usage: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in server/.env, then:
//   npm run seed:admin
// Remove the SEED_ADMIN_* values from .env once you've run this — they're only
// needed for the one-time bootstrap.

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const AdminUser = require('../src/models/AdminUser');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/playmetric';
const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || '';

function validate() {
  const problems = [];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push('SEED_ADMIN_EMAIL is missing or not a valid email address.');
  }
  if (!password || password.length < 12) {
    problems.push('SEED_ADMIN_PASSWORD is missing or shorter than 12 characters.');
  }
  if (password === 'change-this-before-seeding') {
    problems.push('SEED_ADMIN_PASSWORD is still the placeholder value from .env.example.');
  }
  return problems;
}

async function main() {
  const problems = validate();
  if (problems.length) {
    console.error('[seed:admin] Cannot proceed:');
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }

  await connectDB(MONGODB_URI);

  const passwordHash = await AdminUser.hashPassword(password);
  const existing = await AdminUser.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.failedAttempts = 0;
    existing.lockUntil = null;
    await existing.save();
    console.log(`[seed:admin] Updated password for existing admin: ${email}`);
  } else {
    await AdminUser.create({ email, passwordHash, role: 'owner' });
    console.log(`[seed:admin] Created admin account: ${email}`);
  }

  console.log('[seed:admin] Done. Remove SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD from .env now.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed:admin] Failed:', err);
  process.exit(1);
});
