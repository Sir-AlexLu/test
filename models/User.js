// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    index: true,
    default: function() {
      return 'USR' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
  },
  
  phone: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v);
      },
      message: 'Invalid phone number'
    }
  },
  
  email: {
    type: String,
    unique: true,
    required: [true, 'Email is required'],
    lowercase: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: 'Invalid email address'
    }
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  
  devices: [{
    deviceId: String,
    deviceName: String,
    lastUsed: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    isActive: { type: Boolean, default: true },
    addedAt: { type: Date, default: Date.now }
  }],
  
  ipAddresses: [{
    ip: String,
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    loginCount: { type: Number, default: 1 },
    country: String,
    city: String
  }],
  
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    winningBalance: { type: Number, default: 0, min: 0 },
    bonusBalance: { type: Number, default: 0, min: 0 },
    totalDeposited: { type: Number, default: 0, min: 0 },
    totalWithdrawn: { type: Number, default: 0, min: 0 },
    totalWagered: { type: Number, default: 0, min: 0 },
    totalWon: { type: Number, default: 0, min: 0 },
    totalLost: { type: Number, default: 0, min: 0 }
  },
  
  referral: {
    myCode: {
      type: String,
      unique: true,
      index: true,
      default: function() {
        return 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase();
      }
    },
    referredBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      code: String,
      date: Date
    },
    referralChain: {
      levelA: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      levelB: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      levelC: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    referralStats: {
      totalReferred: { type: Number, default: 0 },
      levelA_count: { type: Number, default: 0 },
      levelB_count: { type: Number, default: 0 },
      levelC_count: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0, min: 0 },
      levelA_earnings: { type: Number, default: 0, min: 0 },
      levelB_earnings: { type: Number, default: 0, min: 0 },
      levelC_earnings: { type: Number, default: 0, min: 0 },
      lastEarningDate: Date
    }
  },
  
  rewards: {
    points: { type: Number, default: 0, min: 0 },
    tier: { 
      type: String, 
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'bronze'
    },
    achievements: [{
      name: String,
      description: String,
      unlockedAt: { type: Date, default: Date.now },
      reward: Number
    }],
    streaks: {
      loginStreak: { type: Number, default: 0, min: 0 },
      lastLoginDate: Date,
      bettingStreak: { type: Number, default: 0, min: 0 },
      lastBetDate: Date,
      maxLoginStreak: { type: Number, default: 0, min: 0 },
      maxBettingStreak: { type: Number, default: 0, min: 0 }
    },
    specialBonuses: [{
      type: { type: String },
      amount: Number,
      reason: String,
      givenAt: { type: Date, default: Date.now },
      expiresAt: Date,
      isUsed: { type: Boolean, default: false },
      usedAt: Date
    }],
    vipLevel: { type: Number, default: 0, min: 0, max: 10 },
    vipPoints: { type: Number, default: 0, min: 0 }
  },
  
  status: {
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    suspendedTill: Date,
    banReason: String,
    banDate: Date,
    lastSeen: Date
  },
  
  stats: {
    totalBets: { type: Number, default: 0, min: 0 },
    totalWins: { type: Number, default: 0, min: 0 },
    totalLosses: { type: Number, default: 0, min: 0 },
    biggestWin: { type: Number, default: 0, min: 0 },
    biggestBet: { type: Number, default: 0, min: 0 },
    favoriteGame: String,
    gamesPlayed: {
      wingo: { type: Number, default: 0 },
      crash: { type: Number, default: 0 },
      dice: { type: Number, default: 0 },
      mines: { type: Number, default: 0 }
    },
    lastActive: Date,
    totalPlaytime: { type: Number, default: 0 }, // in minutes
    averageBetAmount: { type: Number, default: 0 }
  },
  
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      promotional: { type: Boolean, default: true },
      winnings: { type: Boolean, default: true }
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      withdrawalPin: String,
      loginAlerts: { type: Boolean, default: true }
    },
    preferences: {
      currency: { type: String, default: 'INR' },
      language: { type: String, default: 'en' },
      theme: { type: String, default: 'dark' }
    }
  },
  
  tokens: {
    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date
  }
  
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ 'devices.deviceId': 1 });
userSchema.index({ 'referral.myCode': 1 });
userSchema.index({ 'status.isActive': 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT Token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Generate Refresh Token
userSchema.methods.getRefreshToken = function() {
  const refreshToken = jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE
  });
  this.tokens.refreshToken = refreshToken;
  return refreshToken;
};

module.exports = mongoose.model('User', userSchema);
