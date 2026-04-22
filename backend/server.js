const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const { database } = require("./firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000"
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
    const emailSnapshot = await emailRef.get();

    if (emailSnapshot.exists()) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    const uid = crypto.randomUUID();
    const userRecord = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash: sha256(password),
      confirmPasswordHash: sha256(confirmPassword),
      createdAt: new Date().toISOString()
    };

    await database.ref().update({
      [`users/${uid}`]: userRecord,
      [`usersByEmail/${emailKey}`]: uid
    });

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
