// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (req.user.status.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned',
        reason: req.user.status.banReason
      });
    }
    
    if (req.user.status.suspendedTill && new Date(req.user.status.suspendedTill) > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended',
        suspendedTill: req.user.status.suspendedTill
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const admin = async (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

module.exports = { protect, admin };
