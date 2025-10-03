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
  },
  upi: {
    type: String,
    required: false
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

const kycSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  documents: [{
    type: String, // URLs to stored documents
    required: false
  }],
  verifiedAt: {
    type: Date,
    required: false
  },
  rejectionReason: {
    type: String,
    required: false
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
  lastLogin: {
    ipAddress: {
      type: String,
      required: true
    },
    deviceInfo: {
      type: String,
      required: true
    },
    deviceId: {
      type: String,
      required: true,
      unique: true
    },
    loginTime: {
      type: Date,
      default: Date.now
    }
  },
  loginHistory: [loginHistorySchema],
  wallet: {
    type: walletSchema,
    default: () => ({})
  },
  bank: {
    type: bankSchema,
    default: null
  },
  kyc: {
    type: kycSchema,
    default: () => ({})
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
    type: Boolean,
    default: false
  },
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
userSchema.methods.updateLoginHistory = function(ipAddress, deviceInfo, deviceId) {
  // Update last login
  this.lastLogin = {
    ipAddress,
    deviceInfo,
    deviceId,
    loginTime: new Date()
  };
  
  // Add to login history
  this.loginHistory.push({
    ipAddress,
    deviceInfo,
    loginTime: new Date()
  });
  
  // Keep only last 5 login records
  if (this.loginHistory.length > 5) {
    this.loginHistory = this.loginHistory.slice(-5);
  }
  
  return this.save();
};

// Check if bank details already exist
userSchema.statics.isBankUnique = async function(accountNumber, ifscCode, upi) {
  const existingUser = await this.findOne({
    'bank.accountNumber': accountNumber,
    'bank.ifscCode': ifscCode
  });
  
  if (existingUser) {
    return false;
  }
  
  if (upi) {
    const existingUpiUser = await this.findOne({
      'bank.upi': upi
    });
    
    if (existingUpiUser) {
      return false;
    }
  }
  
  return true;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
