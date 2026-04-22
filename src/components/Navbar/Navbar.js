import "./Navbar.css";

export default function Navbar({
  onLoginClick,
  onSignupClick,
  onHomeClick,
  onPlansClick
}) {
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
          Plans
        </button>
        <button type="button" className="nav-link">
          Courses
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