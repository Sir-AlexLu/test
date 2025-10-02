// models/Referral.js
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referralId: {
    type: String,
    unique: true,
    default: function() {
      return 'REFL' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
  },
  
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  referralCode: {
    type: String,
    required: true,
    index: true
  },
  
  level: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  
  commissions: [{
    amount: Number,
    percentage: Number,
    fromTransaction: String,
    fromUserId: mongoose.Schema.Types.ObjectId,
    type: { type: String, enum: ['deposit', 'bet', 'loss'] },
    status: { 
      type: String, 
      enum: ['pending', 'credited', 'cancelled'],
      default: 'pending'
    },
    creditedAt: Date,
    createdAt: { type: Date, default: Date.now }
  }],
  
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  
  pendingEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  
  referredUserStats: {
    totalDeposited: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    lastActiveDate: Date,
    accountStatus: String
  },
  
  milestones: [{
    amount: Number,
    bonus: Number,
    achievedAt: Date
  }],
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'blocked'],
    default: 'active'
  }
  
}, {
  timestamps: true
});

// Indexes
referralSchema.index({ referrer: 1, level: 1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ referralCode: 1 });

module.exports = mongoose.model('Referral', referralSchema);
