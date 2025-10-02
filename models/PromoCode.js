// models/PromoCode.js
const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    index: true
  },
  
  type: {
    type: String,
    enum: ['deposit_bonus', 'cashback', 'free_bet', 'no_deposit'],
    required: true
  },
  
  value: {
    type: Number,
    required: true
  },
  
  valueType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'fixed'
  },
  
  minDeposit: {
    type: Number,
    default: 0
  },
  
  maxBonus: {
    type: Number
  },
  
  wageringRequirement: {
    type: Number,
    default: 1
  },
  
  usageLimit: {
    total: Number,
    perUser: { type: Number, default: 1 }
  },
  
  usageCount: {
    type: Number,
    default: 0
  },
  
  usedBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    usedAt: Date,
    amount: Number
  }],
  
  validFrom: {
    type: Date,
    default: Date.now
  },
  
  validTill: Date,
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true
});

module.exports = mongoose.model('PromoCode', promoCodeSchema);
