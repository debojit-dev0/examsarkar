import { loadSupabasePapers } from "./supabasePapersStore";
import { buildApiUrl } from "./apiBaseUrl";

const LEGACY_STORAGE_KEY = "examSarkarAdminTests";
const DEFAULT_BANNER_COUNT = 3;

const DEFAULT_PRELIMS_BANNERS = [
  {
    id: "prelims-banner-1",
    title: "AIR 1 Mindset",
    subtitle: "Consistency beats talent when strategy is right",
    imageUrl: "https://media.assettype.com/english-sentinelassam/import/h-upload/2022/08/18/375889-lbsnaa.webp?auto=format%2Ccompress&fit=max&w=1200",
    link: "/test-series"
  },
  {
    id: "prelims-banner-2",
    title: "Daily Discipline",
    subtitle: "Small tests. Daily improvement. Big results.",
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    link: "/test-series"
  },
  {
    id: "prelims-banner-3",
    title: "Built for UPSC",
    subtitle: "Aligned with real exam pattern & pressure",
    imageUrl: "https://images.unsplash.com/photo-1505666287802-931dc83a4c1b?auto=format&fit=crop&w=1200&q=80",
    link: "/test-series"
  }
];

const normalizeBannerSlides = (slides) => {
  const list = Array.isArray(slides) ? slides : [];

  return Array.from({ length: DEFAULT_BANNER_COUNT }, (_, index) => {
    const source = list[index] || DEFAULT_PRELIMS_BANNERS[index];
    return {
      id: String(source?.id || `prelims-banner-${index + 1}`),
      title: String(source?.title || DEFAULT_PRELIMS_BANNERS[index].title || "").trim(),
      subtitle: String(source?.subtitle || DEFAULT_PRELIMS_BANNERS[index].subtitle || "").trim(),
      imageUrl: String(source?.imageUrl || source?.img || DEFAULT_PRELIMS_BANNERS[index].imageUrl || "").trim(),
      link: String(source?.link || DEFAULT_PRELIMS_BANNERS[index].link || "/test-series").trim()
    };
  });
};

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
      ...headers,
    },
    body: payload ? JSON.stringify(payload) : undefined,
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
      const result = await request("/api/admin/overview", "GET", undefined, {
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
      const accessWindow = result.accessWindow || result.purchasedPlans?.[0]?.accessWindow || null;

      const supabasePapers = await loadSupabasePapers(accessWindow);

      let scholarshipTest = null;
      try {
        const scholarshipResult = await request("/api/scholarship/my-test", "GET", undefined, {
          Authorization: `Bearer ${accessToken}`
        });
        scholarshipTest = scholarshipResult?.test || null;
      } catch (scholarshipError) {
        console.error("Failed to load Scholarship Test:", scholarshipError);
      }

      const merged = [...accessibleTests, ...supabasePapers, ...(scholarshipTest ? [scholarshipTest] : [])];
      if (merged.length > 0) return merged;
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

export async function loadAdminOverview() {
  const adminSession = getAdminSessionHeader();
  if (!adminSession) return null;

  try {
    return await request("/api/admin/overview", "GET", undefined, {
      "x-admin-session": adminSession
    });
  } catch (error) {
    console.error("Failed to load admin overview:", error);
    return null;
  }
}

export async function loadPrelimsBannerSlides() {
  try {
    const result = await request("/api/prelims/banner-slides");
    return normalizeBannerSlides(Array.isArray(result.slides) ? result.slides : []);
  } catch (error) {
    console.error("Failed to load prelims banner slides:", error);
    return normalizeBannerSlides([]);
  }
}

export async function savePrelimsBannerSlides(slides) {
  const adminSession = getAdminSessionHeader();
  if (!adminSession) {
    throw new Error("Admin session required to save banners.");
  }

  const normalizedSlides = normalizeBannerSlides(slides);
  const result = await request("/api/admin/prelims/banner-slides", "PUT", { slides: normalizedSlides }, {
    "x-admin-session": adminSession
  });

  return normalizeBannerSlides(Array.isArray(result.slides) ? result.slides : normalizedSlides);
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

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.toISOString().split("T")[0];
  };

  const today = new Date();
  const todayDate = today.toISOString().split("T")[0];

  const todayQuiz = dailyQuiz.find((test) => {
    const testDate = test.date || test.createdAt;
    const normalizedTestDate = normalizeDate(testDate);
    return normalizedTestDate === todayDate;
  });

  if (todayQuiz) {
    console.log("[Daily Quiz] Found today's quiz:", todayQuiz.testName, todayDate);
    return todayQuiz;
  }

  console.log("[Daily Quiz] No quiz uploaded for today:", todayDate);
  return null;
}

export function findTestById(tests, testId) {
  if (!testId) return null;
  return (tests || []).find((test) => test.id === testId) || null;
}
