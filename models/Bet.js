// models/Bet.js
const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  betId: {
    type: String,
    unique: true,
    index: true,
    default: function() {
      return 'BET' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    }
  },
  
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  gameType: {
    type: String,
    enum: ['wingo', 'crash', 'dice', 'mines', 'plinko', 'wheel'],
    required: true,
    index: true
  },
  
  gameRoundId: {
    type: String,
    required: true,
    index: true
  },
  
  betAmount: {
    type: Number,
    required: true,
    min: 1
  },
  
  gameData: {
    // Wingo specific
    selectedColor: { type: String, enum: ['red', 'green', 'violet'] },
    selectedNumber: { type: Number, min: 0, max: 9 },
    selectedSize: { type: String, enum: ['big', 'small'] },
    
    // Crash specific
    cashoutMultiplier: Number,
    autoCashout: Boolean,
    autoCashoutAt: Number,
    crashedAt: Number,
    
    // Dice specific
    targetNumber: Number,
    rolledNumber: Number,
    betType: { type: String, enum: ['over', 'under', 'exact'] },
    
    // Mines specific
    minesCount: Number,
    selectedTiles: [Number],
    revealedTiles: [Number],
    mineLocations: [Number],
    
    // Generic
    prediction: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    seed: String,
    nonce: Number
  },
  
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'cancelled', 'refunded', 'cashout'],
    default: 'pending',
    index: true
  },
  
  winAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  multiplier: {
    type: Number,
    default: 0,
    min: 0
  },
  
  profit: {
    type: Number,
    default: 0
  },
  
  bonusUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  deviceInfo: {
    deviceId: String,
    ipAddress: String,
    userAgent: String
  },
  
  isAutobet: {
    type: Boolean,
    default: false
  },
  
  autobetConfig: {
    numberOfBets: Number,
    stopOnWin: Boolean,
    stopOnLoss: Boolean,
    increaseOnWin: Number,
    increaseOnLoss: Number
  },
  
  settledAt: Date,
  
  fairnessProof: {
    serverSeed: String,
    clientSeed: String,
    serverSeedHash: String
  }
  
}, {
  timestamps: true
});

// Indexes
betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ gameType: 1, status: 1 });
betSchema.index({ gameRoundId: 1 });
betSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Bet', betSchema);
