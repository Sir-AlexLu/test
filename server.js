const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper function to hash data with specified algorithm
function hashData(data, algorithm) {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

// Function to simulate game outcome based on seeds
function simulateGameOutcome(clientSeed, serverSeed, nonce = 0) {
  // Combine seeds and nonce
  const combinedSeed = `${clientSeed}:${serverSeed}:${nonce}`;
  
  // Generate SHA512 hash
  const sha512Hash = hashData(combinedSeed, 'sha512');
  
  // Convert to decimal (take first 8 characters of hash and convert to decimal)
  const hexSubstring = sha512Hash.substring(0, 8);
  const decimalValue = parseInt(hexSubstring, 16);
  
  // Calculate result (e.g., for a game with 100 possible outcomes)
  const result = decimalValue % 100;
  
  return {
    combinedSeed,
    sha512Hash,
    hexSubstring,
    decimalValue,
    result
  };
}

// API endpoint to verify game fairness
app.post('/verify', (req, res) => {
  try {
    const { clientSeed, serverSeed, serverHash, nonce = 0 } = req.body;
    
    if (!clientSeed || !serverSeed || !serverHash) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientSeed, serverSeed, serverHash' 
      });
    }
    
    // Verify server seed matches server hash
    const computedServerHash = hashData(serverSeed, 'sha256');
    const isHashValid = computedServerHash === serverHash;
    
    // Simulate game outcome
    const gameOutcome = simulateGameOutcome(clientSeed, serverSeed, nonce);
    
    // Return verification results
    res.json({
      isHashValid,
      serverHash: {
        provided: serverHash,
        computed: computedServerHash
      },
      gameOutcome,
      fair: isHashValid
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to generate a new server seed and hash (for testing)
app.get('/generate-seed', (req, res) => {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverHash = hashData(serverSeed, 'sha256');
  
  res.json({
    serverSeed,
    serverHash
  });
});

// API endpoint to simulate multiple game outcomes
app.post('/simulate-multiple', (req, res) => {
  try {
    const { clientSeed, serverSeed, count = 10 } = req.body;
    
    if (!clientSeed || !serverSeed) {
      return res.status(400).json({ 
        error: 'Missing required parameters: clientSeed, serverSeed' 
      });
    }
    
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(simulateGameOutcome(clientSeed, serverSeed, i));
    }
    
    res.json({
      clientSeed,
      serverSeed,
      results
    });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Fair Game Verifier API running on port ${PORT}`);
});
