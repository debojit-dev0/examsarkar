import { useNavigate } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({
  onLoginClick,
  onSignupClick,
  onHomeClick,
  onPlansClick,
  onFreeDailyTestClick
}) {
  const navigate = useNavigate();

  const handleHome = () => {
    if (onHomeClick) {
      onHomeClick();
      return;
    }
    navigate("/");
  };

  const handlePlans = () => {
    if (onPlansClick) {
      onPlansClick();
      return;
    }
    navigate("/test-series");
  };

  const handleFreeDailyTest = () => {
    if (onFreeDailyTestClick) {
      onFreeDailyTestClick();
      return;
    }
    navigate("/test-series#free-daily-test");
  };

  return (
    <header className="navbar">
      <div
        className="logo"
        onClick={handleHome}
        style={{ cursor: "pointer" }}
      >
        <span className="logo-primary">Exam</span>
        <span className="logo-accent">Sarkar</span>
      </div>

      <nav className="nav-links">
        <button type="button" className="nav-link" onClick={handleHome}>
          Home
        </button>
        <button type="button" className="nav-link" onClick={handlePlans}>
          Plans
        </button>
        <button type="button" className="nav-link" onClick={handleFreeDailyTest}>
          Free Daily Test
        </button>

        <button type="button" className="nav-link">
          Blog
        </button>
      </nav>

      <div className="nav-actions">
        <button className="login" onClick={onLoginClick}>
          Login
        </button>
        <button className="signup" onClick={onSignupClick}>
          Register
        </button>
      </div>
    </header>
  );
}