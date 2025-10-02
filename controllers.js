// controllers.js
const User = require('/models/User');
const Transaction = require('/models/Transaction');
const Bet = require('/models/Bet');
const Referral = require('/models/Referral');
const Reward = require('/models/Reward');
const PromoCode = require('/models/PromoCode');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== AUTH CONTROLLERS ====================
exports.register = async (req, res) => {
  try {
    const { email, phone, password, referralCode } = req.body;
    const { deviceInfo } = req;
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone'
      });
    }
    
    // Create user
    const userData = {
      email,
      phone,
      password,
      devices: [{
        deviceId: deviceInfo.deviceId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceName: 'Primary Device'
      }],
      ipAddresses: [{
        ip: deviceInfo.ipAddress
      }]
    };
    
    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ 'referral.myCode': referralCode });
      if (referrer) {
        userData.referral = {
          ...userData.referral,
          referredBy: {
            userId: referrer._id,
            code: referralCode,
            date: new Date()
          },
          referralChain: {
            levelA: referrer._id,
            levelB: referrer.referral?.referralChain?.levelA,
            levelC: referrer.referral?.referralChain?.levelB
          }
        };
      }
    }
    
    const user = await User.create(userData);
    
    // Update referrer stats
    if (referralCode && user.referral.referredBy) {
      await updateReferralChain(user);
    }
    
    // Give welcome bonus
    await createWelcomeBonus(user._id);
    
    // Generate tokens
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: user.userId,
        email: user.email,
        phone: user.phone,
        referralCode: user.referral.myCode,
        token,
        refreshToken
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const { deviceInfo } = req;
    
    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone }
      ]
    }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check account status
    if (user.status.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned',
        reason: user.status.banReason
      });
    }
    
    // Update device info
    const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceInfo.deviceId);
    if (deviceIndex === -1) {
      user.devices.push({
        deviceId: deviceInfo.deviceId,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceName: `Device ${user.devices.length + 1}`
      });
    } else {
      user.devices[deviceIndex].lastUsed = new Date();
      user.devices[deviceIndex].ipAddress = deviceInfo.ipAddress;
    }
    
    // Update IP info
    const ipIndex = user.ipAddresses.findIndex(ip => ip.ip === deviceInfo.ipAddress);
    if (ipIndex === -1) {
      user.ipAddresses.push({ ip: deviceInfo.ipAddress });
    } else {
      user.ipAddresses[ipIndex].lastSeen = new Date();
      user.ipAddresses[ipIndex].loginCount += 1;
    }
    
    // Update login streak
    await updateLoginStreak(user);
    
    // Update status
    user.status.isOnline = true;
    user.status.lastSeen = new Date();
    
    // Generate tokens
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();
    await user.save();
    
    // Remove password from output
    user.password = undefined;
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user.userId,
          email: user.email,
          phone: user.phone,
          wallet: user.wallet,
          referralCode: user.referral.myCode,
          rewards: {
            points: user.rewards.points,
            tier: user.rewards.tier,
            vipLevel: user.rewards.vipLevel
          }
        },
        token,
        refreshToken
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// ==================== WALLET CONTROLLERS ====================
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('wallet rewards.points rewards.tier');
    
    res.status(200).json({
      success: true,
      data: {
        wallet: user.wallet,
        rewards: {
          points: user.rewards.points,
          tier: user.rewards.tier
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet',
      error: error.message
    });
  }
};

exports.requestDeposit = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body;
    const userId = req.user._id;
    
    if (amount < process.env.MIN_DEPOSIT) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit amount is ₹${process.env.MIN_DEPOSIT}`
      });
    }
    
    const user = await User.findById(userId);
    
    const transaction = await Transaction.create({
      userId,
      type: 'deposit',
      amount,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance, // Will be updated when approved
      paymentMethod,
      paymentDetails,
      metadata: {
        ipAddress: req.deviceInfo.ipAddress,
        deviceId: req.deviceInfo.deviceId,
        userAgent: req.deviceInfo.userAgent
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully',
      data: {
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        status: transaction.status
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create deposit request',
      error: error.message
    });
  }
};

exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails, withdrawalPin } = req.body;
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    
    // Validations
    if (amount < process.env.MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${process.env.MIN_WITHDRAWAL}`
      });
    }
    
    if (amount > process.env.MAX_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is ₹${process.env.MAX_WITHDRAWAL}`
      });
    }
    
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Check withdrawal PIN if set
    if (user.settings.security.withdrawalPin) {
      const isPinValid = await bcrypt.compare(withdrawalPin, user.settings.security.withdrawalPin);
      if (!isPinValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid withdrawal PIN'
        });
      }
    }
    
    // Check for pending withdrawals
    const pendingWithdrawal = await Transaction.findOne({
      userId,
      type: 'withdrawal',
      status: { $in: ['pending', 'processing'] }
    });
    
    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request'
      });
    }
    
    // Create withdrawal request
    const transaction = await Transaction.create({
      userId,
      type: 'withdrawal',
      amount,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance - amount,
      paymentMethod,
      paymentDetails,
      metadata: {
        ipAddress: req.deviceInfo.ipAddress,
        deviceId: req.deviceInfo.deviceId,
        userAgent: req.deviceInfo.userAgent
      }
    });
    
    // Deduct balance immediately (will be refunded if rejected)
    user.wallet.balance -= amount;
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        status: transaction.status,
        estimatedTime: '24-48 hours'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: error.message
    });
  }
};

// ==================== BETTING CONTROLLERS ====================
exports.placeBet = async (req, res) => {
  try {
    const { gameType, betAmount, gameData } = req.body;
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    
    // Check balance
    if (user.wallet.balance < betAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Create bet transaction
    const transaction = await Transaction.create({
      userId,
      type: 'bet_placed',
      amount: betAmount,
      balanceBefore: user.wallet.balance,
      balanceAfter: user.wallet.balance - betAmount,
      status: 'completed',
      metadata: {
        gameType,
        ipAddress: req.deviceInfo.ipAddress,
        deviceId: req.deviceInfo.deviceId
      }
    });
    
    // Create bet record
    const bet = await Bet.create({
      transactionId: transaction.transactionId,
      userId,
      gameType,
      gameRoundId: gameData.roundId,
      betAmount,
      gameData,
      deviceInfo: {
        deviceId: req.deviceInfo.deviceId,
        ipAddress: req.deviceInfo.ipAddress,
        userAgent: req.deviceInfo.userAgent
      }
    });
    
    // Update user balance and stats
    user.wallet.balance -= betAmount;
    user.wallet.totalWagered += betAmount;
    user.stats.totalBets += 1;
    user.stats.gamesPlayed[gameType] = (user.stats.gamesPlayed[gameType] || 0) + 1;
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      data: {
        betId: bet.betId,
        transactionId: transaction.transactionId,
        balance: user.wallet.balance
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to place bet',
      error: error.message
    });
  }
};

exports.settleBet = async (req, res) => {
  try {
    const { betId, status, winAmount, multiplier, result } = req.body;
    
    const bet = await Bet.findOne({ betId });
    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }
    
    if (bet.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Bet already settled'
      });
    }
    
    const user = await User.findById(bet.userId);
    
    bet.status = status;
    bet.gameData.result = result;
    bet.settledAt = new Date();
    
    if (status === 'won') {
      bet.winAmount = winAmount;
      bet.multiplier = multiplier;
      bet.profit = winAmount - bet.betAmount;
      
      // Create win transaction
      const transaction = await Transaction.create({
        userId: bet.userId,
        type: 'bet_won',
        amount: winAmount,
        balanceBefore: user.wallet.balance,
        balanceAfter: user.wallet.balance + winAmount,
        status: 'completed',
        betId: bet.betId,
        metadata: {
          gameType: bet.gameType,
          multiplier,
          profit: bet.profit
        }
      });
      
      // Update user balance and stats
      user.wallet.balance += winAmount;
      user.wallet.winningBalance += winAmount;
      user.wallet.totalWon += winAmount;
      user.stats.totalWins += 1;
      
      if (winAmount > user.stats.biggestWin) {
        user.stats.biggestWin = winAmount;
      }
    } else {
      user.stats.totalLosses += 1;
      user.wallet.totalLost += bet.betAmount;
    }
    
    await bet.save();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Bet settled successfully',
      data: {
        betId: bet.betId,
        status: bet.status,
        winAmount: bet.winAmount,
        balance: user.wallet.balance
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to settle bet',
      error: error.message
    });
  }
};

// ==================== REFERRAL CONTROLLERS ====================
exports.getReferralInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('referral');
    
    const referrals = await Referral.find({ referrer: userId })
      .populate('referred', 'email createdAt wallet.totalDeposited')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      data: {
        myCode: user.referral.myCode,
        stats: user.referral.referralStats,
        referrals: referrals.map(ref => ({
          level: ref.level,
          user: ref.referred.email,
          joinedAt: ref.createdAt,
          totalDeposited: ref.referredUserStats.totalDeposited,
          totalEarned: ref.totalEarned,
          status: ref.status
        }))
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral info',
      error: error.message
    });
  }
};

// ==================== TRANSACTION CONTROLLERS ====================
exports.getTransactionHistory = async (req, res) => {
  try {
    const { type, status, limit = 50, skip = 0 } = req.query;
    const userId = req.user._id;
    
    const query = { userId };
    if (type) query.type = type;
    if (status) query.status = status;
    
    const transactions = await Transaction.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await Transaction.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        transactions,
        total,
        hasMore: total > skip + limit
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

// ==================== HELPER FUNCTIONS ====================
async function updateReferralChain(newUser) {
  try {
    // Update Level A (direct referrer)
    if (newUser.referral.referralChain.levelA) {
      await User.findByIdAndUpdate(newUser.referral.referralChain.levelA, {
        $inc: {
          'referral.referralStats.totalReferred': 1,
          'referral.referralStats.levelA_count': 1
        }
      });
      
      await Referral.create({
        referrer: newUser.referral.referralChain.levelA,
        referred: newUser._id,
        referralCode: newUser.referral.referredBy.code,
        level: 'A'
      });
    }
    
    // Update Level B
    if (newUser.referral.referralChain.levelB) {
      await User.findByIdAndUpdate(newUser.referral.referralChain.levelB, {
        $inc: { 'referral.referralStats.levelB_count': 1 }
      });
      
      await Referral.create({
        referrer: newUser.referral.referralChain.levelB,
        referred: newUser._id,
        referralCode: newUser.referral.referredBy.code,
        level: 'B'
      });
    }
    
    // Update Level C
    if (newUser.referral.referralChain.levelC) {
      await User.findByIdAndUpdate(newUser.referral.referralChain.levelC, {
        $inc: { 'referral.referralStats.levelC_count': 1 }
      });
      
      await Referral.create({
        referrer: newUser.referral.referralChain.levelC,
        referred: newUser._id,
        referralCode: newUser.referral.referredBy.code,
        level: 'C'
      });
    }
  } catch (error) {
    console.error('Error updating referral chain:', error);
  }
}

async function createWelcomeBonus(userId) {
  try {
    const bonusAmount = parseFloat(process.env.WELCOME_BONUS || 100);
    
    await Reward.create({
      userId,
      type: 'welcome_bonus',
      amount: bonusAmount,
      status: 'pending',
      metadata: {
        title: 'Welcome Bonus',
        description: 'Thank you for joining sBucks!'
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  } catch (error) {
    console.error('Error creating welcome bonus:', error);
  }
}

async function updateLoginStreak(user) {
  try {
    const lastLogin = user.rewards.streaks.lastLoginDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (lastLogin) {
      const lastLoginDate = new Date(lastLogin);
      lastLoginDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        user.rewards.streaks.loginStreak += 1;
      } else if (daysDiff > 1) {
        user.rewards.streaks.loginStreak = 1;
      }
    } else {
      user.rewards.streaks.loginStreak = 1;
    }
    
    user.rewards.streaks.lastLoginDate = new Date();
    
    if (user.rewards.streaks.loginStreak > user.rewards.streaks.maxLoginStreak) {
      user.rewards.streaks.maxLoginStreak = user.rewards.streaks.loginStreak;
    }
    
    // Give streak bonus every 7 days
    if (user.rewards.streaks.loginStreak % 7 === 0) {
      await Reward.create({
        userId: user._id,
        type: 'streak_bonus',
        amount: user.rewards.streaks.loginStreak * 10,
        status: 'pending',
        metadata: {
          title: `${user.rewards.streaks.loginStreak} Day Streak Bonus!`,
          streakDays: user.rewards.streaks.loginStreak
        }
      });
    }
  } catch (error) {
    console.error('Error updating login streak:', error);
  }
}

module.exports = exports;
