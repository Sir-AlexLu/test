const crypto = require('crypto');

const generateUserId = () => {
  // Generate 8 unique alphanumeric characters
  const randomChars = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `sB${randomChars}`;
};

const generateReferralCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = Array.from({ length: 4 }, () => 
    letters.charAt(Math.floor(Math.random() * letters.length))
  ).join('');
  const randomNumbers = Math.floor(1000 + Math.random() * 9000);
  return `sB${randomLetters}${randomNumbers}`;
};

const generateTransactionId = (type) => {
  const prefix = type === 'deposit' ? 'DIN' : 
                 type === 'withdrawal' ? 'WOT' : 
                 type === 'bonus' ? 'BNS' : 'SYS';
  
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomChars = crypto.randomBytes(2).toString('hex');
  return `sB${prefix}${date}${randomChars}`;
};

const generateBetId = () => {
  const randomChars = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `sB${randomChars}`;
};

module.exports = {
  generateUserId,
  generateReferralCode,
  generateTransactionId,
  generateBetId
};
