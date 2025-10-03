// src/middleware/validation.js
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateRegister = [
  body('username')
    .isLength({ min: 4, max: 14 })
    .withMessage('Username must be between 4 and 14 characters')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Username must contain only alphanumeric characters')
    .custom(async (value) => {
      const user = await User.findOne({ username: value });
      if (user) {
        throw new Error('Username already exists');
      }
      return true;
    }),
  body('phoneNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid Indian phone number')
    .custom(async (value) => {
      const user = await User.findOne({ phoneNumber: value });
      if (user) {
        throw new Error('Phone number already exists');
      }
      return true;
    }),
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail()
    .custom(async (value) => {
      const user = await User.findOne({ email: value });
      if (user) {
        throw new Error('Email already exists');
      }
      return true;
    }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('withdrawalPin')
    .isLength({ min: 4, max: 6 })
    .withMessage('Withdrawal PIN must be between 4 and 6 digits')
    .isNumeric()
    .withMessage('Withdrawal PIN must contain only numbers'),
  body('referredBy')
    .optional()
    .custom(async (value) => {
      if (value) {
        const referrer = await User.findOne({ referCode: value });
        if (!referrer) {
          throw new Error('Invalid referral code');
        }
      }
      return true;
    }),
  handleValidationErrors
];

const validateLogin = [
  body('loginId')
    .notEmpty()
    .withMessage('Please enter username, email, or phone number'),
  body('password')
    .notEmpty()
    .withMessage('Please enter your password'),
  handleValidationErrors
];

module.exports = { validateRegister, validateLogin };
