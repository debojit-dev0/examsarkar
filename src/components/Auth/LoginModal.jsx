import "./SignupModal.css";
import { FaTimes } from "react-icons/fa";
import { useState } from "react";
import { loginUser } from "../../api/authApi";

export default function LoginModal({ isOpen, onClose, switchToSignup }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: ""
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
      const user = await loginUser(form.email, form.password);
      setSuccess(`Welcome ${user.firstName || "back"}, login successful.`);
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
        <button className="close-btn" onClick={onClose}>
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

          {error ? <p className="auth-message auth-error">{error}</p> : null}
          {success ? <p className="auth-message auth-success">{success}</p> : null}

          <button className="auth-btn" type="submit" disabled={isSubmitting}>
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