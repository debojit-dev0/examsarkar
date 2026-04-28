import { useMemo, useState } from "react";
import { FiKey, FiLock, FiLogIn, FiMail, FiShield } from "react-icons/fi";
import { ADMIN_TEST_ACCOUNTS, loginAdminWithTestCredentials } from "../../api/authApi";
import "./AdminLoginPage.css";

export default function AdminLoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const credentialsPreview = useMemo(
    () =>
      ADMIN_TEST_ACCOUNTS.map((account) => ({
        title: account.label,
        email: account.email,
        password: account.password,
        role: account.role
      })),
    []
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await loginAdminWithTestCredentials(email, password);
      onLoginSuccess(session);
    } catch (submitError) {
      setError(submitError.message || "Unable to login. Please try again.");
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
            {credentialsPreview.map((item) => (
              <article key={item.role} className="credential-card">
                <h3>
                  {item.role === "super-admin" ? <FiShield /> : <FiLock />} {item.title}
                </h3>
                <p>Email: {item.email}</p>
                <p>Password: {item.password}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-login-card">
          <h2>
            <FiLogIn /> Secure Admin Sign In
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
