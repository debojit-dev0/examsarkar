import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, Radio } from 'lucide-react';
import './Dashboard.css';
import { buildApiUrl } from '../../utils/apiBaseUrl';
import Navbar from "../../components/Navbar/Navbar";
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate(); // ✅ REQUIRED
  const [userName, setUserName] = useState('User');
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardStats, setDashboardStats] = useState(null);

  const testSeries = [
    {
      id: 1,
      title: 'Prelims Test Series',
      subtitle: 'Topic-wise and Full Length Prelims tests',
      icon: '📋',
      bgColor: '#E8F0FE',
      buttonColor: '#5B6BFF',
      buttonText: 'Explore',
    },
    {
      id: 2,
      title: 'CSAT Test Series',
      subtitle: 'Sharpen your aptitude and reasoning skills',
      icon: '🎓',
      bgColor: '#E0F7F0',
      buttonColor: '#10B981',
      buttonText: 'Explore',
    },
    {
      id: 3,
      title: 'Full Mock Tests',
      subtitle: 'Full length tests that simulate the real UPSC exam',
      icon: '💻',
      bgColor: '#F3E8FF',
      buttonColor: '#A855F7',
      buttonText: 'Explore',
    },
  ];

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
        const token = localStorage.getItem('token');

        // Fetch profile
        const profileRes = await fetch(buildApiUrl('/api/user/profile'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'Content-Type': 'application/json'
          }
        });

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUserName((profileData.profile && profileData.profile.firstName) || 'User');
        }

        // fetch stats
        const statsRes = await fetch(buildApiUrl('/api/stats'));
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          setDashboardStats(statsJson.stats || null);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      }
    };

    loadData();
  }, []);

  const streakDays = [
    { day: 'Mon', completed: true },
    { day: 'Tue', completed: true },
    { day: 'Wed', completed: true },
    { day: 'Thu', completed: true },
    { day: 'Fri', completed: true },
    { day: 'Sat', completed: true },
    { day: 'Sun', completed: false },
  ];
   

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
                <p className="stat-value">{dashboardStats?.currentStreak ?? 0} days</p>
                <p className="stat-change">Keep it up! 🔥</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon quiz-icon">📋</div>
              <div className="stat-content">
                <p className="stat-label">Quiz Attempts</p>
                <p className="stat-value">{dashboardStats?.quizzesAttempted ?? 0}/{dashboardStats?.quizzesTotal ?? 0}</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${dashboardStats?.attemptPercentage ?? 0}%` }}
                  ></div>
                </div>
                <p className="progress-text">{dashboardStats?.attemptPercentage ?? 0}%</p>
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

          {/* Explore Test Series */}
          <div className="explore-section">
            <div className="section-header">
              <h2 className="section-title">Explore Test Series</h2>
              <p className="section-subtitle">Choose the right test series for your preparation</p>
            </div>

            <div className="test-series-grid">
              {testSeries.map((series) => (
                <div 
                  key={series.id} 
                  className="test-series-card"
                  style={{ backgroundColor: series.bgColor }}
                >
                  <div className="series-icon">{series.icon}</div>
                  <h3 className="series-title">{series.title}</h3>
                  <p className="series-subtitle">{series.subtitle}</p>
                  <button 
                    className="series-button"
                    style={{ color: series.buttonColor }}
                  >
                    {series.buttonText} <ChevronRight size={18} />
                  </button>
                </div>
              ))}
            </div>
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
            <button className="challenge-button">
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
            <button className="test-now-button">Take a Test Now</button>
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

            <button className="join-test-button">
              Join Live Test <ChevronRight size={18} />
            </button>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity-card">
            <div className="card-header">
              <h3 className="card-title">Recent Quiz Activity</h3>
              <div className="card-action">View All</div>
            </div>

            <div className="recent-list">
              {recentActivity.map((item) => (
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
                    <button className="review-btn">Review</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Streak Calendar */}
          <div className="streak-card">
            <div className="card-header">
              <div className="header-left">
                <span className="fire-icon">🔥</span>
                <h3 className="card-title">Streak Calendar</h3>
              </div>
              <span className="streak-days-count">7 days</span>
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

            <p className="streak-message">You're on fire! 🔥 Keep going!</p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

  const recentActivity = [
    { id: 1, title: 'Polity Quiz - Fundamental Rights', score: '80%', time: '12 min', date: '24 May 2024' },
    { id: 2, title: 'History Quiz - Medieval India', score: '60%', time: '15 min', date: '22 May 2024' },
    { id: 3, title: 'Geography Quiz - World Mapping', score: '70%', time: '10 min', date: '20 May 2024' }
  ];

  const perfTiles = [
    { id: 1, label: 'Avg. Score', value: '--' },
    { id: 2, label: 'Best Score', value: '--' },
    { id: 3, label: 'Accuracy', value: '--' }
  ];

export default Dashboard;
