// src/utils/deviceTracker.js
const crypto = require('crypto');

const generateDeviceId = () => {
  return crypto.randomBytes(16).toString('hex');
};

module.exports = { generateDeviceId };
