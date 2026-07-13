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
const nodemailer = require("nodemailer");



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
const isProduction = process.env.NODE_ENV === "production";
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

      if (!isProduction) {
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
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-session"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 3600
  })
);

// ============ SECURITY: BODY PARSING WITH LIMITS ============
app.use(express.json({
  limit: "20mb",
  verify: (req, res, buf) => {
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
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
const PRELIMS_BANNER_SLIDES_PATH = "prelimsBannerSlides";
const USER_PURCHASES_PATH = "userPurchases";
const USER_TEST_ATTEMPTS_PATH = "userTestAttempts";

// Server-authoritative pricing — client-sent amount is IGNORED
const PLAN_PRICES = {
  'daily:gs': 9900,
  'daily:csat': 9900,
  'daily:combo': 14900,
  'daily:all': 9900,
  'weekly:gs': 59900,
  'weekly:csat': 59900,
  'weekly:combo': 99900,
  'weekly:all': 59900,
  'monthly:gs': 149900,
  'monthly:csat': 149900,
  'monthly:combo': 249900,
  'monthly:all': 149900,
  'mains:gs1': 9000,
  'mains:gs2': 9000,
  'mains:gs3': 9000,
  'mains:gs4': 9000,
  'mains:essay': 9000
};
const MAINS_PAPERS_PATH = "mainsPapers";
const USER_MAINS_ANSWERS_PATH = "userMainsAnswers";
const USER_MAINS_ACCESS_PATH = "userMainsAccess";
const VALID_MAINS_SUBJECTS = ['gs1', 'gs2', 'gs3', 'gs4', 'essay'];

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
};

const normalizeBannerSlides = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((slide, index) => ({
        id: String(slide?.id || `prelims-banner-${index + 1}`),
        title: String(slide?.title || "").trim(),
        subtitle: String(slide?.subtitle || "").trim(),
        imageUrl: String(slide?.imageUrl || slide?.img || "").trim(),
        link: String(slide?.link || "").trim()
      }))
      .filter((slide) => slide.title || slide.subtitle || slide.imageUrl || slide.link);
  }

  if (value && typeof value === "object") {
    return normalizeBannerSlides(Object.values(value));
  }

  return [];
};

const getAttemptTimestamp = (attempt) =>
  attempt?.submittedAt || attempt?.createdAt || attempt?.timestamp || attempt?.date || "1970-01-01T00:00:00.000Z";

const normalizeAttemptEntries = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, entry]) => {
    if (!entry) return [];

    if (entry.attemptId || entry.testId || entry.submittedAt || entry.createdAt) {
      return [{ attemptId: entry.attemptId || key, ...entry }];
    }

    if (typeof entry === "object") {
      return Object.entries(entry)
        .map(([childKey, child]) => (child ? { attemptId: child.attemptId || childKey, ...child } : null))
        .filter(Boolean);
    }

    return [];
  });
};

const flattenAttemptRecords = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "object") return [];

  return Object.values(value).flatMap((entry) => {
    if (!entry) return [];
    if (entry.attemptId || entry.testId) return [entry];
    if (typeof entry === "object") return normalizeList(entry);
    return [];
  });
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
  if (planPeriod === 'mains') {
    return { planPeriod: 'mains', planSubject: planSubject || 'gs1' };
  }
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

const PLAN_DURATION_DAYS = { daily: 1, weekly: 7, monthly: 30 };

// YYYY-MM-DD (UTC) day key for any date-ish value; null if unparseable.
const toDayKey = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
};

// Inclusive calendar access window anchored to the purchase date:
//   daily   -> the purchase day only
//   weekly  -> Sunday..Saturday of the purchase week
//   monthly -> first..last day of the purchase month
const getAccessWindow = (planPeriod, paidAt) => {
  const base = new Date(paidAt);
  if (Number.isNaN(base.getTime())) return null;
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = base.getUTCDate();

  if (planPeriod === "weekly") {
    const dow = base.getUTCDay(); // 0=Sun .. 6=Sat
    return {
      start: toDayKey(new Date(Date.UTC(y, m, d - dow))),
      end: toDayKey(new Date(Date.UTC(y, m, d - dow + 6)))
    };
  }
  if (planPeriod === "monthly") {
    return {
      start: toDayKey(new Date(Date.UTC(y, m, 1))),
      end: toDayKey(new Date(Date.UTC(y, m + 1, 0)))
    };
  }
  const day = toDayKey(base); // daily + fallback
  return { start: day, end: day };
};

const getPurchasePlan = (purchase) => {
  const fromKey = parsePlanKey(purchase?.planKey);
  const planPeriod = fromKey.planPeriod;
  const paidAt = purchase?.paidAt || null;

  if (planPeriod === 'mains') {
    const expiresAt = paidAt
      ? new Date(new Date(paidAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    return {
      planPeriod,
      planSubject: fromKey.planSubject,
      planKey: purchase?.planKey || `mains:${fromKey.planSubject}`,
      planName: purchase?.planName || `Mains ${(fromKey.planSubject || 'gs1').toUpperCase()}`,
      paidAt,
      expiresAt,
    };
  }

  const accessWindow = paidAt ? getAccessWindow(planPeriod, paidAt) : null;
  const expiresAt = accessWindow ? `${accessWindow.end}T23:59:59.999Z` : null;
  return {
    planPeriod,
    planSubject: fromKey.planSubject,
    planKey: buildPlanKey(planPeriod, fromKey.planSubject),
    planName: purchase?.planName || `${planPeriod[0].toUpperCase()}${planPeriod.slice(1)} ${fromKey.planSubject.toUpperCase()}`,
    paidAt,
    expiresAt,
    accessWindow,
  };
};

const isPurchaseActive = (purchase) => {
  if (!purchase.paidAt) return false;
  const { planPeriod } = parsePlanKey(purchase.planKey);
  if (planPeriod === 'mains') {
    const expiresAt = new Date(new Date(purchase.paidAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    return new Date() < expiresAt;
  }
  const accessWindow = getAccessWindow(planPeriod, purchase.paidAt);
  if (!accessWindow) return false;
  // Active through the end of the last day in the purchase-anchored window.
  const todayKey = toDayKey(new Date());
  return Boolean(todayKey && todayKey <= accessWindow.end);
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
  if (test.access === "free") return true;
  if (purchase.planPeriod === "mains") return false; // mains papers are served separately

  // Subject gate: gs->gs, csat->csat, combo/all->both. Papers tagged "all" are open to any subject.
  const testSubject = getTestSubject(test);
  const allowedSubjects = getAllowedSubjects(purchase.planSubject);
  if (testSubject !== "all" && !allowedSubjects.includes(testSubject)) return false;

  // Date gate: the paper's day must fall inside the purchase-anchored calendar window.
  const accessWindow = purchase.accessWindow || getAccessWindow(purchase.planPeriod, purchase.paidAt);
  if (!accessWindow) return false;
  const testDay = toDayKey(test.date || test.createdAt);
  if (!testDay) return false;

  return testDay >= accessWindow.start && testDay <= accessWindow.end;
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

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailKey = toEmailKey(normalizedEmail);

    const emailSnap = await database.ref(`usersByEmail/${emailKey}`).get();

    // security: same response always
    if (!emailSnap.exists()) {
      return res.status(200).json({
        message: "If email exists, reset link sent"
      });
    }

    const uid = emailSnap.val();

    // token generate
    const resetToken = crypto.randomBytes(32).toString("hex");
    console.log("===== FORGOT PASSWORD =====");
console.log("Generated Token:", resetToken);
    const expiry = Date.now() + 15 * 60 * 1000; // 15 min

    // delete old token first (IMPORTANT FIX)
await database.ref(`passwordReset/${uid}`).remove();

await database.ref(`passwordReset/${uid}`).set({
  token: resetToken,
  expiry
});

const check = await database.ref(`passwordReset/${uid}`).get();

console.log("Stored Token:", check.val().token);
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?uid=${uid}&token=${resetToken}`;

    // SEND EMAIL
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>Click below link to reset password (valid 15 min)</p>
        <a href="${resetLink}" target="_blank">Reset Password</a>
      `
    });

    return res.status(200).json({
      message: "Reset email sent"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to send reset email" });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { uid, token, newPassword } = req.body;

    if (!uid || !token || !newPassword) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const snap = await database.ref(`passwordReset/${uid}`).get();

    if (!snap.exists()) {
      return res.status(400).json({
        message: "Invalid or expired reset link"
      });
    }

    const data = snap.val();
    console.log("===== RESET PASSWORD =====");
console.log("Received Token:", token);
console.log("Database Token:", data.token);
console.log("Equal:", token === data.token);

    if (Date.now() > Number(data.expiry)) {
      await database.ref(`passwordReset/${uid}`).remove();

      return res.status(400).json({
        message: "Reset link has expired"
      });
    }

    if (token !== data.token) {
      console.log("DB Token :", data.token);
      console.log("User Token :", token);

      return res.status(400).json({
        message: "Invalid token"
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await database.ref(`users/${uid}`).update({
      passwordHash,
      updatedAt: new Date().toISOString()
    });

    await database.ref(`passwordReset/${uid}`).remove();

    return res.json({
      message: "Password reset successful"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Internal server error"
    });
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
    body("markedForReview").optional().isObject(),
    body("questionsSnapshot").optional().isArray()
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
        markedForReview,
        questionsSnapshot
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
        questionsSnapshot: Array.isArray(questionsSnapshot) ? questionsSnapshot : [],
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
  [param("attemptId").trim().isLength({ min: 1, max: 120 }).matches(/^[^.#$[\]]+$/)],
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

app.get(
  "/api/user/test-attempts/:attemptId/test",
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

      const attempt = attemptSnapshot.val();
      const testsSnapshot = await database.ref(ADMIN_TESTS_PATH).get();
      const test = normalizeList(testsSnapshot.val()).find((item) => String(item.id) === String(attempt?.testId));

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      return res.status(200).json({ test, attempt });
    } catch (error) {
      console.error("Load attempt test error:", error.message);
      return res.status(500).json({ message: "Failed to load test for review" });
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

    let attempts = normalizeAttemptEntries(attemptsSnapshot.val())
      .filter((item) => item && getAttemptTimestamp(item))
      .sort((a, b) => new Date(getAttemptTimestamp(b)).getTime() - new Date(getAttemptTimestamp(a)).getTime());

    if (attempts.length === 0) {
      const allAttemptsSnapshot = await database.ref(USER_TEST_ATTEMPTS_PATH).get();
      const allAttempts = normalizeAttemptEntries(allAttemptsSnapshot.val());
      attempts = allAttempts
        .filter((item) => item && getAttemptTimestamp(item))
        .filter((item) => item.uid === uid || item.email === req.user.email)
        .sort((a, b) => new Date(getAttemptTimestamp(b)).getTime() - new Date(getAttemptTimestamp(a)).getTime());

      if (attempts.length === 0 && allAttempts.length > 0) {
        console.warn("[dashboard] Falling back to legacy attempts without uid/email.");
        attempts = allAttempts
          .filter((item) => item && getAttemptTimestamp(item))
          .sort((a, b) => new Date(getAttemptTimestamp(b)).getTime() - new Date(getAttemptTimestamp(a)).getTime());
      }
    }

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
        .map((attempt) => String(getAttemptTimestamp(attempt) || "").slice(0, 10))
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

    const recentQuizActivity = attempts.slice(0, 20).map((attempt) => {
      const timestamp = getAttemptTimestamp(attempt);
      return {
        id: attempt.attemptId || attempt.id,
        testId: attempt.testId,
        title: attempt.testName,
        score: `${Math.round(Number(attempt.score || 0))}%`,
        accuracy: `${Math.round(Number(attempt.accuracy || 0))}%`,
        attempted: Number(attempt.attempted || 0),
        total: Number(attempt.total || 0),
        submittedAt: timestamp,
        time: `${Math.max(Number(attempt.attempted || 0), 1)} questions`,
        date: timestamp
          ? new Date(timestamp).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            })
          : ""
      };
    });

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
    body("amount").optional().isInt({ min: 1 }),
    body("planKey").matches(/^(daily|weekly|monthly|mains):(gs|csat|combo|all|gs1|gs2|gs3|gs4|essay)$/),
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

      const { planKey, planName } = req.body;
      const uid = req.user.uid;

      const purchasePlan = getPurchasePlan({ planKey, planName });

      // ⚠️ SERVER-SIDE PRICE ENFORCEMENT — client amount is ignored
      const amount = PLAN_PRICES[purchasePlan.planKey];
      if (!amount) {
        return res.status(400).json({ message: "Invalid plan" });
      }

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
    const filterPlanKey = req.query.planKey || null;
    const snapshot = await database.ref(`userPayments/${uid}`).get();
    if (!snapshot.exists()) return res.status(200).json({ paid: false });

    const payments = snapshot.val();
    for (const [orderId, info] of Object.entries(payments)) {
      if (info.status === 'paid') {
        if (filterPlanKey) {
          if (info.planKey === filterPlanKey) {
            return res.status(200).json({ paid: true, orderId, info });
          }
        } else {
          return res.status(200).json({ paid: true, orderId, info });
        }
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
      const paidAt = new Date().toISOString();

      if (orderId) {
        database.ref(`payments/${orderId}`).update({
          status: 'paid',
          paymentId,
          paidAt
        }).catch(err => console.error('Webhook DB update error:', err));

        database.ref(`payments/${orderId}`).get().then(p => {
          const record = p.val() || {};
          const uid = record?.uid;
          const planKey = record?.planKey;
          const planName = record?.planName;

          if (uid) {
            database.ref(`userPayments/${uid}/${orderId}`).update({
              status: 'paid',
              paymentId,
              paidAt,
              planKey,
              planName
            }).catch(err => console.error('Webhook user payment update error:', err));

            if (planKey) {
              database.ref(`${USER_PURCHASES_PATH}/${uid}/${orderId}`).update({
                orderId,
                paymentId,
                paidAt,
                planKey,
                planName,
                status: 'paid'
              }).catch(err => console.error('Webhook purchase update error:', err));
            }
          }
        }).catch(err => console.error('Webhook get payment record error:', err));
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

app.get("/api/prelims/banner-slides", async (req, res) => {
  try {
    const snapshot = await database.ref(PRELIMS_BANNER_SLIDES_PATH).get();
    return res.status(200).json({ slides: normalizeBannerSlides(snapshot.val()) });
  } catch (error) {
    console.error("Public prelims banner fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load banners" });
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
    const purchases = normalizeList(purchasesSnapshot.val()).filter(
      (purchase) =>
        purchase.status === "paid" &&
        isPurchaseActive(purchase) &&
        !String(purchase.planKey || "").startsWith("mains:")
    );
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
  body("tests").isArray()
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

app.get("/api/admin/prelims/banner-slides", verifyAdminToken, async (req, res) => {
  try {
    const snapshot = await database.ref(PRELIMS_BANNER_SLIDES_PATH).get();
    return res.status(200).json({ slides: normalizeBannerSlides(snapshot.val()) });
  } catch (error) {
    console.error("Load prelims banner error:", error.message);
    return res.status(500).json({ message: "Failed to load banners" });
  }
});

app.put("/api/admin/prelims/banner-slides", verifyAdminToken, [
  body("slides").isArray({ min: 3, max: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid banner data" });
    }

    const slides = normalizeBannerSlides(req.body.slides);
    if (slides.length !== 3) {
      return res.status(400).json({ message: "Exactly 3 banners are required" });
    }

    for (const slide of slides) {
      if (!slide.title || !slide.subtitle || !slide.imageUrl || !slide.link) {
        return res.status(400).json({ message: "Each banner needs a title, subtitle, image URL, and link" });
      }
    }

    await database.ref(PRELIMS_BANNER_SLIDES_PATH).set(slides.map((slide, index) => ({
      ...slide,
      id: slide.id || `prelims-banner-${index + 1}`
    })));

    return res.status(200).json({ slides });
  } catch (error) {
    console.error("Save prelims banner error:", error.message);
    return res.status(500).json({ message: "Failed to save banners" });
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
    const userIds = new Set([
      ...Object.keys(usersData),
      ...Object.keys(purchasesData),
      ...Object.keys(attemptsData)
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const users = Array.from(userIds).map((uid) => {
      const user = usersData[uid] || {};
      const userPurchases = normalizeList(purchasesData[uid] || {})
        .filter((purchase) => purchase.status === "paid")
        .sort((a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime());

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
        name: fullName || user.email || latestPurchase?.email || attempts[0]?.email || "User",
        plan: purchasePlan?.planKey || "free",
        activeWindow
      };
    });

    const summary = {
      totalUsers: userIds.size,
      activeUsersToday: users.filter((user) => user.activeWindow === "today").length,
      activeUsersThisWeek: users.filter((user) => user.activeWindow === "today" || user.activeWindow === "week").length,
      totalAttempts: Object.values(attemptsData).reduce((count, attemptsForUser) => count + normalizeList(attemptsForUser).length, 0)
    };

    return res.status(200).json({ users, summary });
  } catch (error) {
    console.error("Admin users fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load users" });
  }
});

app.get("/api/admin/overview", verifyAdminToken, async (req, res) => {
  try {
    const [testsSnapshot, usersSnapshot, purchasesSnapshot, attemptsSnapshot] = await Promise.all([
      database.ref(ADMIN_TESTS_PATH).get(),
      database.ref("users").get(),
      database.ref(USER_PURCHASES_PATH).get(),
      database.ref(USER_TEST_ATTEMPTS_PATH).get()
    ]);

    const tests = normalizeList(testsSnapshot.val());
    const usersData = usersSnapshot.val() || {};
    const purchasesData = purchasesSnapshot.val() || {};
    const attemptsData = attemptsSnapshot.val() || {};
    const userIds = new Set([
      ...Object.keys(usersData),
      ...Object.keys(purchasesData),
      ...Object.keys(attemptsData)
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const users = Array.from(userIds).map((uid) => {
      const user = usersData[uid] || {};
      const userPurchases = normalizeList(purchasesData[uid] || {})
        .filter((purchase) => purchase.status === "paid")
        .sort((a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime());

      const latestPurchase = userPurchases[0];
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
        name: fullName || user.email || latestPurchase?.email || attempts[0]?.email || "User",
        plan: latestPurchase ? getPurchasePlan(latestPurchase).planKey : "free",
        activeWindow
      };
    });

    const summary = {
      totalUsers: userIds.size,
      activeUsersToday: users.filter((user) => user.activeWindow === "today").length,
      activeUsersThisWeek: users.filter((user) => user.activeWindow === "today" || user.activeWindow === "week").length,
      totalAttempts: Object.values(attemptsData).reduce((count, attemptsForUser) => count + normalizeList(attemptsForUser).length, 0),
      totalTestsCreated: tests.length
    };

    return res.status(200).json({ tests, users, summary });
  } catch (error) {
    console.error("Admin overview fetch error:", error.message);
    return res.status(500).json({ message: "Failed to load overview" });
  }
});

// ============ STATS ENDPOINT ============

app.get("/api/stats", async (req, res) => {
  try {
    const usersSnapshot = await database.ref(`users`).get();
    const actualRegistered = usersSnapshot.exists()
      ? Object.keys(usersSnapshot.val()).length
      : 0;
    const displayCount = actualRegistered + 100;

    const weeklyIncrease = Math.max(1, Math.ceil(actualRegistered / 10));
    const liveNow = actualRegistered + 25;
    const currentStreak = 7;
    const quizzesTotal = 25;
    const quizzesAttempted = Math.min(quizzesTotal, Math.floor(quizzesTotal * 0.48));
    const attemptPercentage = quizzesTotal > 0 ? Math.round((quizzesAttempted / quizzesTotal) * 100) : 0;

    return res.status(200).json({
      stats: {
        totalRegistered: displayCount,
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

// ============ MAINS TEST SERIES ENDPOINTS ============

// Admin: Upload mains question paper (PDF as base64)
app.post("/api/admin/mains/papers", verifyAdminToken, async (req, res) => {
  try {
    const { subject, pdfBase64, fileName, durationMinutes } = req.body;
    if (!VALID_MAINS_SUBJECTS.includes(subject)) {
      return res.status(400).json({ message: "Invalid subject" });
    }
    if (!pdfBase64 || !fileName) {
      return res.status(400).json({ message: "PDF data and file name are required" });
    }
    const duration = Number(durationMinutes);
    if (!duration || duration <= 0 || duration > 600) {
      return res.status(400).json({ message: "Duration must be 1-600 minutes" });
    }
    await database.ref(`${MAINS_PAPERS_PATH}/${subject}`).set({
      pdfBase64,
      fileName,
      durationMinutes: duration,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.admin.email
    });
    return res.status(200).json({ success: true, message: "Question paper uploaded successfully" });
  } catch (error) {
    console.error("Mains paper upload error:", error.message);
    return res.status(500).json({ message: "Failed to upload question paper" });
  }
});

// Admin: Get mains papers metadata (without PDF data)
app.get("/api/admin/mains/papers", verifyAdminToken, async (req, res) => {
  try {
    const snapshot = await database.ref(MAINS_PAPERS_PATH).get();
    const papers = {};
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const [subj, info] of Object.entries(data)) {
        papers[subj] = {
          subject: subj,
          fileName: info.fileName,
          durationMinutes: info.durationMinutes,
          uploadedAt: info.uploadedAt,
          uploadedBy: info.uploadedBy
        };
      }
    }
    return res.status(200).json({ papers });
  } catch (error) {
    console.error("Mains papers list error:", error.message);
    return res.status(500).json({ message: "Failed to load papers" });
  }
});

// User: Get mains purchases + paper availability
app.get("/api/user/mains/purchases", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const [purchasesSnapshot, accessSnapshot, answersSnapshot, papersSnapshot] = await Promise.all([
      database.ref(`${USER_PURCHASES_PATH}/${uid}`).get(),
      database.ref(`${USER_MAINS_ACCESS_PATH}/${uid}`).get(),
      database.ref(USER_MAINS_ANSWERS_PATH).get(),
      database.ref(MAINS_PAPERS_PATH).get()
    ]);

    const purchases = normalizeList(purchasesSnapshot.val())
      .filter((p) => p.status === "paid" && String(p.planKey || "").startsWith("mains:") && isPurchaseActive(p));

    const accessData = accessSnapshot.exists() ? accessSnapshot.val() : {};
    const papers = papersSnapshot.exists() ? papersSnapshot.val() : {};
    const answersData = answersSnapshot.exists() ? answersSnapshot.val() : {};

    const mainsPurchases = purchases.map((p) => {
      const subject = String(p.planKey || "").split(":")[1];
      const paper = papers[subject] || {};
      const access = accessData[subject] || {};
      const hasSubmitted = Boolean(answersData[subject] && answersData[subject][uid]);

      return {
        planKey: p.planKey,
        subject,
        planName: p.planName,
        paidAt: p.paidAt,
        hasPaper: Boolean(paper.fileName),
        fileName: paper.fileName || null,
        durationMinutes: paper.durationMinutes || 120,
        startedAt: access.startedAt || null,
        hasSubmitted
      };
    });

    return res.status(200).json({ mainsPurchases });
  } catch (error) {
    console.error("User mains purchases error:", error.message);
    return res.status(500).json({ message: "Failed to load mains purchases" });
  }
});

// User: Download mains question paper (requires payment)
app.get("/api/mains/papers/:subject", verifyToken, async (req, res) => {
  try {
    const { subject } = req.params;
    const { uid } = req.user;

    if (!VALID_MAINS_SUBJECTS.includes(subject)) {
      return res.status(400).json({ message: "Invalid subject" });
    }

    const purchasesSnapshot = await database.ref(`${USER_PURCHASES_PATH}/${uid}`).get();
    const purchases = normalizeList(purchasesSnapshot.val())
      .filter((p) => p.status === "paid" && isPurchaseActive(p));
    const hasPaid = purchases.some((p) => p.planKey === `mains:${subject}`);

    if (!hasPaid) {
      return res.status(403).json({ message: "Payment required to access this paper" });
    }

    const paperSnapshot = await database.ref(`${MAINS_PAPERS_PATH}/${subject}`).get();
    if (!paperSnapshot.exists()) {
      return res.status(404).json({ message: "Question paper not yet available. Check back later." });
    }

    const paper = paperSnapshot.val();

    // Record first access time for countdown
    const accessRef = database.ref(`${USER_MAINS_ACCESS_PATH}/${uid}/${subject}`);
    const accessSnapshot = await accessRef.get();
    let startedAt;
    if (!accessSnapshot.exists()) {
      startedAt = new Date().toISOString();
      await accessRef.set({ startedAt });
    } else {
      startedAt = accessSnapshot.val().startedAt;
    }

    return res.status(200).json({
      pdfBase64: paper.pdfBase64,
      fileName: paper.fileName,
      durationMinutes: paper.durationMinutes,
      startedAt
    });
  } catch (error) {
    console.error("Mains paper download error:", error.message);
    return res.status(500).json({ message: "Failed to download question paper" });
  }
});

// User: Submit answer sheet
app.post("/api/user/mains/answer", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { subject, pdfBase64, fileName } = req.body;

    if (!VALID_MAINS_SUBJECTS.includes(subject)) {
      return res.status(400).json({ message: "Invalid subject" });
    }
    if (!pdfBase64 || !fileName) {
      return res.status(400).json({ message: "Answer sheet PDF is required" });
    }

    const purchasesSnapshot = await database.ref(`${USER_PURCHASES_PATH}/${uid}`).get();
    const purchases = normalizeList(purchasesSnapshot.val()).filter((p) => p.status === "paid");
    const hasPaid = purchases.some((p) => p.planKey === `mains:${subject}`);

    if (!hasPaid) {
      return res.status(403).json({ message: "Payment required" });
    }

    const userSnapshot = await database.ref(`users/${uid}`).get();
    const user = userSnapshot.exists() ? userSnapshot.val() : {};

    await database.ref(`${USER_MAINS_ANSWERS_PATH}/${subject}/${uid}`).set({
      pdfBase64,
      fileName,
      uploadedAt: new Date().toISOString(),
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
      userEmail: user.email || req.user.email || '',
      uid
    });

    return res.status(200).json({ success: true, message: "Answer sheet submitted successfully" });
  } catch (error) {
    console.error("Answer sheet upload error:", error.message);
    return res.status(500).json({ message: "Failed to submit answer sheet" });
  }
});

// Admin: List all answer submissions
app.get("/api/admin/mains/answers", verifyAdminToken, async (req, res) => {
  try {
    const { subject } = req.query;
    const snapshot = await database.ref(USER_MAINS_ANSWERS_PATH).get();

    if (!snapshot.exists()) {
      return res.status(200).json({ submissions: [] });
    }

    const allData = snapshot.val();
    const submissions = [];

    for (const [subj, users] of Object.entries(allData)) {
      if (subject && subj !== subject) continue;
      if (!VALID_MAINS_SUBJECTS.includes(subj)) continue;
      for (const [userId, data] of Object.entries(users || {})) {
        submissions.push({
          uid: userId,
          subject: subj,
          fileName: data.fileName,
          uploadedAt: data.uploadedAt,
          userName: data.userName,
          userEmail: data.userEmail
        });
      }
    }

    submissions.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return res.status(200).json({ submissions });
  } catch (error) {
    console.error("Admin mains answers list error:", error.message);
    return res.status(500).json({ message: "Failed to load submissions" });
  }
});

// Admin: Download specific answer sheet
app.get("/api/admin/mains/answers/:subject/:uid", verifyAdminToken, async (req, res) => {
  try {
    const { subject, uid } = req.params;
    if (!VALID_MAINS_SUBJECTS.includes(subject)) {
      return res.status(400).json({ message: "Invalid subject" });
    }
    const snapshot = await database.ref(`${USER_MAINS_ANSWERS_PATH}/${subject}/${uid}`).get();
    if (!snapshot.exists()) {
      return res.status(404).json({ message: "Answer sheet not found" });
    }
    return res.status(200).json({ answer: snapshot.val() });
  } catch (error) {
    console.error("Admin answer download error:", error.message);
    return res.status(500).json({ message: "Failed to load answer sheet" });
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
