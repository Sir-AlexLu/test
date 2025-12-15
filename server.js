import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==================== MongoDB ====================
let db;
const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db("brevo-test");
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

// ==================== Brevo HTTP API (with debugging) ====================
async function sendBrevoEmail({ to, subject, htmlContent }) {
  console.log("📤 Attempting to send email...");
  console.log("   To:", to);
  console.log("   From:", process.env.SENDER_EMAIL);
  console.log("   Subject:", subject);

  const payload = {
    sender: {
      name: process.env.SENDER_NAME,
      email: process.env.SENDER_EMAIL
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent
  };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log("📨 Brevo Response Status:", response.status);
    console.log("📨 Brevo Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("❌ Brevo API Error:", data);
      throw new Error(data.message || `Brevo API error: ${response.status}`);
    }

    console.log("✅ Email sent! MessageId:", data.messageId);
    return data;

  } catch (error) {
    console.error("❌ Send email failed:", error.message);
    throw error;
  }
}

// ==================== OTP Generator ====================
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ==================== Email Templates ====================
const emailTemplate = (otp, type) => {
  const titles = {
    register: "Verify Your Account",
    reset: "Reset Your Password"
  };

  const messages = {
    register: "Complete your sBucks registration with this code:",
    reset: "Use this code to reset your password:"
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="400" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">sBucks</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 10px 0; color: #f1f5f9; font-size: 22px;">${titles[type]}</h2>
              <p style="margin: 0 0 30px 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">${messages[type]}</p>
              
              <!-- OTP Box -->
              <div style="background-color: #0f172a; border: 2px solid #334155; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #22c55e;">${otp}</span>
              </div>
              
              <!-- Timer -->
              <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                ⏱️ This code expires in <strong style="color: #f1f5f9;">10 minutes</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #475569; font-size: 12px; text-align: center;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ==================== DEBUG ROUTES ====================

// Health Check
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "sBucks Brevo Test",
    timestamp: new Date().toISOString() 
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Check Brevo Account & Senders
app.get("/check-brevo", async (req, res) => {
  try {
    console.log("🔍 Checking Brevo configuration...");
    
    // Check account
    const accountRes = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": process.env.BREVO_API_KEY }
    });
    const account = await accountRes.json();
    
    // Check senders
    const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": process.env.BREVO_API_KEY }
    });
    const senders = await sendersRes.json();
    
    // Check if configured sender is verified
    const configuredSender = process.env.SENDER_EMAIL;
    const senderList = senders.senders || [];
    const senderVerified = senderList.find(s => s.email === configuredSender);
    
    console.log("📧 Account:", account.email);
    console.log("📧 Configured Sender:", configuredSender);
    console.log("📧 Sender Verified:", senderVerified ? "YES ✅" : "NO ❌");
    
    res.json({
      success: accountRes.ok,
      account: {
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        plan: account.plan
      },
      senders: senderList.map(s => ({
        email: s.email,
        name: s.name,
        active: s.active
      })),
      config: {
        SENDER_EMAIL: configuredSender,
        SENDER_NAME: process.env.SENDER_NAME,
        senderIsVerified: !!senderVerified
      },
      warning: !senderVerified ? "⚠️ SENDER_EMAIL is not verified in Brevo!" : null
    });
    
  } catch (error) {
    console.error("❌ Check Brevo failed:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: "Check if BREVO_API_KEY is correct"
    });
  }
});

// Test Send Email
app.post("/test-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email required" });
  }

  try {
    const result = await sendBrevoEmail({
      to: email,
      subject: "sBucks Test Email ✅",
      htmlContent: `
        <div style="font-family: Arial; padding: 30px; background: #0f172a; color: #fff;">
          <h1 style="color: #22c55e;">Test Email Works! ✅</h1>
          <p>If you see this, Brevo is configured correctly.</p>
          <p style="color: #64748b;">Time: ${new Date().toISOString()}</p>
        </div>
      `
    });

    res.json({
      success: true,
      message: "Test email sent! Check your inbox.",
      brevoResponse: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      hint: "Check /check-brevo to verify your sender is configured"
    });
  }
});

// ==================== MAIN ROUTES ====================

// 1. REGISTER (Email + Password + Send OTP)
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("📝 Register attempt:", email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Check existing verified user
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const otp = generateOTP();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store pending registration
    await db.collection("pending_users").updateOne(
      { email },
      {
        $set: {
          email,
          password, // ⚠️ Hash in production!
          otp,
          otpId,
          expiresAt,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Send email via Brevo
    await sendBrevoEmail({
      to: email,
      subject: "Verify your sBucks account",
      htmlContent: emailTemplate(otp, "register")
    });

    console.log(`📧 Register OTP sent: ${email} | ${otp}`);

    res.json({
      success: true,
      message: "Verification code sent to your email",
      otpId
    });

  } catch (error) {
    console.error("❌ Register error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send verification email. Please try again." 
    });
  }
});

// 2. VERIFY REGISTRATION OTP
app.post("/verify-register", async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("🔐 Verify attempt:", email, "OTP:", otp);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const pending = await db.collection("pending_users").findOne({ email });

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: "No pending registration found"
      });
    }

    if (new Date() > pending.expiresAt) {
      await db.collection("pending_users").deleteOne({ email });
      return res.status(400).json({
        success: false,
        message: "Code expired. Please register again"
      });
    }

    if (pending.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code"
      });
    }

    // Create verified user
    await db.collection("users").insertOne({
      userId: uuidv4(),
      email: pending.email,
      password: pending.password,
      verified: true,
      createdAt: new Date()
    });

    // Cleanup
    await db.collection("pending_users").deleteOne({ email });

    console.log(`✅ User registered: ${email}`);

    res.json({
      success: true,
      message: "Account created successfully!"
    });

  } catch (error) {
    console.error("❌ Verify error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. FORGOT PASSWORD (Send OTP)
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("🔑 Forgot password:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No account found with this email"
      });
    }

    const otp = generateOTP();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection("password_resets").updateOne(
      { email },
      {
        $set: { email, otp, otpId, expiresAt, createdAt: new Date() }
      },
      { upsert: true }
    );

    await sendBrevoEmail({
      to: email,
      subject: "Reset your sBucks password",
      htmlContent: emailTemplate(otp, "reset")
    });

    console.log(`📧 Reset OTP sent: ${email} | ${otp}`);

    res.json({
      success: true,
      message: "Reset code sent to your email",
      otpId
    });

  } catch (error) {
    console.error("❌ Forgot password error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send reset email. Please try again." 
    });
  }
});

// 4. RESET PASSWORD (Verify + Update)
app.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log("🔐 Reset password attempt:", email);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const reset = await db.collection("password_resets").findOne({ email });

    if (!reset) {
      return res.status(400).json({
        success: false,
        message: "No reset request found"
      });
    }

    if (new Date() > reset.expiresAt) {
      await db.collection("password_resets").deleteOne({ email });
      return res.status(400).json({
        success: false,
        message: "Code expired. Please try again"
      });
    }

    if (reset.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset code"
      });
    }

    // Update password
    await db.collection("users").updateOne(
      { email },
      { $set: { password: newPassword, updatedAt: new Date() } }
    );

    // Cleanup
    await db.collection("password_resets").deleteOne({ email });

    console.log(`✅ Password reset: ${email}`);

    res.json({
      success: true,
      message: "Password updated successfully!"
    });

  } catch (error) {
    console.error("❌ Reset password error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== Start Server ====================
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running: http://localhost:${PORT}`);
    console.log(`📧 Sender: ${process.env.SENDER_EMAIL}`);
    console.log("");
    console.log("Debug endpoints:");
    console.log(`   GET  /check-brevo  - Verify Brevo config`);
    console.log(`   POST /test-email   - Send test email`);
  });
});
