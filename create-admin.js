const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

const serviceAccount = require("./Service.json");
const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.REACT_APP_FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error("FIREBASE_DATABASE_URL is required.");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL
});

const database = admin.database();

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || "admin@examsarkar.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "Admin@12345";
const ADMIN_ROLE = process.env.ADMIN_SEED_ROLE || "super-admin";
const ADMIN_FIRST_NAME = process.env.ADMIN_SEED_FIRST_NAME || "Admin";
const ADMIN_LAST_NAME = process.env.ADMIN_SEED_LAST_NAME || "User";

const toEmailKey = (email) =>
  Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");

async function seedAdmin() {
  try {
    const emailKey = toEmailKey(ADMIN_EMAIL);
    const uid = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const adminRecord = {
      uid,
      email: ADMIN_EMAIL.trim().toLowerCase(),
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: ADMIN_ROLE,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await database.ref(`adminAccounts/${emailKey}`).set(adminRecord);

    console.log(`Admin credential written to adminAccounts/${emailKey}`);
    console.log(`Email: ${adminRecord.email}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Role: ${ADMIN_ROLE}`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed admin:", error.message);
    process.exit(1);
  }
}

seedAdmin();