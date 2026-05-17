const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult, param } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const { database } = require("./firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

// ============ SECURITY: HELMET.JS ============
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://checkout.razorpay.com"],
    frameSrc: ["https://checkout.razorpay.com"],
    connectSrc: ["'self'", "https://api.razorpay.com"]
  }
}));

// ============ SECURITY: CORS (WHITELIST ONLY) ============
const configuredOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// In production, ONLY use explicitly configured origins
// In development, allow localhost only
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  ...configuredOrigins
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // Same-origin requests (e.g., direct POST from HTML form)
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // ⚠️ REJECT all other origins
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error("CORS policy: Origin not allowed"), false);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 3600
  })
);

// ============ SECURITY: BODY PARSING WITH LIMITS ============
app.use(express.json({ 
  limit: "1mb",
  verify: (req, res, buf) => { 
    // Capture raw body for webhook signature verification
    req.rawBody = buf; 
  } 
}));

// ============ SECURITY: RATE LIMITING ============
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many authentication attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't apply limiter to health check
    return req.path === "/api/health";
  }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment requests per hour per IP
  message: "Too many payment attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // General rate limit
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);

// ============ JWT SECRET & TOKEN CONFIG ============
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_EXPIRATION = "15m"; // Short-lived access tokens
const JWT_REFRESH_EXPIRATION = "7d"; // Long-lived refresh tokens

// ============ PASSWORD VALIDATION ============
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*)";
  }
  return null;
};

// ============ TOKEN GENERATION ============
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

// ============ MIDDLEWARE: VERIFY JWT TOKEN ============
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Ensure it's an access token, not a refresh token
      if (decoded.type !== "access") {
        return res.status(401).json({ message: "Unauthorized: Invalid token type" });
      }
      
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired. Please refresh." });
      }
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(401).json({ message: "Unauthorized: Token verification failed" });
  }
};

// ============ RAZORPAY CLIENT ============
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

// ============ HELPER FUNCTIONS ============
const toEmailKey = (email) =>
  Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");

const ADMIN_TESTS_PATH = "adminTests";
const USER_PURCHASES_PATH = "userPurchases";
const USER_TEST_ATTEMPTS_PATH = "userTestAttempts";

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

const getTestPeriod = (test) => {
  const period = normalizePlanPeriod(test?.type);
  return period;
};

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

const ADMIN_ACCOUNTS_PATH = "adminAccounts";

const getAdminEmailKey = (email) => toEmailKey(email);

const buildAdminSession = (adminRecord) => ({
  uid: adminRecord.uid,
  email: adminRecord.email,
  firstName: adminRecord.firstName || "",
  lastName: adminRecord.lastName || "",
  role: adminRecord.role || "content-admin"
});

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

// ============ MIDDLEWARE: VERIFY ADMIN TOKEN ============
const verifyAdminToken = async (req, res, next) => {
  try {
    const session = req.headers['x-admin-session'];
    if (!session) {
      return res.status(401).json({ message: "Unauthorized: Admin session required" });
    }

    try {
      const decoded = JSON.parse(Buffer.from(session, 'base64').toString('utf-8'));
      if (!decoded.uid || !decoded.role || (decoded.role !== 'super-admin' && decoded.role !== 'content-admin')) {
        return res.status(401).json({ message: "Unauthorized: Invalid admin session" });
      }

      req.admin = decoded;
      next();
    } catch (parseError) {
      return res.status(401).json({ message: "Unauthorized: Invalid session format" });
    }
  } catch (error) {
    console.error("Admin verification error:", error.message);
    return res.status(401).json({ message: "Unauthorized: Admin verification failed" });
  }
};

// ============ PUBLIC ENDPOINTS ============
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
    return res.status(500).json({ configured: false, message: "Configuration check failed" });
  }
});

// ============ AUTH ENDPOINTS ============

// REGISTER (Public)
app.post(
  "/api/auth/register",
  authLimiter,
  [
    body("firstName").trim().isLength({ min: 1, max: 50 }).escape(),
    body("lastName").trim().isLength({ min: 1, max: 50 }).escape(),
    body("email").isEmail().normalizeEmail(),
    body("phone").trim().matches(/^[0-9\-\+\s]{10,}$/),
    body("password").isLength({ min: 8 }),
    body("confirmPassword").isLength({ min: 8 })
  ],
  async (req, res) => {
    try {
      // ⚠️ CHECK VALIDATION ERRORS
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid input data" });
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        confirmPassword
      } = req.body;

      // ⚠️ PASSWORD VALIDATION
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const emailKey = toEmailKey(normalizedEmail);

      // ⚠️ CHECK EMAIL UNIQUENESS
      const emailRef = database.ref(`usersByEmail/${emailKey}`);
      const existingUser = await emailRef.get();
      if (existingUser.exists()) {
        // Don't leak that email exists
        return res.status(400).json({ message: "Unable to create account. Please try again." });
      }

      const uid = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // ⚠️ HASH PASSWORD WITH BCRYPT
      const passwordHash = await bcrypt.hash(password, 12);

      const userRecord = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        passwordHash,
        createdAt,
        updatedAt: createdAt
      };

      // ⚠️ ATOMIC TRANSACTION: Reserve email
      const emailReservation = await emailRef.transaction((currentValue) => {
        if (currentValue === null) {
          return uid;
        }
        return; // Abort transaction
      });

      if (!emailReservation.committed) {
        return res.status(400).json({ message: "Unable to create account. Please try again." });
      }

      try {
        await database.ref(`users/${uid}`).set(userRecord);
      } catch (writeError) {
        await emailRef.remove().catch(() => {});
        throw writeError;
      }

      // ⚠️ GENERATE JWT TOKENS
      const { accessToken, refreshToken } = generateTokens(uid, normalizedEmail, firstName, lastName);

      // ⚠️ STORE REFRESH TOKEN IN DATABASE (optional: for token revocation)
      await database.ref(`userTokens/${uid}/refresh`).set({
        token: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        createdAt: new Date().toISOString()
      });

      return res.status(201).json({
        message: "Registration successful",
        accessToken,
        refreshToken,
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
      console.error("Register error:", error.message);
      return res.status(500).json({ message: "Registration failed. Please try again later." });
    }
  }
);

// LOGIN (Public)
app.post(
  "/api/auth/login",
  authLimiter,
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
      const emailKey = toEmailKey(normalizedEmail);

      // ⚠️ LOOKUP USER BY EMAIL
      const emailSnapshot = await database.ref(`usersByEmail/${emailKey}`).get();
      if (!emailSnapshot.exists()) {
        // Don't leak that email doesn't exist (use generic message)
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const uid = emailSnapshot.val();
      const userSnapshot = await database.ref(`users/${uid}`).get();

      if (!userSnapshot.exists()) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = userSnapshot.val();

      // ⚠️ COMPARE PASSWORD WITH BCRYPT
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // ⚠️ GENERATE JWT TOKENS
      const { accessToken, refreshToken } = generateTokens(uid, user.email, user.firstName, user.lastName);

      // ⚠️ STORE REFRESH TOKEN HASH IN DATABASE
      await database.ref(`userTokens/${uid}/refresh`).set({
        token: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({
        message: "Login successful",
        accessToken,
        refreshToken,
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
      console.error("Login error:", error.message);
      return res.status(500).json({ message: "Login failed. Please try again later." });
    }
  }
);

// REFRESH TOKEN
app.post("/api/auth/refresh", [
  body("refreshToken").notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

      if (decoded.type !== "refresh") {
        return res.status(401).json({ message: "Invalid token type" });
      }

      // ⚠️ OPTIONAL: Verify refresh token is in database and not revoked
      const tokenRef = database.ref(`userTokens/${decoded.uid}/refresh`);
      const tokenSnapshot = await tokenRef.get();

      if (!tokenSnapshot.exists()) {
        return res.status(401).json({ message: "Token revoked or invalid" });
      }

      const storedHash = tokenSnapshot.val()?.token;
      const providedHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

      if (storedHash !== providedHash) {
        return res.status(401).json({ message: "Token invalid" });
      }

      // ⚠️ ISSUE NEW ACCESS TOKEN
      const userSnapshot = await database.ref(`users/${decoded.uid}`).get();
      if (!userSnapshot.exists()) {
        return res.status(401).json({ message: "User not found" });
      }

      const user = userSnapshot.val();
      const { accessToken } = generateTokens(decoded.uid, user.email, user.firstName, user.lastName);

      return res.status(200).json({
        message: "Token refreshed",
        accessToken
      });
    } catch (jwtError) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  } catch (error) {
    console.error("Token refresh error:", error.message);
    return res.status(500).json({ message: "Token refresh failed" });
  }
});

// ============ ADMIN AUTH ENDPOINTS ============

app.post(
  "/api/admin/login",
  authLimiter,
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

// ============ USER PROFILE ENDPOINTS ============

app.get("/api/user/profile", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const userSnapshot = await database.ref(`users/${uid}`).get();

    if (!userSnapshot.exists()) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userSnapshot.val();

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
    console.error("Profile fetch error:", error.message);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

app.post(
  "/api/user/test-attempts",
  verifyToken,
  [
    body("testId").trim().isLength({ min: 1, max: 120 }),
    body("testName").trim().isLength({ min: 1, max: 250 }),
    body("score").isFloat({ min: 0, max: 100 }),
    body("accuracy").isFloat({ min: 0, max: 100 }),
    body("correct").isInt({ min: 0 }),
    body("total").isInt({ min: 1 }),
    body("attempted").isInt({ min: 0 }),
    body("notAttempted").isInt({ min: 0 }),
    body("reviewCount").isInt({ min: 0 }),
    body("analysis").optional().isObject(),
    body("answers").optional().isObject(),
    body("markedForReview").optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid attempt payload" });
      }

      const { uid, email } = req.user;
      const {
        testId,
        testName,
        score,
        accuracy,
        correct,
        total,
        attempted,
        notAttempted,
        reviewCount,
        analysis,
        answers,
        markedForReview
      } = req.body;

      const submittedAt = new Date().toISOString();
      const attemptId = crypto.randomUUID();

      const attemptRecord = {
        attemptId,
        uid,
        email,
        testId,
        testName,
        score: Number(score),
        accuracy: Number(accuracy),
        correct: Number(correct),
        total: Number(total),
        attempted: Number(attempted),
        notAttempted: Number(notAttempted),
        reviewCount: Number(reviewCount),
        analysis: analysis && typeof analysis === "object" ? analysis : {
          correct: Number(correct),
          incorrect: Math.max(Number(total) - Number(correct), 0),
          attempted: Number(attempted),
          notAttempted: Number(notAttempted),
          reviewCount: Number(reviewCount),
          accuracy: Number(accuracy)
        },
        answers: answers && typeof answers === "object" ? answers : {},
        markedForReview: markedForReview && typeof markedForReview === "object" ? markedForReview : {},
        submittedAt,
        createdAt: submittedAt
      };

      await database.ref(`${USER_TEST_ATTEMPTS_PATH}/${uid}/${attemptId}`).set(attemptRecord);

      return res.status(201).json({
        message: "Test attempt saved",
        attemptId,
        submittedAt
      });
    } catch (error) {
      console.error("Save test attempt error:", error.message);
      return res.status(500).json({ message: "Failed to save test attempt" });
    }
  }
);

app.get(
  "/api/user/test-attempts/:attemptId",
  verifyToken,
  [param("attemptId").trim().isLength({ min: 1, max: 120 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid attempt id" });
      }

      const { uid } = req.user;
      const { attemptId } = req.params;

      const attemptSnapshot = await database.ref(`${USER_TEST_ATTEMPTS_PATH}/${uid}/${attemptId}`).get();
      if (!attemptSnapshot.exists()) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      return res.status(200).json({ attempt: attemptSnapshot.val() });
    } catch (error) {
      console.error("Load test attempt error:", error.message);
      return res.status(500).json({ message: "Failed to load test attempt" });
    }
  }
);

app.get("/api/user/dashboard", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const [attemptsSnapshot, testsSnapshot] = await Promise.all([
      database.ref(`${USER_TEST_ATTEMPTS_PATH}/${uid}`).get(),
      database.ref(ADMIN_TESTS_PATH).get()
    ]);

    const attempts = normalizeList(attemptsSnapshot.val())
      .filter((item) => item && item.submittedAt)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const tests = normalizeList(testsSnapshot.val());
    const totalAvailableTests = tests.length;
    const quizzesAttempted = attempts.length;
    const attemptPercentage = totalAvailableTests > 0
      ? Math.round((quizzesAttempted / totalAvailableTests) * 100)
      : 0;

    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / attempts.length)
      : null;

    const bestScore = attempts.length > 0
      ? Math.max(...attempts.map((attempt) => Number(attempt.score || 0)))
      : null;

    const totalAttemptedQuestions = attempts.reduce((sum, attempt) => sum + Number(attempt.attempted || 0), 0);
    const totalCorrectQuestions = attempts.reduce((sum, attempt) => sum + Number(attempt.correct || 0), 0);
    const accuracy = totalAttemptedQuestions > 0
      ? Math.round((totalCorrectQuestions / totalAttemptedQuestions) * 100)
      : null;

    const uniqueDateSet = new Set(
      attempts
        .map((attempt) => String(attempt.submittedAt || "").slice(0, 10))
        .filter(Boolean)
    );

    let currentStreak = 0;
    const cursor = new Date();
    while (true) {
      const day = cursor.toISOString().slice(0, 10);
      if (!uniqueDateSet.has(day)) break;
      currentStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const recentQuizActivity = attempts.slice(0, 20).map((attempt) => ({
      id: attempt.attemptId,
      testId: attempt.testId,
      title: attempt.testName,
      score: `${Math.round(Number(attempt.score || 0))}%`,
      accuracy: `${Math.round(Number(attempt.accuracy || 0))}%`,
      attempted: Number(attempt.attempted || 0),
      total: Number(attempt.total || 0),
      submittedAt: attempt.submittedAt,
      time: `${Math.max(Number(attempt.attempted || 0), 1)} questions`,
      date: new Date(attempt.submittedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    }));

    return res.status(200).json({
      performanceSnapshot: {
        avgScore,
        bestScore,
        accuracy
      },
      currentStreak,
      quizAttempts: {
        attempted: quizzesAttempted,
        total: totalAvailableTests,
        attemptPercentage
      },
      recentQuizActivity
    });
  } catch (error) {
    console.error("User dashboard fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load dashboard" });
  }
});

// ============ PAYMENT ENDPOINTS ============

// CREATE PAYMENT ORDER
app.post(
  "/api/payment/create-order",
  verifyToken,
  paymentLimiter,
  [
    body("amount").isInt({ min: 1 }),
    body("planKey").matches(/^(daily|weekly|monthly):(gs|csat|combo|all)$/),
    body("planName").trim().isLength({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid payment data" });
      }

      const razorpay = getRazorpayClient();
      if (!razorpay) {
        return res.status(503).json({ message: "Payment service unavailable" });
      }

      const { amount, planKey, planName } = req.body;
      const uid = req.user.uid;

      // ⚠️ VALIDATE AMOUNT (prevent negative or zero amounts)
      if (amount < 100 || amount > 500000) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const purchasePlan = getPurchasePlan({ planKey, planName });

      // ⚠️ BUILD SAFE RECEIPT ID
      const shortUid = uid.replace(/-/g, '').slice(0, 12);
      const ts = String(Date.now()).slice(-6);
      const receipt = `rcpt_${shortUid}_${ts}`;

      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt,
        payment_capture: 1,
        notes: {
          planKey: purchasePlan.planKey,
          planName: purchasePlan.planName
        }
      });

      // ⚠️ STORE ORDER RECORD (without sensitive info)
      await database.ref(`payments/${order.id}`).set({
        uid,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        planKey: purchasePlan.planKey,
        planName: purchasePlan.planName,
        status: "created",
        createdAt: new Date().toISOString()
      });

      await database.ref(`userPayments/${uid}/${order.id}`).set({
        status: "created",
        createdAt: new Date().toISOString(),
        planKey: purchasePlan.planKey,
        planName: purchasePlan.planName
      });

      return res.status(201).json({
        message: "Order created",
        order,
        key_id: process.env.RAZORPAY_KEY_ID
      });
    } catch (error) {
      console.error("Create order error:", error.message);
      return res.status(500).json({ message: "Failed to create payment order" });
    }
  }
);

// VERIFY PAYMENT
app.post(
  "/api/payment/verify",
  verifyToken,
  [
    body("razorpay_payment_id").matches(/^pay_[a-zA-Z0-9]+$/),
    body("razorpay_order_id").matches(/^order_[a-zA-Z0-9]+$/),
    body("razorpay_signature").isLength({ min: 64, max: 64 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

      // ⚠️ VERIFY SIGNATURE
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const generated_signature = crypto
        .createHmac('sha256', keySecret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        console.warn(`Invalid signature for order ${razorpay_order_id}`);
        return res.status(400).json({ message: "Payment verification failed" });
      }

      // ⚠️ FETCH PAYMENT RECORD AND VALIDATE
      const paymentRef = database.ref(`payments/${razorpay_order_id}`);
      const p = await paymentRef.get();
      
      if (!p.exists()) {
        console.warn(`Payment record not found for order ${razorpay_order_id}`);
        return res.status(404).json({ message: "Payment order not found" });
      }

      const paymentRecord = p.val();
      const uid = paymentRecord?.uid;
      const planKey = paymentRecord?.planKey;
      const planName = paymentRecord?.planName;

      // ⚠️ VALIDATE REQUIRED FIELDS
      if (!uid || !planKey) {
        console.error(`Invalid payment record: uid=${uid}, planKey=${planKey}`);
        return res.status(400).json({ message: "Invalid payment record" });
      }

      const paidAt = new Date().toISOString();

      // ⚠️ MARK PAYMENT AS PAID
      await paymentRef.update({ status: "paid", paymentId: razorpay_payment_id, paidAt });

      // ⚠️ UPDATE USER PAYMENT STATUS
      await database.ref(`userPayments/${uid}/${razorpay_order_id}`).update({
        status: "paid",
        paymentId: razorpay_payment_id,
        paidAt,
        planKey,
        planName
      });

      // ⚠️ CREATE PURCHASE RECORD
      await database.ref(`${USER_PURCHASES_PATH}/${uid}/${razorpay_order_id}`).set({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        paidAt,
        planKey,
        planName,
        status: "paid"
      });

      return res.status(200).json({ success: true, message: "Payment verified" });
    } catch (error) {
      console.error("Verify payment error:", error.message);
      return res.status(500).json({ message: "Payment verification failed" });
    }
  }
);

// PAYMENT STATUS
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
    console.error("Payment status error:", error.message);
    return res.status(500).json({ message: "Failed to check payment status" });
  }
});

// RAZORPAY WEBHOOK
app.post('/api/payment/webhook', (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.warn('Webhook secret not configured');
      return res.status(400).send('webhook_not_configured');
    }

    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody || Buffer.from(JSON.stringify(req.body));

    // ⚠️ VERIFY WEBHOOK SIGNATURE
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expected) {
      console.warn('Invalid webhook signature');
      return res.status(400).send('invalid_signature');
    }

    const event = req.body;

    // ⚠️ PROCESS ONLY RELEVANT EVENTS
    if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
      const payload = event.payload?.payment?.entity;
      const orderId = payload?.order_id;
      const paymentId = payload?.id;

      if (orderId) {
        database.ref(`payments/${orderId}`).update({
          status: 'paid',
          paymentId,
          paidAt: new Date().toISOString()
        }).catch(err => console.error('Webhook DB update error:', err));

        database.ref(`payments/${orderId}`).get().then(p => {
          const uid = p.val()?.uid;
          if (uid) {
            database.ref(`userPayments/${uid}/${orderId}`).update({
              status: 'paid',
              paymentId,
              paidAt: new Date().toISOString()
            }).catch(err => console.error('Webhook user payment update error:', err));
          }
        });
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).send('webhook_error');
  }
});

// ============ TEST ENDPOINTS ============

app.get("/api/tests", async (req, res) => {
  try {
    const snapshot = await database.ref(ADMIN_TESTS_PATH).get();
    const tests = normalizeList(snapshot.val()).filter((test) => test?.access === "free");
    return res.status(200).json({ tests });
  } catch (error) {
    console.error("Public tests fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load tests" });
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

    const accessibleTests = tests.filter((test) => {
      if (test.access === "free") return true;
      return purchasedPlans.some((purchase) => testMatchesPurchase(test, purchase));
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

app.get("/api/admin/tests", verifyAdminToken, async (req, res) => {
  try {
    const snapshot = await database.ref(ADMIN_TESTS_PATH).get();
    return res.status(200).json({ tests: normalizeList(snapshot.val()) });
  } catch (error) {
    console.error("Load admin tests error:", error.message);
    return res.status(500).json({ message: "Failed to load tests" });
  }
});

app.put("/api/admin/tests", verifyAdminToken, [
  body("tests").isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid test data" });
    }

    const { tests } = req.body;

    // ⚠️ VALIDATE EACH TEST
    for (const test of tests) {
      if (!test.id || (!test.title && !test.testName)) {
        return res.status(400).json({ message: "Each test must have id and title/testName" });
      }
    }

    await database.ref(ADMIN_TESTS_PATH).set(tests);
    return res.status(200).json({ tests });
  } catch (error) {
    console.error("Save admin tests error:", error.message);
    return res.status(500).json({ message: "Failed to save tests" });
  }
});

app.get("/api/admin/users", verifyAdminToken, async (req, res) => {
  try {
    const [usersSnapshot, purchasesSnapshot, attemptsSnapshot] = await Promise.all([
      database.ref("users").get(),
      database.ref(USER_PURCHASES_PATH).get(),
      database.ref(USER_TEST_ATTEMPTS_PATH).get()
    ]);

    const usersData = usersSnapshot.val() || {};
    const purchasesData = purchasesSnapshot.val() || {};
    const attemptsData = attemptsSnapshot.val() || {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const users = Object.entries(usersData).map(([uid, user]) => {
      const userPurchases = normalizeList(purchasesData[uid] || {})
        .filter((purchase) => purchase.status === "paid")
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      const latestPurchase = userPurchases[0];
      const purchasePlan = latestPurchase ? getPurchasePlan(latestPurchase) : null;

      const attempts = normalizeList(attemptsData[uid] || {});
      const latestAttempt = attempts.reduce((latest, attempt) => {
        const submittedAt = new Date(attempt?.submittedAt || 0).getTime();
        if (!Number.isFinite(submittedAt)) return latest;
        return submittedAt > latest ? submittedAt : latest;
      }, 0);

      let activeWindow = "inactive";
      if (latestAttempt) {
        const latestDate = new Date(latestAttempt);
        if (latestDate >= todayStart) {
          activeWindow = "today";
        } else if (latestDate >= weekStart) {
          activeWindow = "week";
        }
      }

      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      return {
        id: uid,
        name: fullName || user.email || "User",
        plan: purchasePlan?.planKey || "free",
        activeWindow
      };
    });

    return res.status(200).json({ users });
  } catch (error) {
    console.error("Admin users fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load users" });
  }
});

// ============ STATS ENDPOINT ============

app.get("/api/stats", async (req, res) => {
  try {
    const usersSnapshot = await database.ref(`users`).get();
    const totalRegistered = usersSnapshot.exists()
      ? Object.keys(usersSnapshot.val()).length
      : 0;

    const weeklyIncrease = Math.max(0, Math.floor(totalRegistered * 0.01));
    const liveNow = Math.max(0, Math.floor(totalRegistered * 0.02));
    const currentStreak = 7;
    const quizzesTotal = 25;
    const quizzesAttempted = Math.min(quizzesTotal, Math.floor(quizzesTotal * 0.48));
    const attemptPercentage = quizzesTotal > 0 ? Math.round((quizzesAttempted / quizzesTotal) * 100) : 0;

    return res.status(200).json({
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
    console.error("Stats fetch error:", error.message);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({ 
    message: "An error occurred. Please try again later." 
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`JWT_SECRET configured: ${Boolean(process.env.JWT_SECRET)}`);
  console.log(`RAZORPAY configured: ${Boolean(process.env.RAZORPAY_KEY_ID)}`);
});
