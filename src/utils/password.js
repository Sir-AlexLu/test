// src/utils/password.js
const crypto = require('crypto');

const generateRandomPassword = (length = 8) => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

module.exports = { generateRandomPassword };
