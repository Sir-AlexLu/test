const crypto = require('crypto');

const generateUserId = () => {
  const timestamp = Date.now().toString();
  const randomChars = crypto.randomBytes(3).toString('hex');
  return `USR${timestamp}${randomChars.toUpperCase()}`;
};

const generateReferralCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 4 }, () => 
    letters.charAt(Math.floor(Math.random() * letters.length))
  ).join('');
  const randomNumbers = Math.floor(1000 + Math.random() * 9000);
  return `REFL${randomLetters}${randomNumbers}`;
};

module.exports = {
  generateUserId,
  generateReferralCode
};
