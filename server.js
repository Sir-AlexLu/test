const express = require("express");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

let storedServerHash = null;

// Helper functions
function calculateSHA256_String(seed) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function calculateSHA256_HexBuffer(seed) {
  return crypto.createHash("sha256").update(Buffer.from(seed, "hex")).digest("hex");
}

// Commit endpoint (before game)
app.post("/commit", (req, res) => {
  const { serverHash } = req.body;
  storedServerHash = serverHash;
  res.json({ message: "✅ Server hash committed successfully", serverHash });
});

// Verify endpoint (after game)
app.post("/verify-result", (req, res) => {
  if (!storedServerHash) {
    return res.status(400).json({ error: "❌ No committed server hash found" });
  }

  const { serverSeed } = req.body;

  // Calculate both ways
  let calculatedString = null;
  let calculatedHexBuffer = null;

  try {
    calculatedString = calculateSHA256_String(serverSeed);
  } catch (e) {
    calculatedString = "⚠️ Error computing string hash";
  }

  try {
    calculatedHexBuffer = calculateSHA256_HexBuffer(serverSeed);
  } catch (e) {
    calculatedHexBuffer = "⚠️ Error computing hex-buffer hash";
  }

  // Check which one matches
  let verificationPassed = false;
  let matchedType = null;

  if (calculatedString === storedServerHash) {
    verificationPassed = true;
    matchedType = "string";
  } else if (calculatedHexBuffer === storedServerHash) {
    verificationPassed = true;
    matchedType = "hex-buffer";
  }

  // Build response
  const result = {
    verificationPassed,
    expectedHash: storedServerHash,
    calculatedHashString: calculatedString,
    calculatedHashHexBuffer: calculatedHexBuffer,
    matchedType: matchedType || "none",
    message: verificationPassed
      ? `✅ Verification Passed (Matched using ${matchedType} mode)`
      : "❌ Verification Failed - Server may have changed its seed or hash method mismatch",
  };

  res.json(result);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
