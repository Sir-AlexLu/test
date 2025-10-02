const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateUserId, generateReferralCode } = require('../utils/idGenerator');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceName: { type: String, default: 'Unknown Device' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date, default: Date.now },
  addedAt: { type: Date, default: Date.now }
});

const ipAddressSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  loginCount: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

const walletSchema = new mongoose.Schema({
  totalBalance: { type: Number, default: 0 }, // withdrawable + bonus
  withdrawableBalance: { type: Number, default: 0 },
  bonusBalance: { type: Number, default: 0 },
  referralBalance: { type: Number, default: 0 }, // not included in total
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  totalWagered: { type: Number, default: 0 },
  wagerRequired: { type: Number, default: 0 }
});

const referralStatsSchema = new mongoose.Schema({
  totalReferred: { type: Number, default: 0 },
  levelA_count: { type: Number, default: 0 },
  levelB_count: { type: Number, default: 0 },
  levelC_count: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  levelA_earnings: { type: Number, default: 0 },
  levelB_earnings: { type: Number, default: 0 },
  levelC_earnings: { type: Number, default: 0 }
});

const referralSchema = new mongoose.Schema({
  referralStats: { type: referralStatsSchema, default: () => ({}) },
  myCode: { type: String, required: true, unique: true, default: generateReferralCode }
});

const bankSchema = new mongoose.Schema({
  accountNumber: { type: String, required: true, unique: true },
  ifscCode: { type: String, required: true },
  holderName: { type: String, required: true }
});

const kycSchema = new mongoose.Schema({
  status: { type: Boolean, default: false },
  bank: { type: bankSchema }
});

const statusSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  isFrozen: { type: Boolean, default: false }
});

const tokensSchema = new mongoose.Schema({
  refreshToken: { type: String }
});

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: generateUserId
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validate +91 followed by 10 digits
        return /^\+91[6-9]\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid Indian phone number!`
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Basic email validation
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 15,
    validate: {
      validator: function(v) {
        // Password must contain at least one uppercase, one lowercase, one number, and one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,15}$/.test(v);
      },
      message: props => 'Password must be 6-15 characters with at least one uppercase, one lowercase, one number, and one special character!'
    }
  },
  devices: [deviceSchema],
  ipAddresses: [ipAddressSchema],
  wallet: { type: walletSchema, default: () => ({}) },
  referral: { type: referralSchema, default: () => ({}) },
  kyc: { type: kycSchema, default: () => ({}) },
  status: { type: statusSchema, default: () => ({}) },
  vipLevel: { type: Number, default: 0, min: 0, max: 10 },
  tokens: { type: tokensSchema, default: () => ({}) }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add or update device
userSchema.methods.addOrUpdateDevice = function(deviceId, deviceName, ipAddress, userAgent) {
  const existingDevice = this.devices.find(device => device.deviceId === deviceId);
  
  if (existingDevice) {
    existingDevice.lastUsed = new Date();
    existingDevice.isActive = true;
    if (deviceName) existingDevice.deviceName = deviceName;
    if (ipAddress) existingDevice.ipAddress = ipAddress;
    if (userAgent) existingDevice.userAgent = userAgent;
  } else {
    this.devices.push({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      ipAddress,
      userAgent,
      isActive: true,
      lastUsed: new Date(),
      addedAt: new Date()
    });
  }
  
  return this.save();
};

// Add or update IP address
userSchema.methods.addOrUpdateIpAddress = function(ip) {
  const existingIp = this.ipAddresses.find(ipObj => ipObj.ip === ip);
  
  if (existingIp) {
    existingIp.loginCount += 1;
    existingIp.lastSeen = new Date();
  } else {
    this.ipAddresses.push({
      ip,
      loginCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date()
    });
  }
  
  return this.save();
};

// Update wallet balance
userSchema.methods.updateWalletBalance = function() {
  this.wallet.totalBalance = this.wallet.withdrawableBalance + this.wallet.bonusBalance;
  return this.save();
};

// Update user status
userSchema.methods.updateStatus = function(statusUpdates) {
  Object.keys(statusUpdates).forEach(key => {
    if (this.status[key] !== undefined) {
      this.status[key] = statusUpdates[key];
    }
  });
  return this.save();
};

// Update KYC status
userSchema.methods.updateKyc = function(kycData) {
  if (kycData.status !== undefined) {
    this.kyc.status = kycData.status;
  }
  
  if (kycData.bank) {
    this.kyc.bank = kycData.bank;
  }
  
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
