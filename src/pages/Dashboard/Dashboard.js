import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, Radio } from 'lucide-react';
import './Dashboard.css';
import { buildApiUrl } from '../../utils/apiBaseUrl';
import { fetchWithErrorHandling } from '../../utils/apiErrorHandler';
import Navbar from "../../components/Navbar/Navbar";
import ScholarshipTest from "../../components/ScholarshipTest/ScholarshipTest";
import { useNavigate } from 'react-router-dom';
import { loadPendingAttempts, loadRecentQuizActivity, mergeRecentQuizActivity, removeRecentQuizActivity, saveRecentQuizActivity, setPendingAttempts } from '../../utils/recentQuizActivityStore';
import { useSEO } from '../../hooks/useSEO';
import { loadSupabasePapers } from '../../utils/supabasePapersStore';
const MAINS_SUBJECT_INFO = {
  gs1: { label: 'GS Paper I', icon: '📜', color: '#ff6b6b', sub: 'History • Geography • Society' },
  gs2: { label: 'GS Paper II', icon: '⚖️', color: '#4dabf7', sub: 'Polity • Governance • IR' },
  gs3: { label: 'GS Paper III', icon: '🌱', color: '#51cf66', sub: 'Economy • Environment • Security' },
  gs4: { label: 'GS Paper IV', icon: '🧭', color: '#ffd43b', sub: 'Ethics • Integrity • Aptitude' },
  essay: { label: 'Essay Writing', icon: '✍️', color: '#b197fc', sub: 'UPSC Essay Practice' }
};

function MainsCountdown({ durationMinutes, startedAt }) {
  const [timeLeft, setTimeLeft] = React.useState(null);

  React.useEffect(() => {
    if (!startedAt || !durationMinutes) return;
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, durationMinutes]);

  if (timeLeft === null) return null;

  if (timeLeft <= 0) {
    return <span className="mains-timer expired">⏰ Time Expired</span>;
  }

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;
  const fmt = (n) => String(n).padStart(2, '0');
  const urgent = timeLeft < 600;

  return (
    <span className={`mains-timer${urgent ? ' urgent' : ''}`}>
      ⏱ {fmt(h)}:{fmt(m)}:{fmt(s)} remaining
    </span>
  );
}

const Dashboard = () => {
  useSEO({
    title: "My Dashboard – Test History & Performance",
    description: "View your UPSC exam test history, quiz scores, and performance analytics on ExamSarkar.",
    url: "https://www.examsarkar.com/dashboard",
    noindex: true,
  });
  const navigate = useNavigate();
  const [userName, setUserName] = useState('User');
  const [purchaseData, setPurchaseData] = useState({ loading: true, purchasedPlans: [], accessibleTests: [] });
  const [mainsPurchases, setMainsPurchases] = useState([]);
  const [mainsLoading, setMainsLoading] = useState(true);
  const [mainsUploadStatus, setMainsUploadStatus] = useState({});
  const [userDashboard, setUserDashboard] = useState({
    performanceSnapshot: { avgScore: null, bestScore: null, accuracy: null },
    currentStreak: 0,
    quizAttempts: { attempted: 0, total: 0, attemptPercentage: 0 },
    recentQuizActivity: []
  });

  const [showAllActivity, setShowAllActivity] = useState(false);

  const toLocalDayKey = useCallback((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-CA");
  }, []);

  const computeLocalStreak = useCallback((activities) => {
    if (!Array.isArray(activities) || activities.length === 0) return 0;

    const attemptDays = new Set(
      activities
        .map((activity) => toLocalDayKey(activity.submittedAt || activity.timestamp || activity.createdAt))
        .filter(Boolean)
    );

    const sortedDays = Array.from(attemptDays).sort().reverse();
    const latestDay = sortedDays[0];
    if (!latestDay) return 0;

    const parseDayKey = (dayKey) => new Date(`${dayKey}T00:00:00`);
    const cursor = parseDayKey(latestDay);
    if (Number.isNaN(cursor.getTime())) return 0;

    let streak = 0;
    while (true) {
      const dayKey = toLocalDayKey(cursor);
      if (!dayKey || !attemptDays.has(dayKey)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }, [toLocalDayKey]);

  const syncPendingAttempts = useCallback(async (accessToken) => {
    if (!accessToken) return;

    const pending = loadPendingAttempts();
    if (!pending.length) return;

    const remaining = [];

    for (const payload of pending) {
      try {
        const response = await fetchWithErrorHandling(buildApiUrl("/api/user/test-attempts"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const savedData = await response.json().catch(() => null);
          if (savedData?.attemptId) {
            const tempKey = `${payload.testId}-${payload.submittedAt}`;
            removeRecentQuizActivity(tempKey);
            saveRecentQuizActivity({
              id: savedData.attemptId,
              attemptId: savedData.attemptId,
              testId: payload.testId,
              title: payload.testName,
              score: `${Math.round(Number(payload.score || 0))}%`,
              accuracy: `${Math.round(Number(payload.accuracy || 0))}%`,
              attempted: payload.attempted,
              total: payload.total,
              submittedAt: savedData.submittedAt || payload.submittedAt,
              time: `${Math.max(Number(payload.attempted || 0), 1)} questions`,
              date: new Date(savedData.submittedAt || payload.submittedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })
            });
          }
        } else {
          remaining.push(payload);
        }
      } catch (error) {
        remaining.push(payload);
      }
    }

    setPendingAttempts(remaining);
  }, []);

  const liveTestUsers = [
    { name: 'User1', avatar: '👨' },
    { name: 'User2', avatar: '👨' },
    { name: 'User3', avatar: '👩' },
    { name: 'User4', avatar: '👩' },
    { name: 'User5', avatar: '👨' },
  ];



  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      let fastLoadTimerId = null;
      try {
        const accessToken = localStorage.getItem('accessToken');
        const localActivities = loadRecentQuizActivity();

        if (localActivities.length > 0) {
          const localAttempted = localActivities.length;
          setUserDashboard((current) => ({
            ...current,
            quizAttempts: {
              attempted: localAttempted,
              total: localAttempted,
              attemptPercentage: localAttempted > 0 ? 100 : 0
            },
            recentQuizActivity: localActivities
          }));
        }

        if (!accessToken) {
          setPurchaseData({ loading: false, purchasedPlans: [], accessibleTests: [] });
          setUserDashboard({
            performanceSnapshot: { avgScore: null, bestScore: null, accuracy: null },
            currentStreak: 0,
            quizAttempts: { attempted: 0, total: 0, attemptPercentage: 0 },
            recentQuizActivity: []
          });
          return;
        }

        await syncPendingAttempts(accessToken);

        const profileRequest = fetchWithErrorHandling(buildApiUrl('/api/user/profile'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const dashboardRequest = fetchWithErrorHandling(buildApiUrl('/api/user/dashboard'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const testsRequest = fetchWithErrorHandling(buildApiUrl('/api/user/tests'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        fastLoadTimerId = setTimeout(() => {
          if (!isActive) return;
          setPurchaseData((current) => ({
            loading: false,
            purchasedPlans: current.purchasedPlans || [],
            accessibleTests: current.accessibleTests || []
          }));
        }, 1200);

        const mainsRequest = fetchWithErrorHandling(buildApiUrl('/api/user/mains/purchases'), {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        const [profileRes, dashboardRes, testsRes, mainsRes] = await Promise.all([
          profileRequest,
          dashboardRequest,
          testsRequest,
          mainsRequest
        ]);

        if (profileRes?.ok) {
          const profileData = await profileRes.json();
          setUserName((profileData.profile && profileData.profile.firstName) || 'User');
        }

        if (dashboardRes?.ok) {
          const dashboardJson = await dashboardRes.json();
          const latestLocalActivities = loadRecentQuizActivity();
          const mergedActivities = mergeRecentQuizActivity(dashboardJson.recentQuizActivity, latestLocalActivities);
          const fallbackRecent = Array.isArray(dashboardJson.recentQuizActivity)
            ? dashboardJson.recentQuizActivity
            : [];
          const recentActivityList = mergedActivities.length > 0 ? mergedActivities : fallbackRecent;
          const fallbackAttempts = mergedActivities.length;
          const quizAttempts = dashboardJson.quizAttempts || {};
          const mergedAttemptCount = Array.isArray(mergedActivities) ? mergedActivities.length : 0;
          const attempted = Math.max(
            Number(quizAttempts.attempted ?? 0),
            Number(fallbackAttempts ?? 0),
            mergedAttemptCount
          );
          const total = Number(quizAttempts.total ?? attempted ?? 0);
          const attemptPercentage = Number(
            quizAttempts.attemptPercentage ?? (total > 0 ? Math.round((attempted / total) * 100) : 0)
          );
          const localStreak = computeLocalStreak(recentActivityList);
          const resolvedStreak = Math.max(Number(dashboardJson.currentStreak || 0), localStreak);
          setUserDashboard({
            performanceSnapshot: dashboardJson.performanceSnapshot || { avgScore: null, bestScore: null, accuracy: null },
            currentStreak: resolvedStreak,
            quizAttempts: {
              attempted,
              total,
              attemptPercentage
            },
            recentQuizActivity: recentActivityList
          });
        } else if (localActivities.length > 0) {
          const fallbackAttempts = localActivities.length;
          setUserDashboard((current) => ({
            ...current,
            quizAttempts: {
              attempted: fallbackAttempts,
              total: fallbackAttempts,
              attemptPercentage: fallbackAttempts > 0 ? 100 : 0
            },
            recentQuizActivity: localActivities
          }));
        }

       if (testsRes?.ok) {
          const testsJson = await testsRes.json();
          const purchasedPlans = Array.isArray(testsJson.purchasedPlans) ? testsJson.purchasedPlans : [];
          const accessibleTests = Array.isArray(testsJson.accessibleTests) ? testsJson.accessibleTests : [];

          const accessWindow = testsJson.accessWindow || purchasedPlans?.[0]?.accessWindow || null;
          let supabasePapers = [];
          try {
            supabasePapers = await loadSupabasePapers(accessWindow);
          } catch (supabaseErr) {
            console.error('Failed to load Supabase papers:', supabaseErr);
          }

          setPurchaseData({
            loading: false,
            purchasedPlans,
            accessibleTests: [...accessibleTests, ...supabasePapers]
          });
        } else {
          setPurchaseData({ loading: false, purchasedPlans: [], accessibleTests: [] });
        }

        if (mainsRes?.ok) {
          const mainsJson = await mainsRes.json();
          setMainsPurchases(Array.isArray(mainsJson.mainsPurchases) ? mainsJson.mainsPurchases : []);
        }
        setMainsLoading(false);
      } catch (err) {
        console.error('Dashboard load error:', err);
        if (isActive) setMainsLoading(false);
      } finally {
        if (fastLoadTimerId) {
          clearTimeout(fastLoadTimerId);
        }
        if (isActive) {
          setPurchaseData((current) => ({
            loading: false,
            purchasedPlans: current.purchasedPlans || [],
            accessibleTests: current.accessibleTests || []
          }));
          setMainsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [computeLocalStreak, syncPendingAttempts]);

  const getStreakDays = (activities) => {
    const attemptDays = new Set(
      (Array.isArray(activities) ? activities : [])
        .map((activity) => toLocalDayKey(activity.submittedAt || activity.timestamp || activity.createdAt))
        .filter(Boolean)
    );

    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7; // Monday=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayIndex);

    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      const dayKey = toLocalDayKey(date);
      return {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        completed: dayKey ? attemptDays.has(dayKey) : false
      };
    });
  };

  const streakDays = getStreakDays(userDashboard.recentQuizActivity);

  const seriesTheme = {
    gs: { bgColor: '#E8F0FE', icon: '📋', color: '#5B6BFF', label: 'GS / GE' },
    csat: { bgColor: '#E0F7F0', icon: '🎓', color: '#10B981', label: 'CSAT' },
    combo: { bgColor: '#F3E8FF', icon: '💻', color: '#A855F7', label: 'Combo' },
    all: { bgColor: '#FFF7ED', icon: '✨', color: '#F59E0B', label: 'All Access' }
  };

  const unlockedSeries = purchaseData.purchasedPlans.length > 0
    ? purchaseData.purchasedPlans
    : [];

  // Filter out old daily quizzes - only keep today's daily quiz if available
  const getFilteredTests = (tests) => {
    if (!Array.isArray(tests)) return [];
    
    const today = new Date().toISOString().split("T")[0];
    const filteredTests = tests.filter((test) => {
      // If it's a daily quiz, only show if it's for today
      if (test.type === "daily-quiz") {
        const testDate = test.date ? test.date.split("T")[0] : null;
        return testDate === today;
      }
      // Keep all non-daily-quiz tests
      return true;
    });
    
    return filteredTests;
  };

  const unlockedTests = purchaseData.purchasedPlans.length > 0 ? getFilteredTests(purchaseData.accessibleTests).slice(0, 6) : [];
  const recentActivity = Array.isArray(userDashboard.recentQuizActivity)
    ? userDashboard.recentQuizActivity
    : [];
  const displayedActivity = showAllActivity ? recentActivity : recentActivity.slice(0, 5);
  const primaryTest = getFilteredTests(purchaseData.accessibleTests)[0] || null;
  const [liveNowUsers] = useState(() => Math.floor(Math.random() * 701) + 300);
  const liveTestMoreUsers = Math.max(liveNowUsers - liveTestUsers.length, 0);
   

  const handleNavigateToTest = () => {
    if (primaryTest?.id) {
      navigate(`/test/${primaryTest.id}`, { state: { testId: primaryTest.id } });
      return;
    }
    navigate('/test-series');
  };

  const handleMainsDownload = async (subject) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetchWithErrorHandling(buildApiUrl(`/api/mains/papers/${subject}`), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res?.ok) {
        alert('Question paper not available yet. Please try again later.');
        return;
      }
      const data = await res.json();
      // Trigger PDF download from base64
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdfBase64}`;
      link.download = data.fileName || `mains-${subject}-question-paper.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Refresh mains purchases to update startedAt
      const refreshRes = await fetchWithErrorHandling(buildApiUrl('/api/user/mains/purchases'), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (refreshRes?.ok) {
        const json = await refreshRes.json();
        setMainsPurchases(Array.isArray(json.mainsPurchases) ? json.mainsPurchases : []);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download question paper.');
    }
  };

  const handleMainsAnswerUpload = async (subject, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('File too large. Maximum size is 4MB.');
      return;
    }
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;

    setMainsUploadStatus((prev) => ({ ...prev, [subject]: 'uploading' }));
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const res = await fetchWithErrorHandling(buildApiUrl('/api/user/mains/answer'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, pdfBase64: base64, fileName: file.name })
        });
        if (res?.ok) {
          setMainsUploadStatus((prev) => ({ ...prev, [subject]: 'success' }));
          setMainsPurchases((prev) => prev.map((p) =>
            p.subject === subject ? { ...p, hasSubmitted: true } : p
          ));
        } else {
          setMainsUploadStatus((prev) => ({ ...prev, [subject]: 'error' }));
          alert('Failed to submit answer sheet. Please try again.');
        }
      };
      reader.onerror = () => {
        setMainsUploadStatus((prev) => ({ ...prev, [subject]: 'error' }));
        alert('Failed to read file.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Answer upload error:', err);
      setMainsUploadStatus((prev) => ({ ...prev, [subject]: 'error' }));
      alert('Failed to submit answer sheet.');
    }
  };

  const streakMessage = userDashboard.currentStreak >= 3
    ? "You're on fire! Keep going!"
    : userDashboard.currentStreak > 0
      ? "Good start. Build your streak!"
      : "Start your streak with today's quiz.";

  const streakLabel = userDashboard.currentStreak > 0
    ? "Keep it up!"
    : "Start a streak today.";

  return (
    <>
      {/* ✅ Navbar added correctly */}
      <Navbar
        onHomeClick={() => navigate("/")}
        onPlansClick={() => navigate("/test-series")}
      />
    
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        {/* Left Section */}
        <div className="dashboard-left">
          {/* Welcome Header */}
          <div className="welcome-section">
            <h1 className="welcome-title">Welcome back, {userName}! 👋</h1>
            <p className="welcome-subtitle">
              Keep learning, keep growing. Your <span className="upsc-text">UPSC journey</span> is just getting started.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-icon live-icon">🟢</div>
              <div className="stat-content">
                <p className="stat-label">Live Now Users</p>
                <p className="stat-value">{liveNowUsers}</p>
                <p className="stat-change">Online & learning</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon streak-icon">🔥</div>
              <div className="stat-content">
                <p className="stat-label">Current Streak</p>
                <p className="stat-value">{userDashboard.currentStreak} days</p>
                <p className="stat-change">{streakLabel}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon quiz-icon">📋</div>
              <div className="stat-content">
                <p className="stat-label">Quiz Attempts</p>
                <p className="stat-value">{userDashboard.quizAttempts.attempted ?? 0}/{userDashboard.quizAttempts.total ?? 0}</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${userDashboard.quizAttempts.attemptPercentage ?? 0}%` }}
                  ></div>
                </div>
                <p className="progress-text">{userDashboard.quizAttempts.attemptPercentage ?? 0}%</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          

          {/* Purchased Test Series */}
          <div className="explore-section">
            <div className="section-header">
              <h2 className="section-title">Your Purchased Test Series</h2>
              <p className="section-subtitle">
                {purchaseData.loading
                  ? 'Loading unlocked tests...'
                  : unlockedSeries.length > 0
                    ? 'Your payment has unlocked the series below.'
                    : 'Buy a plan to unlock the tests uploaded by admin.'}
              </p>
            </div>

            <div className="test-series-grid">
              {purchaseData.loading ? (
                <div className="test-series-card loading-card">
                  <h3 className="series-title">Checking your access...</h3>
                  <p className="series-subtitle">Please wait while we load your purchases.</p>
                </div>
              ) : unlockedSeries.length > 0 ? (
                unlockedSeries.map((series) => {
                  const subjectKey = series.planSubject || 'all';
                  const theme = seriesTheme[subjectKey] || seriesTheme.all;
                  const previewTests = Array.isArray(series.tests) ? series.tests.slice(0, 3).map((test) => test.testName).join(' • ') : '';

                  return (
                    <div
                      key={series.planKey}
                      className="test-series-card"
                      style={{ backgroundColor: theme.bgColor }}
                    >
                      <div className="series-icon">{theme.icon}</div>
                      <h3 className="series-title">{series.planName || `${series.planPeriod} ${theme.label}`}</h3>
                      <p className="series-subtitle">{series.count} tests unlocked</p>
                      {series.expiresAt && (
                        <p className="series-subtitle" style={{ color: '#e53e3e', fontSize: '0.75rem' }}>
                          Access expires: {new Date(series.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      <p className="series-subtitle series-preview">{previewTests || 'New tests will appear here when admin uploads them.'}</p>
                      <button
                        className="series-button"
                        style={{ color: theme.color }}
                        onClick={() => navigate('/test-series')}
                      >
                        Open Series <ChevronRight size={18} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="test-series-card empty-series-card">
                  <div className="series-icon">🔒</div>
                  <h3 className="series-title">No purchased tests yet</h3>
                  <p className="series-subtitle">Complete a payment to unlock the GS / CSAT series added by admin.</p>
                  <button className="series-button" style={{ color: '#5B6BFF' }} onClick={() => navigate('/test-series')}>
                    View Plans <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {unlockedTests.length > 0 && (
              <div className="unlocked-tests-panel">
                <div className="unlocked-tests-header">
                  <h3>Unlocked Tests</h3>
                  <span>{purchaseData.accessibleTests.length} available</span>
                </div>
                <div className="unlocked-tests-list">
                  {unlockedTests.map((test) => (
                    <div key={test.id} className="unlocked-test-item">
                      <div>
                        <p className="unlocked-test-title">{test.testName}</p>
                        <p className="unlocked-test-meta">
                          {String(test.subject || 'all').toUpperCase()} • {String(test.type || 'daily').toUpperCase()} • {test.questionCount} questions
                        </p>
                      </div>
                      <button className="review-btn" type="button" onClick={() => navigate(`/test/${test.id}`, { state: { testId: test.id } })}>
                        Start
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          

          {/* Mains Test Series */}
          <div className="explore-section" style={{ marginTop: '24px' }}>
            <div className="section-header">
              <h2 className="section-title">Your Mains Test Series</h2>
              <p className="section-subtitle">
                {mainsLoading
                  ? 'Loading your mains access...'
                  : mainsPurchases.length > 0
                    ? 'Download question papers and submit your answer sheets.'
                    : 'Purchase a Mains subject to get access to question papers.'}
              </p>
            </div>

            {mainsLoading ? (
              <div className="test-series-card loading-card">
                <h3 className="series-title">Loading mains access...</h3>
              </div>
            ) : mainsPurchases.length === 0 ? (
              <div className="test-series-card empty-series-card">
                <div className="series-icon">📝</div>
                <h3 className="series-title">No Mains papers purchased</h3>
                <p className="series-subtitle">Buy a Mains subject at ₹99 to get access to question papers and submit answers.</p>
                <button className="series-button" style={{ color: '#5B6BFF' }} onClick={() => navigate('/mains-test-series')}>
                  View Mains Plans <ChevronRight size={18} />
                </button>
              </div>
            ) : (
              <div className="mains-dashboard-grid">
                {mainsPurchases.map((mp) => {
                  const info = MAINS_SUBJECT_INFO[mp.subject] || { label: mp.planName, icon: '📄', color: '#888', sub: '' };
                  const uploadState = mainsUploadStatus[mp.subject];
                  const timerStarted = Boolean(mp.startedAt);
                  const endTime = mp.startedAt
                    ? new Date(mp.startedAt).getTime() + mp.durationMinutes * 60 * 1000
                    : null;
                  const timeExpired = endTime ? Date.now() > endTime : false;

                  return (
                    <div key={mp.subject} className="mains-dashboard-card" style={{ borderTop: `4px solid ${info.color}` }}>
                      <div className="mains-dash-header">
                        <span className="mains-dash-icon">{info.icon}</span>
                        <div>
                          <h3 className="mains-dash-title">{info.label}</h3>
                          <p className="mains-dash-sub">{info.sub}</p>
                        </div>
                      </div>

                      {!mp.hasPaper && (
                        <p className="mains-paper-status pending">Question paper not yet uploaded by admin.</p>
                      )}

                      {mp.hasPaper && !timerStarted && (
                        <button
                          className="mains-download-btn"
                          onClick={() => handleMainsDownload(mp.subject)}
                        >
                          ⬇ Download Question Paper
                        </button>
                      )}

                      {timerStarted && (
                        <div className="mains-timer-row">
                          <MainsCountdown durationMinutes={mp.durationMinutes} startedAt={mp.startedAt} />
                        </div>
                      )}

                      {timerStarted && !timeExpired && (
                        <div className="mains-upload-section">
                          {mp.hasSubmitted || uploadState === 'success' ? (
                            <p className="mains-submitted-badge">✅ Answer sheet submitted</p>
                          ) : (
                            <>
                              <label className="mains-upload-btn" htmlFor={`upload-${mp.subject}`}>
                                {uploadState === 'uploading' ? '⏳ Uploading...' : '📤 Upload Answer Sheet (PDF)'}
                              </label>
                              <input
                                id={`upload-${mp.subject}`}
                                type="file"
                                accept="application/pdf"
                                style={{ display: 'none' }}
                                disabled={uploadState === 'uploading'}
                                onChange={(e) => handleMainsAnswerUpload(mp.subject, e.target.files?.[0])}
                              />
                              {uploadState === 'error' && (
                                <p className="mains-upload-error">Upload failed. Please try again.</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {timeExpired && !mp.hasSubmitted && uploadState !== 'success' && (
                        <p className="mains-paper-status expired">⏰ Time expired. You can no longer submit.</p>
                      )}

                      {mp.hasPaper && timerStarted && (
                        <button
                          className="mains-redownload-btn"
                          onClick={() => handleMainsDownload(mp.subject)}
                        >
                          ⬇ Download Again
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Daily Challenge */}
          <div className="daily-challenge-section">
            <div className="challenge-content">
              <div className="challenge-icon">🏆</div>
              <div className="challenge-text">
                <h3 className="challenge-title">Daily Challenge</h3>
                <p className="challenge-subtitle">Attempt today's quiz and build your streak.</p>
              </div>
            </div>
            <button className="challenge-button" onClick={handleNavigateToTest}>
              Attempt Now <ChevronRight size={20} />
            </button>
          </div>
            {/* Scholarship Test */}
          <div className="explore-section" style={{ marginTop: '24px' }}>
            <ScholarshipTest />
          </div>
        </div>

        {/* Right Section */}
        <div className="dashboard-right">
          {/* Live Test Now */}
          <div className="live-test-card">
            <div className="card-header">
              <div className="header-left">
                <Radio size={20} className="live-icon-small" />
                <h3 className="card-title">Live Test Now</h3>
              </div>
              <span className="live-badge">● LIVE</span>
            </div>

            <p className="live-description">{liveNowUsers} learners are taking</p>
            <p className="live-test-title">Free Prelims Test – Polity</p>

            <div className="live-users">
              {liveTestUsers.map((user, idx) => (
                <div key={idx} className="user-avatar">{user.avatar}</div>
              ))}
              <span className="more-users">+{liveTestMoreUsers}</span>
            </div>

            <button className="join-test-button" onClick={handleNavigateToTest}>
              Join Live Test <ChevronRight size={18} />
            </button>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity-card">
            <div className="card-header">
              <h3 className="card-title">Recent Quiz Activity</h3>
              <button
                type="button"
                className="card-action"
                onClick={() => setShowAllActivity((prev) => !prev)}
              >
                {showAllActivity ? "View Less" : "View All"}
              </button>
            </div>

            <div className="recent-list">
              {displayedActivity.length > 0 ? displayedActivity.map((item) => (
                <div className="recent-item" key={item.id}>
                  <div className="recent-left">
                    <div className="recent-icon">📘</div>
                    <div>
                      <p className="recent-title">{item.title}</p>
                      <p className="recent-meta">{item.time} • {item.date}</p>
                    </div>
                  </div>
                  <div className="recent-right">
                    <div className="recent-score">{item.score}</div>
                    <button
                      className="review-btn"
                      onClick={() => {
                        if (item.testId && item.id) {
                          navigate(`/test/${item.testId}?attemptId=${item.id}`);
                        }
                      }}
                    >
                      Review
                    </button>
                  </div>
                </div>
              )) : (
                <div className="recent-item">
                  <div className="recent-left">
                    <div className="recent-icon">📝</div>
                    <div>
                      <p className="recent-title">No quiz attempts yet</p>
                      <p className="recent-meta">Attempt a test to see your activity here.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Streak Calendar */}
          <div className="streak-card">
            <div className="card-header">
              <div className="header-left">
                <span className="fire-icon">🔥</span>
                <h3 className="card-title">Streak Calendar</h3>
              </div>
              <span className="streak-days-count">{userDashboard.currentStreak} days</span>
            </div>

            <div className="streak-days-container">
              {streakDays.map((day, idx) => (
                <div 
                  key={idx} 
                  className={`streak-day ${day.completed ? 'completed' : 'empty'}`}
                >
                  <span className="day-name">{day.day}</span>
                  {day.completed && <span className="check-mark">✓</span>}
                </div>
              ))}
            </div>

            <p className="streak-message">{streakMessage}</p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Dashboard;
