import "./SignupModal.css";
import { FaTimes } from "react-icons/fa";
import { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ ADD THIS
import { showPaymentModal } from "../Payment/PaymentModal";
import { loginUser } from "../../api/authApi";

export default function LoginModal({ isOpen, onClose, switchToSignup }) {
  const navigate = useNavigate(); // ✅ ADD THIS

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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


      const { user, token } = await loginUser(form.email, form.password);

      // ✅ success message
      setSuccess(`Welcome ${user.firstName || "back"}, login successful.`);

      // ✅ store user and token in localStorage
      localStorage.setItem("user", JSON.stringify(user));
      if (token) localStorage.setItem("token", token);

      // ✅ CLOSE MODAL
      onClose();

      // ✅ OPEN PAYMENT MODAL after login
      try { showPaymentModal({ plan: 'Subscription', price: 499 }); } catch (e) {}

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

          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
          />

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