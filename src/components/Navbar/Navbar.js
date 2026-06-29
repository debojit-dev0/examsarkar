import "./Navbar.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { buildApiUrl } from "../../utils/apiBaseUrl";

import { fetchWithErrorHandling } from "../../utils/apiErrorHandler";
import { clearStoredAuthSession } from "../../api/authApi";

export default function Navbar({
  onLoginClick,
  onSignupClick,
  onHomeClick,
  onPlansClick,
  onMainsClick 
}) {
  const [user, setUser] = useState(null);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const profileSectionRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const navigateTo = (path) => {
    navigate(path);
    scrollToTop();
  };

  // ✅ Get user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ✅ Fetch profile data when dropdown opens
  const fetchProfileData = useCallback(async () => {
    try {
      // Read token from storage
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (!token) {
        setProfileData((current) => current || user);
        return;
      }

      const response = await fetchWithErrorHandling(buildApiUrl("/api/user/profile"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      const data = await response.json();
      // server returns { profile: { ... } }
      setProfileData(data.profile);
    } catch (error) {
      console.error("Profile fetch error:", error);
      // Keep showing the locally stored user details if the profile request fails.
      setProfileData((current) => current || user);
    }
  }, [user]);

  useEffect(() => {
    if (profileDropdown && user && !profileData) {
      fetchProfileData();
    }
  }, [profileDropdown, user, profileData, fetchProfileData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileDropdown &&
        profileSectionRef.current &&
        !profileSectionRef.current.contains(event.target)
      ) {
        setProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdown]);

  // ✅ Logout function
  const handleLogout = () => {
    clearStoredAuthSession();
    setUser(null);
    setProfileData(null);
    setProfileDropdown(false);
    navigateTo("/");
  };

  // ✅ Get user initials for avatar
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    return user?.firstName ? user.firstName[0].toUpperCase() : "U";
  };

  const visibleProfile = profileData || user;
  const handleHomeClick = () => {
    if (location.pathname === "/") {
      if (onHomeClick) {
        onHomeClick();
      } else {
        scrollToTop();
      }
      return;
    }

    if (onHomeClick && location.pathname === "/") {
      onHomeClick();
      return;
    }

    navigateTo("/");
  };

  const handlePlansClick = () => {
    if (onPlansClick) {
      onPlansClick();
      return;
    }

    navigateTo("/test-series");
  };
  const handleMainsClick = () => {
    if (onMainsClick) {
      onMainsClick();
      return;
    }

    navigateTo("/mains-test-series");
  };

  return (
    <header className="navbar">
      <div
        className="logo"
        onClick={handleHomeClick}
        style={{ cursor: "pointer" }}
      >
        <span className="logo-primary">Exam</span>
        <span className="logo-accent">Sarkar</span>
      </div>
      <nav className="nav-links">
        <button type="button" className="nav-link" onClick={handleHomeClick}>
          Home
        </button>

        <button type="button" className="nav-link" onClick={handlePlansClick}>
         Prelims Test Series
        </button>
        <button type="button" className="nav-link" onClick={handleMainsClick}>
         Mains Test Series
        </button>


        {/* ✅ Show Quiz only after login */}
        {user && (
          <button
            type="button"
            className="nav-link"
            onClick={() => navigateTo("/dashboard")}
          >
            Dashboard
          </button>
        )}
      </nav>

      <div className="nav-actions">
        {/* ✅ LOGGED IN USER: Profile Dropdown */}
        {user ? (
          <div className="profile-section" ref={profileSectionRef}>
            {/* Profile Button */}
            <button
              className="profile-btn"
              onClick={() => setProfileDropdown(!profileDropdown)}
              title={user.firstName}
            >
              <div className="profile-avatar">
                {getUserInitials()}
              </div>
              <ChevronDown size={16} className="chevron" />
            </button>

            {/* Dropdown Menu */}
            {profileDropdown && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    {getUserInitials()}
                  </div>
                  <div className="profile-info">
                    <h3 className="name">{user.firstName} {user.lastName}</h3>
                    <p className="email">{visibleProfile?.email || user.email}</p>
                  </div>
                </div>

                {/* Profile Info */}
                <div className="profile-content">
                  {visibleProfile ? (
                    <>
                      <div className="profile-detail">
                        <span className="detail-label">First Name:</span>
                        <span className="detail-value">{visibleProfile.firstName}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Last Name:</span>
                        <span className="detail-value">{visibleProfile.lastName}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{visibleProfile.email}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">{visibleProfile.phone || "Not provided"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="loading-text">Loading...</div>
                  )}
                </div>

                {/* Logout Button */}
                <div className="profile-footer">
                  <button
                    className="logout-btn"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ✅ NOT LOGGED IN: Login/Register Buttons
          <>
            <button className="login" onClick={onLoginClick}>
              Login
            </button>

            <button className="signup" onClick={onSignupClick}>
              Register
            </button>
          </>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {profileDropdown && (
        <div
          className="dropdown-overlay"
          onClick={() => setProfileDropdown(false)}
        ></div>
      )}
    </header>
  );
}
