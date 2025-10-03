// src/utils/generateId.js
const crypto = require('crypto');

const generateUserId = () => {
  const prefix = 'sB';
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `${prefix}${randomBytes}`;
};

module.exports = { generateUserId };
