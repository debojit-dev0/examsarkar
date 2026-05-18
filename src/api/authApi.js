import { buildApiUrl } from "../utils/apiBaseUrl";

const AUTH_SESSION_KEY = "auth_session";
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

export const getStoredAuthSession = () => {
  try {
    const rawSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (!rawSession) return null;
    return JSON.parse(rawSession);
  } catch {
    return null;
  }
};

export const setStoredAuthSession = ({ user, accessToken, refreshToken }) => {
  const session = {
    user: user || null,
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    updatedAt: new Date().toISOString()
  };

  if (session.user) localStorage.setItem("user", JSON.stringify(session.user));
  if (session.accessToken) localStorage.setItem("accessToken", session.accessToken);
  if (session.refreshToken) localStorage.setItem("refreshToken", session.refreshToken);
  if (session.accessToken) localStorage.setItem("token", session.accessToken);
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));

  return session;
};

export const clearStoredAuthSession = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem(AUTH_SESSION_KEY);
};

export const restoreAuthSession = async () => {
  const session = getStoredAuthSession();
  if (!session?.refreshToken) return null;

  if (session.accessToken) {
    return session;
  }

  const refreshed = await refreshAccessToken(session.refreshToken);
  return setStoredAuthSession({
    user: session.user,
    accessToken: refreshed.accessToken,
    refreshToken: session.refreshToken
  });
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
