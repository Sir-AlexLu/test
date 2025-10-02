const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const { 
  generateToken, 
  generateRefreshToken, 
  formatResponse,
  validateIndianPhone,
  isRealPhoneNumber,
  isRealEmail
} = require('../../utils/helpers');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatResponse(false, 'Validation errors', errors.array()));
  }
  next();
};

// Register
router.post('/register', [
  body('email').isEmail().withMessage('Please provide a valid email')
    .custom(value => {
      if (!isRealEmail(value)) {
        throw new Error('Please provide a real email address');
      }
      return true;
    }),
  body('phone').custom(value => {
    if (!validateIndianPhone(value)) {
      throw new Error('Phone number must be in +91 followed by 10 digits format');
    }
    if (!isRealPhoneNumber(value)) {
      throw new Error('Please provide a real phone number');
    }
    return true;
  }),
  body('password').isLength({ min: 6, max: 15 }).withMessage('Password must be between 6 and 15 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,15}$/)
    .withMessage('Password must contain at least one uppercase, one lowercase, one number, and one special character'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, phone, password, referralCode, deviceId, deviceName, ipAddress, userAgent } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json(formatResponse(false, 'User with this email or phone already exists'));
    }
    
    // Check referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ 'referral.myCode': referralCode });
      if (!referrer) {
        return res.status(400).json(formatResponse(false, 'Invalid referral code'));
      }
    }
    
    // Create new user
    const user = new User({
      email,
      phone,
      password
    });
    
    // Add device and IP if provided
    if (deviceId && ipAddress) {
      await user.addOrUpdateDevice(deviceId, deviceName, ipAddress, userAgent);
      await user.addOrUpdateIpAddress(ipAddress);
    }
    
    await user.save();
    
    // Generate tokens
    const token = generateToken(user.userId);
    const refreshToken = generateRefreshToken(user.userId);
    
    // Save refresh token to user
    user.tokens.refreshToken = refreshToken;
    await user.save();
    
    res.status(201).json(formatResponse(true, 'User registered successfully', {
      user: {
        userId: user.userId,
        email: user.email,
        phone: user.phone,
        wallet: user.wallet,
        referral: user.referral,
        kyc: user.kyc,
        status: user.status,
        vipLevel: user.vipLevel
      },
      token,
      refreshToken
    }));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(formatResponse(false, 'Server error'));
  }
});

// Login
router.post('/login', [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { identifier, password, deviceId, deviceName, ipAddress, userAgent } = req.body;
    
    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });
    
    if (!user) {
      return res.status(400).json(formatResponse(false, 'Invalid credentials'));
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json(formatResponse(false, 'Invalid credentials'));
    }
    
    // Check if user is active and not banned
    if (!user.status.isActive || user.status.isBanned) {
      return res.status(400).json(formatResponse(false, 'Account is not active or is banned'));
    }
    
    // Check KYC status
    if (!user.kyc.status) {
      return res.status(403).json(formatResponse(false, 'KYC verification required. Please complete your KYC to continue.'));
    }
    
    // Add device and IP if provided
    if (deviceId && ipAddress) {
      await user.addOrUpdateDevice(deviceId, deviceName, ipAddress, userAgent);
      await user.addOrUpdateIpAddress(ipAddress);
    }
    
    // Generate tokens
    const token = generateToken(user.userId);
    const refreshToken = generateRefreshToken(user.userId);
    
    // Save refresh token to user
    user.tokens.refreshToken = refreshToken;
    await user.save();
    
    res.json(formatResponse(true, 'Login successful', {
      user: {
        userId: user.userId,
        email: user.email,
        phone: user.phone,
        wallet: user.wallet,
        referral: user.referral,
        kyc: user.kyc,
        status: user.status,
        vipLevel: user.vipLevel
      },
      token,
      refreshToken
    }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(formatResponse(false, 'Server error'));
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json(formatResponse(false, 'User ID is required'));
    }
    
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json(formatResponse(false, 'User not found'));
    }
    
    // Clear refresh token
    user.tokens.refreshToken = null;
    await user.save();
    
    res.json(formatResponse(true, 'Logout successful'));
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(formatResponse(false, 'Server error'));
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json(formatResponse(false, 'Refresh token is required'));
    }
    
    const { verifyRefreshToken, generateToken, generateRefreshToken } = require('../../utils/helpers');
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findOne({ userId: decoded.id });
    
    if (!user) {
      return res.status(401).json(formatResponse(false, 'Invalid refresh token'));
    }
    
    if (!user.status.isActive || user.status.isBanned) {
      return res.status(401).json(formatResponse(false, 'Account is not active or is banned'));
    }
    
    // Generate new tokens
    const newToken = generateToken(user.userId);
    const newRefreshToken = generateRefreshToken(user.userId);
    
    // Update refresh token in database
    user.tokens.refreshToken = newRefreshToken;
    await user.save();
    
    res.json(formatResponse(true, 'Token refreshed successfully', {
      token: newToken,
      refreshToken: newRefreshToken
    }));
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json(formatResponse(false, 'Invalid refresh token'));
  }
});

// Verify referral code
router.post('/verify-referral', [
  body('referralCode').notEmpty().withMessage('Referral code is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { referralCode } = req.body;
    
    // Find referrer
    const referrer = await User.findOne({ 'referral.myCode': referralCode });
    
    if (!referrer) {
      return res.status(400).json(formatResponse(false, 'Invalid referral code'));
    }
    
    res.json(formatResponse(true, 'Referral code is valid', {
      referrerId: referrer.userId,
      referrerName: referrer.email // You can include more info if needed
    }));
  } catch (error) {
    console.error('Verify referral code error:', error);
    res.status(500).json(formatResponse(false, 'Server error'));
  }
});

module.exports = router;
