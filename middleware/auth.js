const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { formatResponse } = require('../utils/helpers');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(formatResponse(false, 'Access denied. No token provided.'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ userId: decoded.id });
    
    if (!user) {
      return res.status(401).json(formatResponse(false, 'Invalid token.'));
    }
    
    if (!user.status.isActive || user.status.isBanned) {
      return res.status(401).json(formatResponse(false, 'Account is not active or is banned.'));
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json(formatResponse(false, 'Invalid token.'));
  }
};

module.exports = auth;
