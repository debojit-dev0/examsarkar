import { buildApiUrl } from "../utils/apiBaseUrl";

const request = async (path, payload) => {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || "Request failed.");
  }

  return body;
};

export const registerUser = async ({
  firstName,
  lastName,
  email,
  phone,
  password,
  confirmPassword
}) => {
  const result = await request("/api/auth/register", {
    firstName,
    lastName,
    email,
    phone,
    password,
    confirmPassword
  });

  // return both user and token so callers can persist auth token
  return { user: result.user, token: result.token };
};

export const loginUser = async (email, password) => {
  const result = await request("/api/auth/login", { email, password });
  // return both user and token so callers can persist auth token
  return { user: result.user, token: result.token };
};

// ============ ADMIN AUTH ============
export const ADMIN_TEST_ACCOUNTS = [
  {
    label: "Super Admin",
    email: "admin@examsarkar.com",
    password: "Admin@123",
    role: "super-admin"
  },
  {
    label: "Content Admin",
    email: "content@examsarkar.com",
    password: "Content@123",
    role: "content-admin"
  }
];

// Mock admin session storage key
const ADMIN_SESSION_KEY = "admin_session";

export const getAdminSession = () => {
  try {
    const session = localStorage.getItem(ADMIN_SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
};

export const loginAdminWithTestCredentials = async (email, password) => {
  // Simple validation against test accounts
  const account = ADMIN_TEST_ACCOUNTS.find(
    (acc) => acc.email === email && acc.password === password
  );

  if (!account) {
    throw new Error("Invalid admin credentials");
  }

  // Create session
  const session = {
    email: account.email,
    role: account.role,
    loginTime: new Date().toISOString()
  };

  // Store session in localStorage
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));

  return session;
};

export const logoutAdmin = () => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
};
