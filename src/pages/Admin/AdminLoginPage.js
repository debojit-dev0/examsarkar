import { useState } from "react";
import { FiKey, FiLogIn, FiMail } from "react-icons/fi";
import { loginAdminWithTestCredentials, setAdminSession } from "../../api/authApi";
import "./AdminLoginPage.css";

export default function AdminLoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await loginAdminWithTestCredentials(email, password);
      setAdminSession(session);
      onLoginSuccess(session);
    } catch (loginError) {
      setError(loginError.message || "Admin login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <div className="admin-login-backdrop admin-login-backdrop-left" />
      <div className="admin-login-backdrop admin-login-backdrop-right" />

      <div className="admin-login-layout">
        <section className="admin-login-intro">
          <p className="admin-login-kicker">ExamSarkar Control Access</p>
          <h1>Admin Login</h1>
          <p>
            Login as Super Admin or Content Admin. Role-specific dashboard modules are loaded
            automatically after sign-in.
          </p>

          <div className="credential-list">
            <article className="credential-card" style={{ background: '#fff3cd', borderLeft: '4px solid #ff6b6b' }}>
              <h3>⚠️ Security Notice</h3>
              <p>Admin login is now backed by Firebase Realtime Database.</p>
              <p>Use the admin credential stored in the <strong>adminAccounts</strong> node.</p>
            </article>
          </div>
        </section>

        <section className="admin-login-card">
          <h2>
            <FiLogIn /> Admin Sign In
          </h2>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <label>
              Email
              <div className="input-wrap">
                <FiMail />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter admin email"
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-wrap">
                <FiKey />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
            </label>

            {error ? <p className="admin-login-error">{error}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login to Admin"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
