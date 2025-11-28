const rateLimit = require('express-rate-limit');

// Global limiter: 300 req / 15min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Login limiter: 10 req / 5min per IP
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'too many login attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset request limiter: 3 req / 30min per IP
const resetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  message: { error: 'too many reset requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Gacha spin limiter: 8 req / 1min per IP
const gachaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: 'too many gacha spins' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Coop attack limiter: 20 req / 1min per IP
const coopAttackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'too many attacks' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public listing endpoints limiter: 60 req / 1min per IP
const publicListLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  loginLimiter,
  resetLimiter,
  gachaLimiter,
  coopAttackLimiter,
  publicListLimiter,
};
