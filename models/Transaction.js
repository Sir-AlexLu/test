// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    index: true,
    default: function() {
      return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
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
    enum: ['deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'bonus', 'referral_bonus', 'reward', 'refund', 'admin_credit', 'admin_debit'],
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  balanceBefore: {
    type: Number,
    required: true
  },
  
  balanceAfter: {
    type: Number,
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'expired', 'rejected'],
    default: 'pending',
    index: true
  },
  
  paymentMethod: {
    type: String,
    enum: ['UPI', 'bank_transfer', 'crypto', 'wallet', 'bonus', 'admin'],
  },
  
  paymentDetails: {
    // For UPI
    upiId: String,
    upiName: String,
    upiNumber: String,
    
    // For Bank Transfer
    accountNumber: String,
    accountName: String,
    ifscCode: String,
    bankName: String,
    
    // For Crypto
    cryptoAddress: String,
    cryptoType: { type: String, enum: ['BTC', 'ETH', 'USDT', 'BNB'] },
    network: String,
    txHash: String,
    
    // Common
    referenceNumber: String,
    screenshot: String,
    qrCode: String
  },
  
  metadata: {
    ipAddress: String,
    deviceId: String,
    userAgent: String,
    location: {
      country: String,
      city: String
    },
    notes: String,
    adminNotes: String,
    rejectionReason: String,
    description: String
  },
  
  processing: {
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date
  },
  
  linkedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  betId: {
    type: String,
    index: true
  },
  
  expiresAt: Date
  
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, type: 1 });
transactionSchema.index({ 'paymentDetails.referenceNumber': 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
