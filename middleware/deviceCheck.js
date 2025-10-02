// middleware/deviceCheck.js
const User = require('../models/User');
const crypto = require('crypto');

const generateDeviceId = (userAgent, ip) => {
  const hash = crypto.createHash('sha256');
  hash.update(userAgent + ip + Date.now().toString());
  return hash.digest('hex').substring(0, 16);
};

const deviceCheck = async (req, res, next) => {
  try {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    let deviceId = req.headers['x-device-id'];
    
    if (!deviceId) {
      deviceId = generateDeviceId(userAgent, ipAddress);
    }
    
    // Check for banned devices
    const bannedDevice = await User.findOne({
      'devices.deviceId': deviceId,
      'status.isBanned': true
    });
    
    if (bannedDevice) {
      return res.status(403).json({
        success: false,
        message: 'This device has been banned',
        code: 'DEVICE_BANNED'
      });
    }
    
    // Check multiple accounts (allow max 3 per device)
    const deviceUsers = await User.countDocuments({
      'devices.deviceId': deviceId,
      'status.isActive': true
    });
    
    if (deviceUsers >= 3 && !req.user) {
      return res.status(403).json({
        success: false,
        message: 'Maximum accounts limit reached for this device',
        code: 'MAX_ACCOUNTS_REACHED'
      });
    }
    
    req.deviceInfo = {
      deviceId,
      ipAddress,
      userAgent
    };
    
    next();
  } catch (error) {
    console.error('Device check error:', error);
    next();
  }
};

module.exports = deviceCheck;
