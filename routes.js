// routes.js
const express = require('express');
const controllers = require('./controllers');
const { protect } = require('./middleware/auth');
const deviceCheck = require('./middleware/deviceCheck');
const {
  authLimiter,
  generalLimiter,
  betLimiter,
  withdrawalLimiter
} = require('./middleware/rateLimiter');

module.exports = (app) => {
  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'sBucks API is running',
      timestamp: new Date(),
      uptime: process.uptime()
    });
  });
  
  // ==================== AUTH ROUTES ====================
  app.post('/api/auth/register', authLimiter, deviceCheck, controllers.register);
  app.post('/api/auth/login', authLimiter, deviceCheck, controllers.login);
  
  // ==================== WALLET ROUTES ====================
  app.get('/api/wallet', protect, generalLimiter, controllers.getWallet);
  app.post('/api/wallet/deposit', protect, generalLimiter, deviceCheck, controllers.requestDeposit);
  app.post('/api/wallet/withdraw', protect, withdrawalLimiter, deviceCheck, controllers.requestWithdrawal);
  
  // ==================== BETTING ROUTES ====================
  app.post('/api/bet/place', protect, betLimiter, deviceCheck, controllers.placeBet);
  app.post('/api/bet/settle', protect, controllers.settleBet); // This would be internal/admin only
  
  // ==================== TRANSACTION ROUTES ====================
  app.get('/api/transactions', protect, generalLimiter, controllers.getTransactionHistory);
  
  // ==================== REFERRAL ROUTES ====================
  app.get('/api/referral', protect, generalLimiter, controllers.getReferralInfo);
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });
};
