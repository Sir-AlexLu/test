// models/Reward.js
const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  rewardId: {
    type: String,
    unique: true,
    default: function() {
      return 'RWD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: [
      'welcome_bonus',
      'daily_bonus',
      'weekly_bonus',
      'monthly_bonus',
      'streak_bonus',
      'level_up',
      'achievement',
      'special_event',
      'vip_reward',
      'cashback',
      'loss_back',
      'birthday_bonus',
      'referral_milestone'
    ],
    required: true
  },
  
  amount: {
    type: Number,
    min: 0
  },
  
  points: {
    type: Number,
    min: 0
  },
  
  wageringRequirement: {
    type: Number,
    default: 0,
    min: 0
  },
  
  wageringProgress: {
    type: Number,
    default: 0,
    min: 0
  },
  
  metadata: {
    title: String,
    description: String,
    streakDays: Number,
    achievementName: String,
    eventName: String,
    level: Number,
    vipTier: String,
    percentage: Number,
    maxAmount: Number,
    minDeposit: Number
  },
  
  conditions: {
    minBetAmount: Number,
    validGames: [String],
    expiryDays: Number,
    maxWinAmount: Number
  },
  
  status: {
    type: String,
    enum: ['pending', 'active', 'claimed', 'expired', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  claimedAt: Date,
  activatedAt: Date,
  completedAt: Date,
  expiresAt: Date,
  
  transactionId: String,
  
  usageHistory: [{
    amount: Number,
    betId: String,
    usedAt: Date
  }]
  
}, {
  timestamps: true
});

// Auto-expire rewards
rewardSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
rewardSchema.index({ userId: 1, status: 1 });
rewardSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Reward', rewardSchema);
