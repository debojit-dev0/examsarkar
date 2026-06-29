const RECENT_ACTIVITY_PREFIX = "examSarkarRecentQuizActivity";
const GLOBAL_ACTIVITY_KEY = `${RECENT_ACTIVITY_PREFIX}:global`;
const MEMORY_ACTIVITY_KEY = "__examSarkarRecentQuizActivity";
const PENDING_ATTEMPTS_KEY = "examSarkarPendingTestAttempts";

const getCurrentActivityKey = () => {
  try {
    const rawUser = window.localStorage.getItem("user");
    const user = rawUser ? JSON.parse(rawUser) : null;
    const userKey = user?.uid || user?.email || "guest";
    return `${RECENT_ACTIVITY_PREFIX}:${userKey}`;
  } catch {
    return `${RECENT_ACTIVITY_PREFIX}:guest`;
  }
};

const getTimestamp = (value) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getActivityKey = (item) => {
  if (!item) return null;
  const submittedAt = item.submittedAt || item.timestamp || item.createdAt || "";
  return String(item.attemptId || item.id || `${item.testId || "test"}:${submittedAt}`);
};

const normalizeActivity = (item) => {
  if (!item) return null;

  const submittedAt = item.submittedAt || item.timestamp || item.createdAt;
  if (!getTimestamp(submittedAt)) return null;

  return {
    id: String(item.id || item.attemptId || submittedAt),
    attemptId: item.attemptId || item.id || null,
    testId: item.testId || null,
    title: item.title || item.testName || "Quiz Attempt",
    score: item.score || "0%",
    accuracy: item.accuracy || "0%",
    attempted: Number(item.attempted || 0),
    total: Number(item.total || 0),
    submittedAt,
    time: item.time || `${Math.max(Number(item.attempted || 0), 1)} questions`,
    date: item.date || new Date(submittedAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  };
};

const readStoredActivities = () => {
  try {
    const rawValues = [];

    const memoryValues = Array.isArray(window[MEMORY_ACTIVITY_KEY]) ? window[MEMORY_ACTIVITY_KEY] : [];
    if (memoryValues.length > 0) {
      rawValues.push(JSON.stringify(memoryValues));
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(RECENT_ACTIVITY_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value) rawValues.push(value);
      }
    }

    if (rawValues.length === 0) return [];

    const parsed = rawValues.flatMap((raw) => {
      try {
        const value = JSON.parse(raw);
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    });

    const merged = new Map();

    parsed
      .map(normalizeActivity)
      .filter(Boolean)
      .forEach((item) => {
        const key = getActivityKey(item);
        if (!key) return;
        merged.set(key, item);
      });

    const filtered = Array.from(merged.values())
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
      .slice(0, 20);

    persistActivities(filtered);

    return filtered;
  } catch {
    return [];
  }
};

const persistActivities = (activities) => {
  try {
    window[MEMORY_ACTIVITY_KEY] = activities;
    window.localStorage.setItem(getCurrentActivityKey(), JSON.stringify(activities));
    window.localStorage.setItem(GLOBAL_ACTIVITY_KEY, JSON.stringify(activities));
  } catch {
    // ignore storage failures
  }
};

export const loadRecentQuizActivity = () => readStoredActivities();

export const saveRecentQuizActivity = (activity) => {
  const nextActivity = normalizeActivity(activity);
  if (!nextActivity) return [];

  const nextKey = getActivityKey(nextActivity);
  const existing = readStoredActivities().filter((item) => getActivityKey(item) !== nextKey);
  const updated = [nextActivity, ...existing]
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
    .slice(0, 20);

  persistActivities(updated);
  return updated;
};

export const mergeRecentQuizActivity = (remoteActivities = [], localActivities = []) => {
  const merged = new Map();

  [...remoteActivities, ...localActivities]
    .map(normalizeActivity)
    .filter(Boolean)
    .forEach((item) => {
      const key = getActivityKey(item);
      if (!key) return;
      merged.set(key, item);
    });

  return Array.from(merged.values())
    .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
    .slice(0, 20);
};

const getPendingKey = (payload) => {
  if (!payload) return null;
  const submittedAt = payload.submittedAt || payload.timestamp || payload.createdAt || "";
  return `${payload.testId || "test"}:${submittedAt}`;
};

const readPendingAttempts = () => {
  try {
    const raw = window.localStorage.getItem(PENDING_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistPendingAttempts = (attempts) => {
  try {
    window.localStorage.setItem(PENDING_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // ignore storage failures
  }
};

export const loadPendingAttempts = () => readPendingAttempts();

export const setPendingAttempts = (attempts) => {
  persistPendingAttempts(Array.isArray(attempts) ? attempts : []);
};

export const enqueuePendingAttempt = (payload) => {
  if (!payload) return;
  const key = getPendingKey(payload);
  if (!key) return;
  const existing = readPendingAttempts().filter((item) => getPendingKey(item) !== key);
  persistPendingAttempts([payload, ...existing].slice(0, 20));
};

export const removeRecentQuizActivity = (id) => {
  if (!id) return;
  const existing = readStoredActivities().filter((item) => getActivityKey(item) !== String(id));
  persistActivities(existing);
  return existing;
};

const LOCAL_ATTEMPTS_KEY = "examSarkarLocalAttempts";

export const saveLocalAttempt = (id, payload) => {
  if (!id || !payload) return;
  try {
    const raw = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[String(id)] = payload;
    const keys = Object.keys(store);
    if (keys.length > 20) {
      keys.slice(0, keys.length - 20).forEach((k) => delete store[k]);
    }
    window.localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(store));
  } catch {}
};

export const loadLocalAttempt = (id) => {
  if (!id) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw)[String(id)] || null;
  } catch {
    return null;
  }
};

export const removeLocalAttempt = (id) => {
  if (!id) return;
  try {
    const raw = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    delete store[String(id)];
    window.localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(store));
  } catch {}
};

export const findPendingAttemptById = (tempId) => {
  if (!tempId) return null;
  const pending = readPendingAttempts();
  return pending.find(
    (p) => p && p.testId && p.submittedAt && `${p.testId}-${p.submittedAt}` === String(tempId)
  ) || null;
};