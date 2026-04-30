// Auto-detect backend URL based on environment
const getApiBaseUrl = () => {
  // In Netlify production: use serverless functions
  if (window.location.hostname.includes('.netlify.app')) {
    return `${window.location.protocol}//${window.location.host}/.netlify/functions/api`;
  }
  
  // In local development: use localhost:5000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Fallback: use current domain (useful for self-hosted)
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

  // return both user and token so callers can persist auth token
  return { user: result.user, token: result.token };
};

export const loginUser = async (email, password) => {
  const result = await request("/api/auth/login", { email, password });
  // return both user and token so callers can persist auth token
  return { user: result.user, token: result.token };
};
