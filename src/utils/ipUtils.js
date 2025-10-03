// src/utils/ipUtils.js
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip;
};

module.exports = { getClientIp };
