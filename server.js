const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Fixed multipliers
const multipliers = [
  1.12, 1.28, 1.47, 1.70, 1.98, 2.33, 2.76, 3.32,
  4.03, 4.96, 6.20, 6.91, 8.90, 11.74, 15.99, 22.61,
  33.58, 53.20, 92.17, 182.51, 451.71, 1788.80
];

// In-memory commitments
const roundCommitments = {};

// Helpers
function calculateSHA256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
function calculateSHA256HexBuffer(input) {
  return crypto.createHash('sha256').update(Buffer.from(input, 'hex')).digest('hex');
}
function calculateSHA512(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
}
function calculateGameResult(serverSeed, clientSeed) {
  const combinedString = `${serverSeed}:${clientSeed}`;
  const sha512Hash = calculateSHA512(combinedString);
  const bigIntValue = BigInt('0x' + sha512Hash);
  const index = Number(bigIntValue % BigInt(multipliers.length));
  const multiplier = multipliers[index];
  return { finalMultiplier: multiplier, combinedSha512Hash: sha512Hash };
}

// Endpoint: Pre-game commit
app.post('/commit', (req, res) => {
  try {
    const { roundId, serverHash, clientSeed, betAmount } = req.body;
    if (!roundId || !serverHash || !clientSeed || betAmount === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const commitment = {
      roundId,
      serverHash,
      clientSeed,
      betAmount,
      timestamp: new Date().toISOString()
    };
    roundCommitments[roundId] = commitment;

    res.status(200).json({
      message: 'Commitment stored successfully',
      commitment
    });
  } catch (err) {
    console.error('Error in /commit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint: Verify result
app.post('/verify-result', (req, res) => {
  try {
    const { roundId, serverSeed, claimedResult } = req.body;
    if (!roundId || !serverSeed || !claimedResult) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!claimedResult.finalMultiplier || !claimedResult.combinedSha512Hash) {
      return res.status(400).json({ error: 'Invalid claimedResult structure.' });
    }

    const commitment = roundCommitments[roundId];
    if (!commitment) {
      return res.status(404).json({ error: `No commitment found for roundId: ${roundId}` });
    }

    // Try both string mode and hex buffer mode
    const hashAsString = calculateSHA256(serverSeed);
    const hashAsHexBuffer = calculateSHA256HexBuffer(serverSeed);

    let seedVerified = false;
    let usedHash = null;

    if (hashAsString === commitment.serverHash) {
      seedVerified = true;
      usedHash = 'string';
    } else if (hashAsHexBuffer === commitment.serverHash) {
      seedVerified = true;
      usedHash = 'hex-buffer';
    }

    if (!seedVerified) {
      return res.status(400).json({
        seedVerified: false,
        error: 'Server seed hash mismatch! The server may have cheated or encoding differs.',
        details: {
          expectedHash: commitment.serverHash,
          calculatedHashString: hashAsString,
          calculatedHashHexBuffer: hashAsHexBuffer
        }
      });
    }

    // If seed verified, check game result
    const calculatedResult = calculateGameResult(serverSeed, commitment.clientSeed);
    const isMultiplierMatch = calculatedResult.finalMultiplier === claimedResult.finalMultiplier;
    const isHashMatch = calculatedResult.combinedSha512Hash === claimedResult.combinedSha512Hash;
    const isResultAuthentic = isMultiplierMatch && isHashMatch;

    const response = {
      roundId,
      seedVerified: true,
      verificationMode: usedHash,
      isResultAuthentic,
      message: isResultAuthentic
        ? '✅ Verification successful. The game result is authentic and provably fair.'
        : '❌ Verification failed. The calculated result does not match the claimed result.',
      claimedResult,
      calculatedResult
    };

    if (!isResultAuthentic) {
      response.mismatchDetails = {
        multiplierMatch: isMultiplierMatch,
        hashMatch: isHashMatch
      };
    }

    res.status(isResultAuthentic ? 200 : 400).json(response);

  } catch (err) {
    console.error('Error in /verify-result:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeRounds: Object.keys(roundCommitments).length
  });
});

// Debug endpoint
app.get('/round/:roundId', (req, res) => {
  const { roundId } = req.params;
  const commitment = roundCommitments[roundId];
  if (!commitment) {
    return res.status(404).json({ error: `No commitment found for roundId: ${roundId}` });
  }
  res.status(200).json({ commitment });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Provably Fair Verifier Server running on port ${PORT}`);
});
