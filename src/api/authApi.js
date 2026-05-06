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

  // Return both user and tokens (accessToken for requests, refreshToken for refresh)
  return { 
    user: result.user, 
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  };
};

export const loginUser = async (email, password) => {
  const result = await request("/api/auth/login", { email, password });
  // Return both user and tokens
  return { 
    user: result.user, 
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  };
};

// Refresh access token using refresh token
export const refreshAccessToken = async (refreshToken) => {
  const response = await fetch(buildApiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refreshToken })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || "Token refresh failed.");
  }

  return { accessToken: body.accessToken };
};

export const ADMIN_TEST_ACCOUNTS = [];

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
  const result = await request("/api/admin/login", { email, password });
  return result.session;
};

export const setAdminSession = (session) => {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const logoutAdmin = () => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
};
