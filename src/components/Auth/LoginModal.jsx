import "./SignupModal.css";
import { FaTimes } from "react-icons/fa";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { loginUser, setStoredAuthSession, forgotPassword } from "../../api/authApi";

export default function LoginModal({
  isOpen,
  onClose,
  switchToSignup,
  planData,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { user, accessToken, refreshToken } = await loginUser(
        form.email,
        form.password
      );

      setStoredAuthSession({ user, accessToken, refreshToken });

      setSuccess(`Welcome ${user.firstName || "back"}, login successful.`);

      onClose();

      setTimeout(() => {
        if (planData?.title && planData?.price) {
          window.dispatchEvent(
            new CustomEvent("openPaymentModal", {
              detail: { plan: planData },
            })
          );
        } else {
          window.location.href = "/dashboard";
        }
      }, 500);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [loading, setLoading] = useState(false);

const handleForgotPassword = async () => {
  if (loading) return; // prevent spam clicks

  if (!forgotEmail) {
    setForgotMsg("Please enter email");
    return;
  }

  try {
    setLoading(true);
    setForgotMsg("Sending reset link...");

    await forgotPassword(forgotEmail);

    setForgotMsg("Reset link sent to your email.");
  } catch (err) {
    setForgotMsg(err.message || "Failed to send reset link");
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">

        {/* CLOSE */}
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        <h2>Welcome Back</h2>
        <p>Login to continue your preparation</p>

        {/* ================= LOGIN MODE ================= */}
        {!forgotMode && (
          <form onSubmit={handleSubmit}>

            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />

              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            {error && <p className="auth-message auth-error">{error}</p>}
            {success && <p className="auth-message auth-success">{success}</p>}

            <p
              style={{
                textAlign: "right",
                fontSize: "12px",
                color: "#2563eb",
                cursor: "pointer",
                marginTop: "6px",
              }}
              onClick={() => setForgotMode(true)}
            >
              Forgot Password?
            </p>

            <button className="auth-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging In..." : "Login"}
            </button>

          </form>
        )}

        {/* ================= FORGOT PASSWORD MODE ================= */}
        {forgotMode && (
          <div style={{ marginTop: "15px" }}>

            <h3>Reset Password</h3>

            <input
              type="email"
              placeholder="Enter your email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />

            <button className="auth-btn" onClick={handleForgotPassword}>
              Send Reset Link
            </button>

            <p style={{ fontSize: "12px", marginTop: "10px" }}>
              {forgotMsg}
            </p>

            <p
              style={{
                cursor: "pointer",
                color: "red",
                fontSize: "12px",
                marginTop: "10px",
              }}
              onClick={() => setForgotMode(false)}
            >
              Back to Login
            </p>

          </div>
        )}

        <p className="bottom-text">
          Don't have an account?{" "}
          <span className="link" onClick={switchToSignup}>
            Sign Up
          </span>
        </p>

      </div>
    </div>
  );
}