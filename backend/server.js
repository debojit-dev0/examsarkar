const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");

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
app.use(express.json());

const toEmailKey = (email) =>
  Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");

const sha256 = (text) =>
  crypto.createHash("sha256").update(text || "").digest("hex");

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

const adminTestsRef = () => database.ref("adminTests/items");

const normalizeAdminTestsPayload = (tests) => {
  if (!Array.isArray(tests)) return [];

  return tests
    .filter((test) => test && test.id)
    .map((test) => ({
      id: test.id,
      testName: test.testName || "",
      type: test.type || "daily",
      access: test.access || "free",
      date: test.date || "",
      questionCount: Number(test.questionCount) || 0,
      parsedQuestions: Array.isArray(test.parsedQuestions) ? test.parsedQuestions : [],
      fileName: test.fileName || "",
      createdAt: test.createdAt || new Date().toISOString()
    }));
};

app.get("/api/admin/tests", async (req, res) => {
  try {
    const snapshot = await adminTestsRef().get();

    if (!snapshot.exists()) {
      return res.status(200).json({ tests: [] });
    }

    const value = snapshot.val();
    const tests = Array.isArray(value)
      ? value.filter(Boolean)
      : Object.entries(value).map(([id, test]) => ({ id, ...test }));

    tests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({ tests });
  } catch (error) {
    console.error("Load admin tests error:", error);
    return res.status(500).json({ message: "Failed to load quizzes from database." });
  }
});

app.put("/api/admin/tests", async (req, res) => {
  try {
    const tests = normalizeAdminTestsPayload(req.body?.tests);
    const testsById = tests.reduce((accumulator, test) => {
      accumulator[test.id] = test;
      return accumulator;
    }, {});

    await adminTestsRef().set(testsById);

    return res.status(200).json({
      message: "Quiz library saved successfully.",
      tests
    });
  } catch (error) {
    console.error("Save admin tests error:", error);
    return res.status(500).json({ message: "Failed to save quizzes to database." });
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

    return res.status(201).json({
      message: "Registration successful.",
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

    return res.status(200).json({
      message: "Login successful.",
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

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
