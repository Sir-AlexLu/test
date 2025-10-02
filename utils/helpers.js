const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// Format response
const formatResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data
  };
};

// Validate Indian phone number
const validateIndianPhone = (phone) => {
  return /^\+91[6-9]\d{9}$/.test(phone);
};

// Check if phone number is real (basic check)
const isRealPhoneNumber = (phone) => {
  // Remove +91 prefix for validation
  const phoneNumber = phone.substring(3);
  
  // Check for common fake patterns
  const fakePatterns = [
    /^1234567890$/, // Sequential numbers
    /^1111111111$/, // All same digits
    /^0000000000$/, // All zeros
    /^9876543210$/, // Reverse sequential
    /^9999999999$/, // All 9s
    /^8888888888$/, // All 8s
  ];
  
  // Return false if any fake pattern matches
  for (const pattern of fakePatterns) {
    if (pattern.test(phoneNumber)) {
      return false;
    }
  }
  
  return true;
};

// Check if email is real (basic check)
const isRealEmail = (email) => {
  // Check for common fake email patterns
  const fakePatterns = [
    /^test@/, // Test emails
    /^example@/, // Example emails
    /^fake@/, // Fake emails
    /^demo@/, // Demo emails
    /@test\.com$/, // Test domain
    /@example\.com$/, // Example domain
  ];
  
  // Return false if any fake pattern matches
  for (const pattern of fakePatterns) {
    if (pattern.test(email)) {
      return false;
    }
  }
  
  return true;
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  formatResponse,
  validateIndianPhone,
  isRealPhoneNumber,
  isRealEmail
};
