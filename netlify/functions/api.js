// Netlify serverless function wrapper for Express backend
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const serverless = require('serverless-http');
const { body, validationResult } = require('express-validator');

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
    const allowedHosts = new Set([
      "localhost",
      "127.0.0.1",
      "examsarkar.com",
      "www.examsarkar.com"
    ]);
    return (
      configuredOrigins.includes(origin) ||
      allowedHosts.has(parsed.hostname) ||
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

const ADMIN_TESTS_PATH = "adminTests";
const USER_PURCHASES_PATH = "userPurchases";

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
};

const normalizePlanPeriod = (value) => {
  const period = String(value || "").trim().toLowerCase();
  if (period === "daily" || period === "weekly" || period === "monthly") {
    return period;
  }
  return "daily";
};

const normalizePlanSubject = (value) => {
  const subject = String(value || "").trim().toLowerCase();

  if (subject === "gs" || subject === "ge") return "gs";
  if (subject === "csat") return "csat";
  if (subject === "combo" || subject === "both") return "combo";
  if (subject === "all" || subject === "any" || subject === "general") return "all";

  return subject || "all";
};

const buildPlanKey = (planPeriod, planSubject) => `${normalizePlanPeriod(planPeriod)}:${normalizePlanSubject(planSubject)}`;

const parsePlanKey = (planKey) => {
  const [planPeriod, planSubject] = String(planKey || "").split(":");
  return {
    planPeriod: normalizePlanPeriod(planPeriod),
    planSubject: normalizePlanSubject(planSubject)
  };
};

const getTestPeriod = (test) => normalizePlanPeriod(test?.type);
const getTestSubject = (test) => normalizePlanSubject(test?.subject || test?.planSubject || test?.segment || "all");

const getAllowedPeriods = (planPeriod) => {
  if (planPeriod === "monthly") return ["daily", "weekly", "monthly", "daily-quiz"];
  if (planPeriod === "weekly") return ["daily", "weekly", "daily-quiz"];
  return ["daily", "daily-quiz"];
};

const getAllowedSubjects = (planSubject) => {
  if (planSubject === "combo") return ["gs", "csat", "combo", "all"];
  if (planSubject === "all") return ["gs", "csat", "combo", "all"];
  return [planSubject, "all"];
};

const getPurchasePlan = (purchase) => {
  const fromKey = parsePlanKey(purchase?.planKey);
  return {
    planPeriod: fromKey.planPeriod,
    planSubject: fromKey.planSubject,
    planKey: buildPlanKey(fromKey.planPeriod, fromKey.planSubject),
    planName: purchase?.planName || `${fromKey.planPeriod[0].toUpperCase()}${fromKey.planPeriod.slice(1)} ${fromKey.planSubject.toUpperCase()}`
  };
};

const testMatchesPurchase = (test, purchase) => {
  if (!test || !purchase) return false;

  const testPeriod = getTestPeriod(test);
  const testSubject = getTestSubject(test);
  const allowedPeriods = getAllowedPeriods(purchase.planPeriod);
  const allowedSubjects = getAllowedSubjects(purchase.planSubject);

  if (test.access === "free") return true;
  if (!allowedPeriods.includes(testPeriod)) return false;
  if (testSubject === "all") return true;

  return allowedSubjects.includes(testSubject);
};

// Admin accounts helpers
const ADMIN_ACCOUNTS_PATH = "adminAccounts";
const getAdminEmailKey = (email) => toEmailKey(email);
const buildAdminSession = (adminRecord) => ({
  uid: adminRecord.uid,
  email: adminRecord.email,
  firstName: adminRecord.firstName || "",
  lastName: adminRecord.lastName || "",
  role: adminRecord.role || "content-admin"
});

const JWT_SECRET = process.env.JWT_SECRET || process.env.REACT_APP_JWT_SECRET || "dev-jwt-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.REACT_APP_JWT_REFRESH_SECRET || JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "15m";
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";

const generateTokens = (uid, email, firstName, lastName) => {
  const accessToken = jwt.sign(
    { uid, email, firstName, lastName, type: "access" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );

  const refreshToken = jwt.sign(
    { uid, email, type: "refresh" },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION }
  );

  return { accessToken, refreshToken };
};

// Token verification middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }
    const token = authHeader.substring(7);
    const tokenData = jwt.verify(token, JWT_SECRET);

    if (tokenData.type !== "access") {
      return res.status(401).json({ message: "Invalid token type." });
    }

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

app.get("/api/user/tests", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const [testsSnapshot, purchasesSnapshot] = await Promise.all([
      database.ref(ADMIN_TESTS_PATH).get(),
      database.ref(`${USER_PURCHASES_PATH}/${uid}`).get()
    ]);

    const tests = normalizeList(testsSnapshot.val());
    const purchases = normalizeList(purchasesSnapshot.val()).filter((purchase) => purchase.status === "paid");
    const purchasedPlans = purchases.map(getPurchasePlan).filter((purchase) => purchase.planKey);

    // Get today's date in YYYY-MM-DD format for filtering daily quizzes
    const today = new Date().toISOString().split("T")[0];

    const accessibleTests = tests.filter((test) => {
      // Check if test is accessible (free or purchased)
      const isAccessible = test.access === "free" || purchasedPlans.some((purchase) => testMatchesPurchase(test, purchase));
      if (!isAccessible) return false;

      // If it's a daily-quiz, only include if it's for today
      if (test.type === "daily-quiz") {
        const testDate = test.date ? test.date.split("T")[0] : null;
        return testDate === today;
      }

      return true;
    });

    const planSummaries = purchasedPlans.map((purchase) => {
      const seriesTests = accessibleTests.filter((test) => testMatchesPurchase(test, purchase));
      return {
        ...purchase,
        count: seriesTests.length,
        tests: seriesTests
      };
    });

    return res.status(200).json({
      purchasedPlans: planSummaries,
      accessibleTests
    });
  } catch (error) {
    console.error("User tests fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load tests" });
  }
});

app.get("/api/admin/tests", async (req, res) => {
  try {
    const snapshot = await database.ref(ADMIN_TESTS_PATH).get();
    return res.status(200).json({ tests: normalizeList(snapshot.val()) });
  } catch (error) {
    console.error("Load admin tests error:", error.message);
    return res.status(500).json({ message: "Failed to load tests" });
  }
});

app.put("/api/admin/tests", async (req, res) => {
  try {
    const tests = Array.isArray(req.body?.tests) ? req.body.tests : null;
    if (!tests || tests.length === 0) {
      return res.status(400).json({ message: "Invalid test data" });
    }

    for (const test of tests) {
      if (!test.id || !test.title) {
        return res.status(400).json({ message: "Each test must have id and title" });
      }
    }

    await database.ref(ADMIN_TESTS_PATH).set(tests);
    return res.status(200).json({ tests });
  } catch (error) {
    console.error("Save admin tests error:", error.message);
    return res.status(500).json({ message: "Failed to save tests" });
  }
});

// ============ ADMIN AUTH ENDPOINTS ============

app.post(
  "/api/admin/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const { email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const adminKey = getAdminEmailKey(normalizedEmail);

      const adminSnapshot = await database.ref(`${ADMIN_ACCOUNTS_PATH}/${adminKey}`).get();
      if (!adminSnapshot.exists()) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const adminRecord = adminSnapshot.val();
      if (!adminRecord?.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, adminRecord.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const session = buildAdminSession(adminRecord);

      return res.status(200).json({
        message: "Admin login successful",
        session
      });
    } catch (error) {
      console.error("Admin login error:", error.message);
      return res.status(500).json({ message: "Admin login failed" });
    }
  }
);

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
      passwordHash: await bcrypt.hash(password, 12),
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

    const { accessToken, refreshToken } = generateTokens(uid, normalizedEmail, firstName.trim(), lastName.trim());

    await database.ref(`userTokens/${uid}/refresh`).set({
      token: sha256(refreshToken),
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      message: "Registration successful.",
      user: { uid, firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail },
      accessToken,
      refreshToken,
      token: accessToken
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

    const bcryptMatches = await bcrypt.compare(password, user.passwordHash || "");
    const shaMatches = user.passwordHash === sha256(password);

    if (!bcryptMatches && !shaMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const { accessToken, refreshToken } = generateTokens(uid, normalizedEmail, user.firstName, user.lastName);

    await database.ref(`userTokens/${uid}/refresh`).set({
      token: sha256(refreshToken),
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({
      message: "Login successful.",
      user: { uid, firstName: user.firstName, lastName: user.lastName, email: normalizedEmail },
      accessToken,
      refreshToken,
      token: accessToken
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed." });
  }
});

// Refresh token
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required." });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid token type." });
    }

    const tokenSnapshot = await database.ref(`userTokens/${decoded.uid}/refresh`).get();
    if (!tokenSnapshot.exists() || tokenSnapshot.val()?.token !== sha256(refreshToken)) {
      return res.status(401).json({ message: "Token revoked or invalid." });
    }

    const userSnapshot = await database.ref(`users/${decoded.uid}`).get();
    if (!userSnapshot.exists()) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userSnapshot.val();
    const { accessToken } = generateTokens(decoded.uid, user.email, user.firstName, user.lastName);

    return res.status(200).json({ message: "Token refreshed.", accessToken });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(401).json({ message: "Invalid or expired refresh token." });
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
module.exports.app = app;
module.exports.handler = serverless(app);
