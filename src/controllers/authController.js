// src/controllers/authController.js
const User = require('../models/User');
const { generateToken } = require('../config/jwt');
const { generateDeviceId } = require('../utils/deviceTracker');
const { getClientIp } = require('../utils/ipUtils');

// Register a new user
const register = async (req, res) => {
  try {
    const { username, phoneNumber, email, password, withdrawalPin, referredBy } = req.body;
    
    // Get client IP and device info
    const ipAddress = getClientIp(req);
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    
    // Generate device ID
    const deviceId = generateDeviceId();
    
    // Create user
    const user = await User.create({
      username,
      phoneNumber,
      email,
      password,
      withdrawalPin,
      referredBy,
      lastLogin: {
        ipAddress,
        deviceInfo,
        deviceId
      }
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Return user data without sensitive information
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        referCode: user.referCode,
        lastLogin: user.lastLogin,
        wallet: user.wallet,
        kyc: user.kyc,
        vipLevel: user.vipLevel,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ 
        success: false,
        message: `${field} already exists` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { loginId, password } = req.body;
    
    // Get client IP and device info
    const ipAddress = getClientIp(req);
    const deviceInfo = req.headers['user-agent'] || 'Unknown';
    
    // Find user by username, email, or phone number
    const user = await User.findOne({
      $or: [
        { username: loginId },
        { email: loginId },
        { phoneNumber: loginId }
      ]
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }
    
    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({ 
        success: false,
        message: `Account is ${user.status}` 
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }
    
    // Update login history
    await user.updateLoginHistory(ipAddress, deviceInfo, user.lastLogin.deviceId);
    
    // Generate token
    const token = generateToken(user._id);
    
    // Return user data without sensitive information
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        referCode: user.referCode,
        lastLogin: user.lastLogin,
        wallet: user.wallet,
        kyc: user.kyc,
        vipLevel: user.vipLevel,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        referCode: user.referCode,
        referredBy: user.referredBy,
        lastLogin: user.lastLogin,
        loginHistory: user.loginHistory,
        wallet: user.wallet,
        bank: user.bank,
        kyc: user.kyc,
        vipLevel: user.vipLevel,
        status: user.status,
        monthlyBonusGiven: user.monthlyBonusGiven,
        registeredAt: user.registeredAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Add bank details
const addBankDetails = async (req, res) => {
  try {
    const { accountNumber, holderName, ifscCode, upi } = req.body;
    
    // Check if bank details are unique
    const isUnique = await User.isBankUnique(accountNumber, ifscCode, upi);
    if (!isUnique) {
      return res.status(400).json({
        success: false,
        message: 'Bank details already associated with another account'
      });
    }
    
    const user = await User.findById(req.user.id);
    
    // Update bank details
    user.bank = {
      accountNumber,
      holderName,
      ifscCode,
      upi
    };
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Bank details added successfully',
      bank: user.bank
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Logout user (client-side token removal)
const logout = async (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
};

module.exports = {
  register,
  login,
  getProfile,
  addBankDetails,
  logout
};
