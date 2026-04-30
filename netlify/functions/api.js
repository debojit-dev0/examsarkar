// Netlify serverless function wrapper for Express backend
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');
const Razorpay = require('razorpay');
const serverless = require('serverless-http');

dotenv.config();

// Import Firebase (same as backend)
const { database } = require('../../backend/firebaseAdmin');

const app = express();

// CORS configuration
const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (
      configuredOrigins.includes(origin) ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".netlify.app")
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked for this origin."));
    }
  })
);

// Body parser
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Razorpay client
const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Email to key mapping
const toEmailKey = (email) =>
  Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");

// SHA256
const sha256 = (text) =>
  crypto.createHash("sha256").update(text || "").digest("hex");

// Token verification middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }
    const token = authHeader.substring(7);
    const tokenData = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    req.user = tokenData;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid token." });
  }
};

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is running on Netlify",
    timestamp: new Date().toISOString()
  });
});

// Payment config check
app.get('/api/payment/config', (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    return res.status(200).json({ configured: Boolean(razorpay) });
  } catch (err) {
    console.error('Config check error', err);
    return res.status(500).json({ configured: false });
  }
});

// Register endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword
    } = req.body || {};

    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password mismatch." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = toEmailKey(normalizedEmail);
    const emailRef = database.ref(`usersByEmail/${emailKey}`);
    const uid = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const userRecord = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash: sha256(password),
      createdAt
    };

    // Check if email exists
    const emailSnapshot = await emailRef.get();
    if (emailSnapshot.exists()) {
      return res.status(400).json({ message: "This email is already registered." });
    }

    // Write user data
    await database.ref(`users/${uid}`).set(userRecord);
    await emailRef.set(uid);

    // Return token
    const tokenData = {
      uid,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim()
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

    return res.status(201).json({
      message: "Registration successful.",
      user: { uid, firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail },
      token
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Registration failed." });
  }
});

// Login endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = toEmailKey(normalizedEmail);
    const uidSnapshot = await database.ref(`usersByEmail/${emailKey}`).get();

    if (!uidSnapshot.exists()) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const uid = uidSnapshot.val();
    const userSnapshot = await database.ref(`users/${uid}`).get();

    if (!userSnapshot.exists()) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = userSnapshot.val();

    if (user.passwordHash !== sha256(password)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const tokenData = {
      uid,
      email: normalizedEmail,
      firstName: user.firstName,
      lastName: user.lastName
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

    return res.status(200).json({
      message: "Login successful.",
      user: { uid, firstName: user.firstName, lastName: user.lastName, email: normalizedEmail },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed." });
  }
});

// Profile endpoint
app.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const snapshot = await database.ref(`users/${uid}`).get();

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = snapshot.val();
    return res.status(200).json({
      profile: {
        uid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ message: "Failed to fetch profile." });
  }
});

// Stats endpoint
app.get("/api/stats", (req, res) => {
  try {
    return res.status(200).json({
      stats: {
        testsCompleted: 12,
        averageScore: 78,
        streakDays: 5,
        totalTimeSpent: 450
      }
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ message: "Failed to fetch stats." });
  }
});

// Create order
app.post("/api/payment/create-order", verifyToken, async (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({ message: "Payment service is not configured yet." });
    }

    const { amount } = req.body || {};
    if (!amount || typeof amount !== "number") {
      return res.status(400).json({ message: "Amount (in paise) is required." });
    }

    const uid = req.user.uid;
    const shortUid = uid.replace(/-/g, '').slice(0, 12);
    const ts = String(Date.now()).slice(-6);
    const receipt = `rcpt_${shortUid}_${ts}`;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      payment_capture: 1
    });

    await database.ref(`payments/${order.id}`).set({
      uid,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: "created",
      createdAt: new Date().toISOString()
    });

    await database.ref(`userPayments/${uid}/${order.id}`).set({ status: "created", createdAt: new Date().toISOString() });

    return res.status(201).json({ message: "Order created", order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ message: "Failed to create order" });
  }
});

// Verify payment
app.post("/api/payment/verify", verifyToken, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details." });
    }

    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature." });
    }

    const paymentRef = database.ref(`payments/${razorpay_order_id}`);
    await paymentRef.update({ status: "paid", paymentId: razorpay_payment_id, paidAt: new Date().toISOString() });

    const p = await paymentRef.get();
    const uid = p.val()?.uid;
    if (uid) {
      await database.ref(`userPayments/${uid}/${razorpay_order_id}`).update({ status: "paid", paymentId: razorpay_payment_id, paidAt: new Date().toISOString() });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ message: "Verification failed." });
  }
});

// Payment status
app.get("/api/payment/status", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const snapshot = await database.ref(`userPayments/${uid}`).get();
    if (!snapshot.exists()) return res.status(200).json({ paid: false });

    const payments = snapshot.val();
    for (const [orderId, info] of Object.entries(payments)) {
      if (info.status === 'paid') {
        return res.status(200).json({ paid: true, orderId, info });
      }
    }

    return res.status(200).json({ paid: false });
  } catch (error) {
    console.error("Payment status error:", error);
    return res.status(500).json({ message: "Failed to check payment status." });
  }
});

// Webhook
app.post('/api/payment/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody || Buffer.from(JSON.stringify(req.body));

    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (signature !== expected) {
      console.warn('Invalid webhook signature');
      return res.status(400).send('invalid signature');
    }

    const event = req.body;
    if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
      const payload = event.payload?.payment?.entity;
      const orderId = payload?.order_id;
      const paymentId = payload?.id;
      if (orderId) {
        await database.ref(`payments/${orderId}`).update({ status: 'paid', paymentId, paidAt: new Date().toISOString() });
        const p = await database.ref(`payments/${orderId}`).get();
        const uid = p.val()?.uid;
        if (uid) await database.ref(`userPayments/${uid}/${orderId}`).update({ status: 'paid', paymentId, paidAt: new Date().toISOString() });
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).send('error');
  }
});

// Export for Netlify
module.exports.handler = serverless(app);
