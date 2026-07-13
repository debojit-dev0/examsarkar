// Netlify serverless function wrapper for Express backend
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const serverless = require('serverless-http');
const { body, validationResult, param } = require('express-validator');

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
app.use(express.json({ limit: "20mb", verify: (req, res, buf) => { req.rawBody = buf; } }));

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
const PRELIMS_BANNER_SLIDES_PATH = "prelimsBannerSlides";
const USER_PURCHASES_PATH = "userPurchases";
const USER_TEST_ATTEMPTS_PATH = "userTestAttempts";

// Server-authoritative pricing — client-sent amount is IGNORED
const PLAN_PRICES = {
  'daily:gs': 9900, 'daily:csat': 9900, 'daily:combo': 14900, 'daily:all': 9900,
  'weekly:gs': 59900, 'weekly:csat': 59900, 'weekly:combo': 99900, 'weekly:all': 59900,
  'monthly:gs': 149900, 'monthly:csat': 149900, 'monthly:combo': 249900, 'monthly:all': 149900,
  'mains:gs1': 9000, 'mains:gs2': 9000, 'mains:gs3': 9000, 'mains:gs4': 9000, 'mains:essay': 9000
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

const PLAN_DURATION_DAYS = { daily: 1, weekly: 7, monthly: 30 };

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
      expiresAt
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
    accessWindow
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

const verifyAdminToken = async (req, res, next) => {
  try {
    const session = req.headers["x-admin-session"];
    if (!session) {
      return res.status(401).json({ message: "Unauthorized: Admin session required" });
    }

    try {
      const decoded = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
      if (!decoded.uid || !decoded.role || (decoded.role !== "super-admin" && decoded.role !== "content-admin")) {
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

app.put("/api/admin/tests", verifyAdminToken, async (req, res) => {
  try {
    const tests = Array.isArray(req.body?.tests) ? req.body.tests : null;
    if (!tests) {
      return res.status(400).json({ message: "Invalid test data" });
    }

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

app.put("/api/admin/prelims/banner-slides", verifyAdminToken, async (req, res) => {
  try {
    const slides = Array.isArray(req.body?.slides) ? normalizeBannerSlides(req.body.slides) : null;
    if (!slides || slides.length !== 3) {
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
      createdAt,
      updatedAt: createdAt
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

// ================= FORGOT PASSWORD =================

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

// ================= RESET PASSWORD =================

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Missing data" });
    }

    const snapshot = await database.ref(`passwordReset/${token}`).get();

    if (!snapshot.exists()) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const data = snapshot.val();

    if (Date.now() > data.expiry) {
      return res.status(400).json({ message: "Token expired" });
    }

    const passwordHash = sha256(newPassword);

    await database.ref(`users/${data.uid}`).update({
      passwordHash
    });

    await database.ref(`passwordReset/${token}`).remove();

    return res.status(200).json({
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Reset failed" });
  }
});
// User profile
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

// User test attempts
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
      console.error("Save test attempt error:", error);
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
      console.error("Load test attempt error:", error);
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
      performanceSnapshot: { avgScore, bestScore, accuracy },
      currentStreak,
      quizAttempts: {
        attempted: quizzesAttempted,
        total: totalAvailableTests,
        attemptPercentage
      },
      recentQuizActivity
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard" });
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
    const usersSnapshot = database.ref("users").get();
    return Promise.resolve(usersSnapshot).then((snapshot) => {
      const actualRegistered = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
      const displayCount = actualRegistered + 100;
      const weeklyIncrease = Math.max(1, Math.ceil(actualRegistered / 10));

      return res.status(200).json({
        stats: {
          totalRegistered: displayCount,
          weeklyIncrease,
          liveNow: actualRegistered + 25,
          currentStreak: 7,
          quizzesAttempted: 12,
          quizzesTotal: 25,
          attemptPercentage: 48
        }
      });
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ message: "Failed to fetch stats." });
  }
});

// Create order
app.post(
  "/api/payment/create-order",
  verifyToken,
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

      // SERVER-SIDE PRICE ENFORCEMENT — client amount is ignored
      const amount = PLAN_PRICES[purchasePlan.planKey];
      if (!amount) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      const shortUid = uid.replace(/-/g, "").slice(0, 12);
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
    const paidAt = new Date().toISOString();
    await paymentRef.update({ status: "paid", paymentId: razorpay_payment_id, paidAt });

    const p = await paymentRef.get();
    const record = p.val() || {};
    const uid = record?.uid;
    const planKey = record?.planKey;
    const planName = record?.planName;
    if (uid) {
      await database.ref(`userPayments/${uid}/${razorpay_order_id}`).update({
        status: "paid",
        paymentId: razorpay_payment_id,
        paidAt,
        planKey,
        planName
      });

      if (planKey) {
        await database.ref(`${USER_PURCHASES_PATH}/${uid}/${razorpay_order_id}`).set({
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          paidAt,
          planKey,
          planName,
          status: "paid"
        });
      }
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
      const paidAt = new Date().toISOString();
      if (orderId) {
        await database.ref(`payments/${orderId}`).update({ status: 'paid', paymentId, paidAt });
        const p = await database.ref(`payments/${orderId}`).get();
        const record = p.val() || {};
        const uid = record?.uid;
        const planKey = record?.planKey;
        const planName = record?.planName;
        if (uid) {
          await database.ref(`userPayments/${uid}/${orderId}`).update({ status: 'paid', paymentId, paidAt, planKey, planName });
          if (planKey) {
            await database.ref(`${USER_PURCHASES_PATH}/${uid}/${orderId}`).update({
              orderId,
              paymentId,
              paidAt,
              planKey,
              planName,
              status: 'paid'
            });
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).send('error');
  }
});

// ============ MAINS TEST SERIES ENDPOINTS ============

// Admin: Upload mains question paper
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

// Export for Netlify
module.exports.app = app;
module.exports.handler = serverless(app);
