// Auto-detect backend URL based on frontend's hostname (works on any device)
const getApiBaseUrl = () => {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
};

const request = async (path, payload) => {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

  return result.user;
};

export const loginUser = async (email, password) => {
  const result = await request("/api/auth/login", { email, password });
  return result.user;
};

const ADMIN_SESSION_KEY = "examSarkarAdminSession";

export const ADMIN_TEST_ACCOUNTS = [
  {
    role: "super-admin",
    label: "Super Admin",
    email: "superadmin@examsarkar.test",
    password: "Super@123"
  },
  {
    role: "content-admin",
    label: "Content Admin",
    email: "contentadmin@examsarkar.test",
    password: "Content@123"
  }
];

export const loginAdminWithTestCredentials = async (email, password) => {
  const account = ADMIN_TEST_ACCOUNTS.find(
    (item) => item.email.toLowerCase() === String(email).trim().toLowerCase() && item.password === password
  );

  if (!account) {
    throw new Error("Invalid admin credentials.");
  }

  const session = {
    role: account.role,
    email: account.email,
    loggedAt: new Date().toISOString()
  };

  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const getAdminSession = () => {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const logoutAdmin = () => {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
};
