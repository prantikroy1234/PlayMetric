const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin'], default: 'admin' },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: '' },
  },
  { timestamps: true }
);

adminUserSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

adminUserSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminUserSchema.methods.registerFailedAttempt = async function registerFailedAttempt() {
  this.failedAttempts += 1;
  if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    this.failedAttempts = 0;
  }
  await this.save();
};

adminUserSchema.methods.registerSuccessfulLogin = async function registerSuccessfulLogin(ip) {
  this.failedAttempts = 0;
  this.lockUntil = null;
  this.lastLoginAt = new Date();
  this.lastLoginIp = ip || '';
  await this.save();
};

adminUserSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
module.exports.MAX_FAILED_ATTEMPTS = MAX_FAILED_ATTEMPTS;
module.exports.LOCK_DURATION_MS = LOCK_DURATION_MS;
