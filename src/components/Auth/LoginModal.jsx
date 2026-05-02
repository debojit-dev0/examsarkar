import "./SignupModal.css";
import { FaTimes } from "react-icons/fa";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { loginUser } from "../../api/authApi";

export default function LoginModal({ isOpen, onClose, switchToSignup, planData }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // clear messages while typing
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

      const { user, accessToken, refreshToken } = await loginUser(form.email, form.password);

      // ✅ SUCCESS MESSAGE
      setSuccess(`Welcome ${user.firstName || "back"}, login successful.`);

      // ✅ STORE USER AND TOKENS IN LOCALSTORAGE
      // NOTE: In production, these should be stored in httpOnly cookies instead
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("token", accessToken);

      // ✅ CLOSE MODAL
      onClose();

      // ✅ OPEN PAYMENT POPUP OR GO TO DASHBOARD AFTER LOGIN
      setTimeout(() => {
        if (planData?.title && planData?.price) {
          window.dispatchEvent(new CustomEvent('openPaymentModal', {
            detail: { plan: planData }
          }));
        } else {
          window.location.href = "/dashboard";
        }
      }, 500);

    } catch (apiError) {
      setError(apiError.message || "Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">

        {/* CLOSE BUTTON */}
        <button
          className="close-btn"
          onClick={onClose}
          aria-label="Close login modal"
          type="button"
        >
          <FaTimes />
        </button>

        <h2>Welcome Back</h2>
        <p>Login to continue your preparation</p>

        <form onSubmit={handleSubmit}>

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />

          <div className="password-field">
            <input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <p className="auth-message auth-error">{error}</p>
          )}

          {/* SUCCESS */}
          {success && (
            <p className="auth-message auth-success">{success}</p>
          )}

          <button
            className="auth-btn"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging In..." : "Login"}
          </button>

        </form>

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