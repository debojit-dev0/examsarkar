import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ""
};

let cachedServices = null;

const getMissingFirebaseEnvKeys = () => {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "databaseURL",
    "projectId",
    "appId"
  ];

  return requiredKeys.filter((key) => !firebaseConfig[key]);
};

export const getFirebaseServices = () => {
  if (cachedServices) {
    return cachedServices;
  }

  const missingKeys = getMissingFirebaseEnvKeys();
  if (missingKeys.length > 0) {
    throw new Error(
      `Firebase config missing: ${missingKeys.join(", ")}. Set values in .env and restart the dev server.`
    );
  }

  const app = initializeApp(firebaseConfig);
  cachedServices = {
    auth: getAuth(app),
    database: getDatabase(app)
  };

  return cachedServices;
};
