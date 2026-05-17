import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, Radio } from 'lucide-react';
import './Dashboard.css';
import { buildApiUrl } from '../../utils/apiBaseUrl';
import { handleUnauthorized } from '../../utils/apiErrorHandler';
import Navbar from "../../components/Navbar/Navbar";
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate(); // ✅ REQUIRED
  const [userName, setUserName] = useState('User');
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [purchaseData, setPurchaseData] = useState({ loading: true, purchasedPlans: [], accessibleTests: [] });
  const [userDashboard, setUserDashboard] = useState({
    performanceSnapshot: { avgScore: null, bestScore: null, accuracy: null },
    currentStreak: 0,
    quizAttempts: { attempted: 0, total: 0, attemptPercentage: 0 },
    recentQuizActivity: []
  });

  const [showAllActivity, setShowAllActivity] = useState(false);

  const liveTestUsers = [
    { name: 'User1', avatar: '👨' },
    { name: 'User2', avatar: '👨' },
    { name: 'User3', avatar: '👩' },
    { name: 'User4', avatar: '👩' },
    { name: 'User5', avatar: '👨' },
  ];



  useEffect(() => {
    const loadData = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');

        // FETCH PROFILE
        const profileRes = await fetch(buildApiUrl('/api/user/profile'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken || ''}`,
            'Content-Type': 'application/json'
          }
        });

        if (profileRes.status === 401) {
          handleUnauthorized();
          return;
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUserName((profileData.profile && profileData.profile.firstName) || 'User');
        }

        // FETCH STATS
        const statsRes = await fetch(buildApiUrl('/api/stats'));
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          setDashboardStats(statsJson.stats || null);
        }


        // FETCH USER DASHBOARD + UNLOCKED TESTS
        if (accessToken) {
          const dashboardRes = await fetch(buildApiUrl('/api/user/dashboard'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (dashboardRes.status === 401) {
            handleUnauthorized();
            return;
          }

          if (dashboardRes.ok) {
            const dashboardJson = await dashboardRes.json();
            setUserDashboard({
              performanceSnapshot: dashboardJson.performanceSnapshot || { avgScore: null, bestScore: null, accuracy: null },
              currentStreak: Number(dashboardJson.currentStreak || 0),
              quizAttempts: dashboardJson.quizAttempts || { attempted: 0, total: 0, attemptPercentage: 0 },
              recentQuizActivity: Array.isArray(dashboardJson.recentQuizActivity) ? dashboardJson.recentQuizActivity : []
            });
          }

          const testsRes = await fetch(buildApiUrl('/api/user/tests'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (testsRes.status === 401) {
            handleUnauthorized();
            return;
          }

          if (testsRes.ok) {
            const testsJson = await testsRes.json();
            setPurchaseData({
              loading: false,
              purchasedPlans: Array.isArray(testsJson.purchasedPlans) ? testsJson.purchasedPlans : [],
              accessibleTests: Array.isArray(testsJson.accessibleTests) ? testsJson.accessibleTests : []
            });
          } else {
            setPurchaseData({ loading: false, purchasedPlans: [], accessibleTests: [] });
          }
        } else {
          setPurchaseData({ loading: false, purchasedPlans: [], accessibleTests: [] });
          setUserDashboard({
            performanceSnapshot: { avgScore: null, bestScore: null, accuracy: null },
            currentStreak: 0,
            quizAttempts: { attempted: 0, total: 0, attemptPercentage: 0 },
            recentQuizActivity: []
          });
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
        setPurchaseData({ loading: false, purchasedPlans: [], accessibleTests: [] });
      }
    };

    loadData();
  }, []);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const streakDays = weekDays.map((day, idx) => ({
    day,
    completed: idx < Math.min(userDashboard.currentStreak, weekDays.length)
  }));

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
  const perfTiles = [
    {
      id: 1,
      label: 'Avg. Score',
      value: userDashboard.performanceSnapshot.avgScore !== null ? `${userDashboard.performanceSnapshot.avgScore}%` : '--'
    },
    {
      id: 2,
      label: 'Best Score',
      value: userDashboard.performanceSnapshot.bestScore !== null ? `${userDashboard.performanceSnapshot.bestScore}%` : '--'
    },
    {
      id: 3,
      label: 'Accuracy',
      value: userDashboard.performanceSnapshot.accuracy !== null ? `${userDashboard.performanceSnapshot.accuracy}%` : '--'
    }
  ];
   

  const handleNavigateToTest = () => {
    if (primaryTest?.id) {
      navigate(`/test/${primaryTest.id}`, { state: { testId: primaryTest.id } });
      return;
    }
    navigate('/test-series');
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
              <div className="stat-icon users-icon">👥</div>
              <div className="stat-content">
                <p className="stat-label">Total Registered Users</p>
                <p className="stat-value">{(dashboardStats?.totalRegistered ?? 0).toLocaleString()}</p>
                <p className="stat-change">+{(dashboardStats?.weeklyIncrease ?? 0).toLocaleString()} this week</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon live-icon">🟢</div>
              <div className="stat-content">
                <p className="stat-label">Live Now Users</p>
                <p className="stat-value">{dashboardStats?.liveNow ?? 0}</p>
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
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search for topics, test series or quizzes..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

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
                      <button className="review-btn" type="button" onClick={() => navigate('/test-series')}>
                        Start
                      </button>
                    </div>
                  ))}
                </div>
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
        </div>

        {/* Right Section */}
        <div className="dashboard-right">
          {/* Performance Snapshot */}
          <div className="performance-card">
            <div className="card-header">
              <h3 className="card-title">Your Performance Snapshot</h3>
              <div className="card-icon">📊</div>
            </div>

            <div className="performance-tiles">
              {perfTiles.map((t) => (
                <div key={t.id} className="perf-tile">
                  <p className="tile-label">{t.label}</p>
                  <p className="tile-value">{t.value}</p>
                </div>
              ))}
            </div>

            <div className="performance-chart">
              <svg viewBox="0 0 100 60" className="chart-svg">
                <rect x="10" y="40" width="8" height="20" fill="#D1D5DB" />
                <rect x="22" y="30" width="8" height="30" fill="#D1D5DB" />
                <rect x="34" y="20" width="8" height="40" fill="#6366F1" />
                <rect x="46" y="25" width="8" height="35" fill="#D1D5DB" />
                <text x="50" y="58" fontSize="8" fill="#999">Chart</text>
              </svg>
            </div>

            <p className="performance-text">Attempt tests to see your performance insights.</p>
            <button className="test-now-button" onClick={handleNavigateToTest}>Take a Test Now</button>
          </div>

          {/* Live Test Now */}
          <div className="live-test-card">
            <div className="card-header">
              <div className="header-left">
                <Radio size={20} className="live-icon-small" />
                <h3 className="card-title">Live Test Now</h3>
              </div>
              <span className="live-badge">● LIVE</span>
            </div>

            <p className="live-description">348 learners are taking</p>
            <p className="live-test-title">Free Prelims Test – Polity</p>

            <div className="live-users">
              {liveTestUsers.map((user, idx) => (
                <div key={idx} className="user-avatar">{user.avatar}</div>
              ))}
              <span className="more-users">+343</span>
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
