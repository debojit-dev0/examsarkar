import { buildApiUrl } from "./apiBaseUrl";

const LEGACY_STORAGE_KEY = "examSarkarAdminTests";

const getAdminSessionHeader = () => {
  try {
    const rawSession = window.localStorage.getItem("admin_session");
    if (!rawSession) return null;
    return btoa(rawSession);
  } catch {
    return null;
  }
};

const getUserAccessToken = () =>
  window.localStorage.getItem("accessToken") || window.localStorage.getItem("token");

const request = async (path, method = "GET", payload, headers = {}) => {
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || "Request failed.");
  }

  return body;
};

export async function loadAdminTests() {
  try {
    const adminSession = getAdminSessionHeader();
    if (adminSession) {
      const result = await request("/api/admin/tests", "GET", undefined, {
        "x-admin-session": adminSession
      });
      const remoteTests = Array.isArray(result.tests) ? result.tests : [];
      if (remoteTests.length > 0) {
        return remoteTests;
      }
    }

    const accessToken = getUserAccessToken();
    if (accessToken) {
      const result = await request("/api/user/tests", "GET", undefined, {
        Authorization: `Bearer ${accessToken}`
      });
      const accessibleTests = Array.isArray(result.accessibleTests) ? result.accessibleTests : [];
      if (accessibleTests.length > 0) {
        return accessibleTests;
      }
    }

    const publicResult = await request("/api/tests");
    const publicTests = Array.isArray(publicResult.tests) ? publicResult.tests : [];
    if (publicTests.length > 0) {
      return publicTests;
    }
  } catch (error) {
    console.error("Failed to load tests:", error);
  }

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return [];

    const legacyTests = JSON.parse(legacyRaw);
    if (!Array.isArray(legacyTests) || legacyTests.length === 0) return [];

    await saveAdminTests(legacyTests);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacyTests;
  } catch {
    return [];
  }
}

export async function saveAdminTests(tests) {
  const adminSession = getAdminSessionHeader();
  if (!adminSession) {
    throw new Error("Admin session required to save tests.");
  }

  const result = await request("/api/admin/tests", "PUT", { tests }, {
    "x-admin-session": adminSession
  });
  return Array.isArray(result.tests) ? result.tests : [];
}

export { getAdminSessionHeader };

export function getLatestFreeDailyQuiz(tests) {
  const source = tests || [];
  const dailyQuiz = source.filter((test) => test.type === "daily-quiz" && test.access === "free");

  if (dailyQuiz.length === 0) return null;

  // Helper function to normalize date to YYYY-MM-DD
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.toISOString().split("T")[0];
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayDate = today.toISOString().split("T")[0];

  // Only return quiz if it's for TODAY's date
  const todayQuiz = dailyQuiz.find((test) => {
    const testDate = test.date || test.createdAt;
    const normalizedTestDate = normalizeDate(testDate);
    return normalizedTestDate === todayDate;
  });

  if (todayQuiz) {
    console.log("[Daily Quiz] Found today's quiz:", todayQuiz.testName, todayDate);
    return todayQuiz;
  }

  // No quiz for today - return null (will show "No daily quiz uploaded yet")
  console.log("[Daily Quiz] No quiz uploaded for today:", todayDate);
  return null;
}

export function findTestById(tests, testId) {
  if (!testId) return null;
  return (tests || []).find((test) => test.id === testId) || null;
}
