const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Initialize Express application
const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Fixed array of multipliers used for all game calculations
const multipliers = [
  1.12, 1.28, 1.47, 1.70, 1.98, 2.33, 2.76, 3.32,
  4.03, 4.96, 6.20, 6.91, 8.90, 11.74, 15.99, 22.61,
  33.58, 53.20, 92.17, 182.51, 451.71, 1788.80
];

// In-memory storage for round commitments
// Key: roundId, Value: commitment object
const roundCommitments = {};

/**
 * Helper function to calculate SHA256 hash of a string
 * @param {string} input - The string to hash
 * @returns {string} - The hexadecimal hash string
 */
function calculateSHA256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Helper function to calculate SHA512 hash of a string
 * @param {string} input - The string to hash
 * @returns {string} - The hexadecimal hash string
 */
function calculateSHA512(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
}

/**
 * Helper function to calculate multiplier from seeds
 * @param {string} serverSeed - The server's seed
 * @param {string} clientSeed - The client's seed
 * @returns {object} - Object containing the multiplier and hash
 */
function calculateGameResult(serverSeed, clientSeed) {
  // Step 1: Combine the seeds with a colon separator
  const combinedString = `${serverSeed}:${clientSeed}`;
  
  // Step 2: Calculate SHA512 hash of the combined string
  const sha512Hash = calculateSHA512(combinedString);
  
  // Step 3: Convert the hash to a BigInt for precise calculation
  const bigIntValue = BigInt('0x' + sha512Hash);
  
  // Step 4: Use modulo to get an index for the multipliers array
  const index = Number(bigIntValue % BigInt(multipliers.length));
  
  // Step 5: Get the multiplier at the calculated index
  const multiplier = multipliers[index];
  
  return {
    finalMultiplier: multiplier,
    combinedSha512Hash: sha512Hash
  };
}

/**
 * Endpoint 1: Store pre-game commitment
 * This endpoint logs the initial game state before the game is played
 */
app.post('/commit', (req, res) => {
  try {
    const { roundId, serverHash, clientSeed, betAmount } = req.body;
    
    // Validate that all required fields are present
    if (!roundId || !serverHash || !clientSeed || betAmount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields. Please provide roundId, serverHash, clientSeed, and betAmount.'
      });
    }
    
    // Validate field types
    if (typeof roundId !== 'string' || typeof serverHash !== 'string' || 
        typeof clientSeed !== 'string' || typeof betAmount !== 'number') {
      return res.status(400).json({
        error: 'Invalid field types. roundId, serverHash, and clientSeed must be strings. betAmount must be a number.'
      });
    }
    
    // Store the commitment in memory
    const commitment = {
      roundId,
      serverHash,
      clientSeed,
      betAmount,
      timestamp: new Date().toISOString()
    };
    
    roundCommitments[roundId] = commitment;
    
    // Respond with confirmation
    res.status(200).json({
      message: 'Commitment stored successfully',
      commitment: commitment
    });
    
  } catch (error) {
    console.error('Error in /commit endpoint:', error);
    res.status(500).json({
      error: 'Internal server error while storing commitment'
    });
  }
});

/**
 * Endpoint 2: Verify game result after the game is played
 * This endpoint performs comprehensive verification of the game's fairness
 */
app.post('/verify-result', (req, res) => {
  try {
    const { roundId, serverSeed, claimedResult } = req.body;
    
    // Validate required fields
    if (!roundId || !serverSeed || !claimedResult) {
      return res.status(400).json({
        error: 'Missing required fields. Please provide roundId, serverSeed, and claimedResult.'
      });
    }
    
    // Validate claimedResult structure
    if (!claimedResult.finalMultiplier || !claimedResult.combinedSha512Hash) {
      return res.status(400).json({
        error: 'claimedResult must contain finalMultiplier and combinedSha512Hash.'
      });
    }
    
    // Step 1: Retrieve the original commitment data
    const commitment = roundCommitments[roundId];
    
    if (!commitment) {
      return res.status(404).json({
        error: `No commitment found for roundId: ${roundId}`
      });
    }
    
    // Step 2: Check 1 - Seed Integrity Verification
    // Calculate the hash of the revealed server seed
    const calculatedServerHash = calculateSHA256(serverSeed);
    
    // Compare with the stored server hash from the commitment
    if (calculatedServerHash !== commitment.serverHash) {
      // Server seed doesn't match - potential cheating detected
      return res.status(400).json({
        seedVerified: false,
        error: 'Server seed hash mismatch! The server may have cheated by changing its seed.',
        details: {
          expectedHash: commitment.serverHash,
          calculatedHash: calculatedServerHash
        }
      });
    }
    
    // Step 3: Check 2 - Result Authenticity Verification
    // Re-calculate the game outcome using the verified seeds
    const calculatedResult = calculateGameResult(serverSeed, commitment.clientSeed);
    
    // Step 4: Compare and Respond
    // Check if both the multiplier and hash match
    const isMultiplierMatch = calculatedResult.finalMultiplier === claimedResult.finalMultiplier;
    const isHashMatch = calculatedResult.combinedSha512Hash === claimedResult.combinedSha512Hash;
    const isResultAuthentic = isMultiplierMatch && isHashMatch;
    
    // Prepare the response
    const response = {
      roundId: roundId,
      seedVerified: true,
      isResultAuthentic: isResultAuthentic,
      message: isResultAuthentic 
        ? 'Verification successful. The game result is authentic and provably fair.'
        : 'Verification failed. The calculated result does not match the claimed result.',
      claimedResult: {
        finalMultiplier: claimedResult.finalMultiplier,
        combinedSha512Hash: claimedResult.combinedSha512Hash
      },
      calculatedResult: {
        finalMultiplier: calculatedResult.finalMultiplier,
        combinedSha512Hash: calculatedResult.combinedSha512Hash
      }
    };
    
    // Add mismatch details if verification failed
    if (!isResultAuthentic) {
      response.mismatchDetails = {
        multiplierMatch: isMultiplierMatch,
        hashMatch: isHashMatch
      };
    }
    
    // Send appropriate status code based on verification result
    res.status(isResultAuthentic ? 200 : 400).json(response);
    
  } catch (error) {
    console.error('Error in /verify-result endpoint:', error);
    res.status(500).json({
      error: 'Internal server error while verifying result'
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeRounds: Object.keys(roundCommitments).length
  });
});

/**
 * Get information about a specific round (for debugging)
 */
app.get('/round/:roundId', (req, res) => {
  const { roundId } = req.params;
  const commitment = roundCommitments[roundId];
  
  if (!commitment) {
    return res.status(404).json({
      error: `No commitment found for roundId: ${roundId}`
    });
  }
  
  res.status(200).json({
    commitment: commitment
  });
});

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`🚀 Provably Fair Verifier Server is running on port ${PORT}`);
  console.log(`📝 Available endpoints:`);
  console.log(`   - POST /commit - Store pre-game commitment`);
  console.log(`   - POST /verify-result - Verify game result`);
  console.log(`   - GET /health - Health check`);
  console.log(`   - GET /round/:roundId - Get round information`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});
