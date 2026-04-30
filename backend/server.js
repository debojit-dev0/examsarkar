const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const Razorpay = require("razorpay");

dotenv.config();

const { database } = require("./firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const { protocol, hostname } = parsed;

    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (configuredOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin."));
    }
  })
);
// capture raw body for webhook verification
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
};

const toEmailKey = (email) =>
  Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");

const sha256 = (text) =>
  crypto.createHash("sha256").update(text || "").digest("hex");

// ✅ MIDDLEWARE: Verify Token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const tokenData = JSON.parse(Buffer.from(token, "base64").toString("utf8"));

    req.user = tokenData;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid token." });
  }
};

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

// Public endpoint to check if payment (Razorpay) is configured
app.get('/api/payment/config', (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    return res.status(200).json({ configured: Boolean(razorpay) });
  } catch (err) {
    console.error('Config check error', err);
    return res.status(500).json({ configured: false });
  }
});

// Create Razorpay order (authenticated)
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

    const uid = req.user.uid || '';
    // Razorpay receipt has a max length of 40. Build a short receipt id.
    const shortUid = uid.replace(/-/g, '').slice(0, 12);
    const ts = String(Date.now()).slice(-6);
    const receipt = `rcpt_${shortUid}_${ts}`;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      payment_capture: 1
    });

    // store order record
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

// Verify payment (client posts payment details after checkout)
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

    // mark payment as paid
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

// Check payment status for user
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

// Razorpay webhook endpoint
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

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword
    ) {
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
      confirmPasswordHash: sha256(confirmPassword),
      createdAt
    };

    const emailReservation = await emailRef.transaction((currentValue) => {
      if (currentValue === null) {
        return uid;
      }

      return;
    }, false);

    if (!emailReservation.committed) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    try {
      await database.ref(`users/${uid}`).set(userRecord);
    } catch (writeError) {
      await emailRef.remove().catch(() => {});
      throw writeError;
    }

    // ✅ CREATE TOKEN
    const tokenData = {
      uid,
      email: normalizedEmail,
      firstName: userRecord.firstName,
      lastName: userRecord.lastName
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

    return res.status(201).json({
      message: "Registration successful.",
      token,
      user: {
        uid,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        email: userRecord.email,
        phone: userRecord.phone,
        createdAt: userRecord.createdAt
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = toEmailKey(normalizedEmail);
    const emailSnapshot = await database.ref(`usersByEmail/${emailKey}`).get();

    if (!emailSnapshot.exists()) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const uid = emailSnapshot.val();
    const userSnapshot = await database.ref(`users/${uid}`).get();

    if (!userSnapshot.exists()) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = userSnapshot.val();
    if (user.passwordHash !== sha256(password)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // ✅ CREATE TOKEN
    const tokenData = {
      uid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        uid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
});

// ✅ NEW ENDPOINT: Get User Profile
app.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const userSnapshot = await database.ref(`users/${uid}`).get();

    if (!userSnapshot.exists()) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userSnapshot.val();

    return res.status(200).json({
      message: "Profile retrieved successfully.",
      profile: {
        uid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phone,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch profile." });
  }
});

// ✅ NEW ENDPOINT: Basic stats for dashboard
app.get("/api/stats", async (req, res) => {
  try {
    // Count total registered users
    const usersSnapshot = await database.ref(`users`).get();
    const totalRegistered = usersSnapshot.exists()
      ? Object.keys(usersSnapshot.val()).length
      : 0;

    // Heuristic/sample values for other stats (can be replaced with real collectors)
    const weeklyIncrease = Math.max(0, Math.floor(totalRegistered * 0.01));
    const liveNow = Math.max(0, Math.floor(totalRegistered * 0.02));
    const currentStreak = 7;
    const quizzesTotal = 25;
    const quizzesAttempted = Math.min(quizzesTotal, Math.floor(quizzesTotal * 0.48));
    const attemptPercentage = quizzesTotal > 0 ? Math.round((quizzesAttempted / quizzesTotal) * 100) : 0;

    return res.status(200).json({
      message: "Stats retrieved successfully.",
      stats: {
        totalRegistered,
        weeklyIncrease,
        liveNow,
        currentStreak,
        quizzesAttempted,
        quizzesTotal,
        attemptPercentage
      }
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch stats." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
