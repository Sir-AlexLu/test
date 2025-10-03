// src/routes/auth.js
const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin, validateBankDetails } = require('../middleware/validation');
const { register, login, getProfile, addBankDetails, logout } = require('../controllers/authController');

const router = express.Router();

// User authentication routes
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.get('/profile', protect, getProfile);
router.post('/bank', protect, validateBankDetails, addBankDetails);
router.post('/logout', protect, logout);

module.exports = router;
