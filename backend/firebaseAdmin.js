const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || "./Service.json";
const resolvedServiceAccountPath = path.resolve(process.cwd(), serviceAccountPath);

if (!fs.existsSync(resolvedServiceAccountPath)) {
  throw new Error(
    `Service account file not found at ${resolvedServiceAccountPath}. Update SERVICE_ACCOUNT_PATH in .env.`
  );
}

const serviceAccount = require(resolvedServiceAccountPath);
const databaseURL =
  process.env.FIREBASE_DATABASE_URL || process.env.REACT_APP_FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error("FIREBASE_DATABASE_URL is missing in .env.");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  });
}

const database = admin.database();

module.exports = { database };
