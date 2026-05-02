import "./Navbar.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { buildApiUrl } from "../../utils/apiBaseUrl";

export default function Navbar({
  onLoginClick,
  onSignupClick,
  onHomeClick,
  onPlansClick
}) {
  const [user, setUser] = useState(null);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const profileSectionRef = useRef(null);
  const navigate = useNavigate();

  // ✅ Get user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // ✅ Fetch profile data when dropdown opens
  useEffect(() => {
    if (profileDropdown && user && !profileData) {
      fetchProfileData();
    }
  }, [profileDropdown, user, profileData]);

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

  const fetchProfileData = async () => {
    try {
      
      // Read token from storage
      const token = localStorage.getItem("token");
      const response = await fetch(
        buildApiUrl("/api/user/profile"),
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token || ""}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      // server returns { profile: { ... } }
      setProfileData(data.profile);
    } catch (error) {
      console.error("Profile fetch error:", error);
      setProfileData(null);
    }
  };

  // ✅ Logout function
  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    setProfileData(null);
    setProfileDropdown(false);
    navigate("/");
  };

  // ✅ Get user initials for avatar
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }
    return user?.firstName ? user.firstName[0].toUpperCase() : "U";
  };

  return (
    <header className="navbar">
      <div
        className="logo"
        onClick={onHomeClick}
        style={{ cursor: "pointer" }}
      >
        <span className="logo-primary">Exam</span>
        <span className="logo-accent">Sarkar</span>
      </div>
      <nav className="nav-links">
        <button type="button" className="nav-link" onClick={onHomeClick}>
          Home
        </button>

        <button type="button" className="nav-link" onClick={onPlansClick}>
          Test Series
        </button>

        {/* ✅ Show Quiz only after login */}
        {user && (
          <button
            type="button"
            className="nav-link"
            onClick={() => navigate("/dashboard")}
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
                    <p className="email">{profileData?.email || user.email}</p>
                  </div>
                </div>

                {/* Profile Info */}
                <div className="profile-content">
                  {profileData ? (
                    <>
                      <div className="profile-detail">
                        <span className="detail-label">First Name:</span>
                        <span className="detail-value">{profileData.firstName}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Last Name:</span>
                        <span className="detail-value">{profileData.lastName}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{profileData.email}</span>
                      </div>
                      <div className="profile-detail">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">{profileData.phone || "Not provided"}</span>
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
