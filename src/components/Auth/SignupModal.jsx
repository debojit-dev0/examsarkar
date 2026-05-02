import "./SignupModal.css";
import { FaTimes } from "react-icons/fa";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { registerUser } from "../../api/authApi";

export default function SignupModal({ isOpen, onClose, switchToLogin, planData }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    // clear messages while typing
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all registration fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { user, accessToken, refreshToken } = await registerUser(form);

      // ✅ STORE USER AND TOKENS IN LOCALSTORAGE
      // NOTE: In production, these should be stored in httpOnly cookies instead
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("token", accessToken);

      // ✅ SUCCESS MESSAGE
      setSuccess("Registration successful!");

      // ✅ CLOSE MODAL
      onClose();

      // ✅ OPEN PAYMENT POPUP OR GO TO DASHBOARD
      if (planData?.title && planData?.price) {
        window.dispatchEvent(new CustomEvent('openPaymentModal', {
          detail: { plan: planData }
        }));
      } else {
        window.location.href = "/dashboard";
      }

      // RESET FORM
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: ""
      });

    } catch (apiError) {
      setError(apiError.message || "Registration failed. Please try again.");
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
          aria-label="Close signup modal"
          type="button"
        >
          <FaTimes />
        </button>

        <h2>Create Account</h2>
        <p>Join ExamSarkar and start your UPSC prep today</p>

        <form onSubmit={handleSubmit}>

          <input
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
          />

          <input
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />

          <input
            type="tel"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
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
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>

          <div className="password-field">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label="Toggle confirm password visibility"
            >
              {showConfirmPassword ? <EyeOff /> : <Eye />}
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
            {isSubmitting ? "Creating Account..." : "Register"}
          </button>

        </form>

        <p className="bottom-text">
          Already have an account?{" "}
          <span className="link" onClick={switchToLogin}>
            Login
          </span>
        </p>

      </div>
    </div>
  );
}