const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

let serviceAccount;
const databaseURL =
  process.env.FIREBASE_DATABASE_URL || process.env.REACT_APP_FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error("FIREBASE_DATABASE_URL is missing in .env.");
}

// Try to load from SERVICE_ACCOUNT_JSON env var first (for Netlify)
if (process.env.SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    console.log("✓ Firebase credentials loaded from SERVICE_ACCOUNT_JSON env var");
  } catch (err) {
    throw new Error(
      `Invalid SERVICE_ACCOUNT_JSON env var: ${err.message}. Make sure it's valid JSON.`
    );
  }
}
// Fall back to file loading (for local development)
else if (process.env.SERVICE_ACCOUNT_PATH || fs.existsSync("./Service.json")) {
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || "./Service.json";
  const resolvedServiceAccountPath = path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedServiceAccountPath)) {
    throw new Error(
      `Service account file not found at ${resolvedServiceAccountPath}. ` +
      `Provide SERVICE_ACCOUNT_JSON env var or SERVICE_ACCOUNT_PATH in .env.`
    );
  }

  serviceAccount = require(resolvedServiceAccountPath);
  console.log(`✓ Firebase credentials loaded from ${serviceAccountPath}`);
} else {
  throw new Error(
    "Firebase credentials not found. Provide either:\n" +
    "  1. SERVICE_ACCOUNT_JSON env var (for Netlify)\n" +
    "  2. SERVICE_ACCOUNT_PATH in .env (for local dev)\n" +
    "  3. Service.json file in project root"
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL
  });
}

const database = admin.database();

module.exports = { database };
