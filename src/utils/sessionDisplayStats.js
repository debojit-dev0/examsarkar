const AUTH_SESSION_ID_KEY = "examSarkarLoginSessionId";
const SESSION_STATS_PREFIX = "examSarkarDisplayStats";

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getCurrentSessionId = () => {
  try {
    return window.localStorage.getItem(AUTH_SESSION_ID_KEY) || "guest";
  } catch {
    return "guest";
  }
};

const buildDisplayStats = (sessionId) => {
  if (sessionId === "guest") {
    return {
      sessionId,
      liveNow: randomInt(25, 85),
      totalRegistered: randomInt(1000, 5000),
      generatedAt: new Date().toISOString()
    };
  }

  return {
    sessionId,
    liveNow: randomInt(300, 999),
    totalRegistered: randomInt(10000, 25000),
    generatedAt: new Date().toISOString()
  };
};

export const getSessionDisplayStats = () => {
  const sessionId = getCurrentSessionId();
  const storageKey = `${SESSION_STATS_PREFIX}:${sessionId}`;

  try {
    const cached = window.sessionStorage.getItem(storageKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.sessionId === sessionId) {
        return parsed;
      }
    }
  } catch {
    // rebuild the cache below
  }

  const stats = buildDisplayStats(sessionId);

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(stats));
  } catch {
    // ignore storage failures
  }

  return stats;
};

export const clearSessionDisplayStats = () => {
  try {
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key.startsWith(`${SESSION_STATS_PREFIX}:`)) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {
    // ignore storage failures
  }
};