// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later'
);

const generalLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  100, // limit each IP to 100 requests per minute
  'Too many requests'
);

const betLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  30, // limit each IP to 30 bets per minute
  'Too many bets placed, please slow down'
);

const withdrawalLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // limit each IP to 3 withdrawal requests per hour
  'Too many withdrawal requests'
);

module.exports = {
  authLimiter,
  generalLimiter,
  betLimiter,
  withdrawalLimiter
};
