const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getConfiguredBase = () => {
  const configured = process.env.REACT_APP_BACKEND_URL?.trim();
  if (!configured) return null;
  return trimTrailingSlash(configured);
};

export const getApiBaseUrl = () => {
  const configuredBase = getConfiguredBase();
  if (configuredBase) {
    return configuredBase;
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5000";
  }

  // In deployed environments, prefer same-origin /api so rewrites/proxies work.
  return "";
};

export const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();

  if (!base) {
    return normalizedPath;
  }

  // Prevent duplicated /api prefix when base already includes /api.
  if (base.endsWith("/api") && normalizedPath.startsWith("/api")) {
    return `${base}${normalizedPath.slice(4)}`;
  }

  return `${base}${normalizedPath}`;
};