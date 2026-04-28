const getApiBaseUrl = () => {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
};

const LEGACY_STORAGE_KEY = "examSarkarAdminTests";

const request = async (path, method = "GET", payload) => {
  const API_BASE_URL = getApiBaseUrl();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
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
  const result = await request("/api/admin/tests");
  const remoteTests = Array.isArray(result.tests) ? result.tests : [];

  if (remoteTests.length > 0) {
    return remoteTests;
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
  const result = await request("/api/admin/tests", "PUT", { tests });
  return Array.isArray(result.tests) ? result.tests : [];
}

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
