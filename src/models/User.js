// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateUserId } = require('../utils/generateId');

const bankSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  holderName: {
    type: String,
    required: true
  },
  ifscCode: {
    type: String,
    required: true
  }
}, { _id: false });

const loginHistorySchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true
  },
  deviceInfo: {
    type: String,
    required: true
  },
  loginTime: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const walletSchema = new mongoose.Schema({
  totalBalance: {
    type: Number,
    default: 0
  },
  withdrawableBalance: {
    type: Number,
    default: 0
  },
  nonWithdrawableBalance: {
    type: Number,
    default: 0
  },
  referralBalance: {
    type: Number,
    default: 0
  },
  totalDeposited: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  depositedToday: {
    type: Number,
    default: 0
  },
  withdrawnToday: {
    type: Number,
    default: 0
  },
  lastDepositDate: {
    type: Date
  },
  lastWithdrawDate: {
    type: Date
  },
  wagerRequired: {
    type: Number,
    default: 0
  },
  wagered: {
    type: Number,
    default: 0
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    default: generateUserId
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 4,
    maxlength: 14,
    match: /^[a-zA-Z0-9]+$/
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    match: /^[6-9]\d{9}$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  withdrawalPin: {
    type: String,
    required: true,
    minlength: 4
  },
  referCode: {
    type: String,
    required: true,
    unique: true,
    default: generateUserId
  },
  referredBy: {
    type: String,
    default: null
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  wallet: {
    type: walletSchema,
    default: () => ({})
  },
  bank: {
    type: bankSchema,
    default: null
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  vipLevel: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'banned', 'freeze'],
    default: 'active'
  },
  monthlyBonusGiven: {
    type: Number,
    default: 0
  },
  lastLogin: {
    ipAddress: String,
    deviceInfo: String,
    loginTime: {
      type: Date,
      default: Date.now
    }
  },
  loginHistory: [loginHistorySchema],
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Hash withdrawal pin
    const pinSalt = await bcrypt.genSalt(10);
    this.withdrawalPin = await bcrypt.hash(this.withdrawalPin, pinSalt);
    
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compare withdrawal pin method
userSchema.methods.compareWithdrawalPin = async function(candidatePin) {
  return bcrypt.compare(candidatePin, this.withdrawalPin);
};

// Update login history
userSchema.methods.updateLoginHistory = function(ipAddress, deviceInfo) {
  this.lastLogin = {
    ipAddress,
    deviceInfo,
    loginTime: new Date()
  };
  
  this.loginHistory.push({
    ipAddress,
    deviceInfo,
    loginTime: new Date()
  });
  
  // Keep only last 10 login records
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }
  
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
