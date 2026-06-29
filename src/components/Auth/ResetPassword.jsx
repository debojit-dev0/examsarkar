import { useState } from "react";
import axios from "axios";

export default function ResetPassword() {
  const uid = new URLSearchParams(window.location.search).get("uid");
  const token = new URLSearchParams(window.location.search).get("token");
  console.log("===== FRONTEND =====");
console.log("UID:", uid);
console.log("TOKEN:", token);
console.log("Current URL:", window.location.href);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setMsg("");

    if (!password || !confirmPassword) {
      setMsg("Enter both passwords");
      return;
    }

    if (password !== confirmPassword) {
      setMsg("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      await axios.post("http://localhost:5000/api/auth/reset-password", {
  uid: uid,
  token: token,
  newPassword: password,
});
      setMsg("Password reset successful. Redirecting to login...");

      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

    } catch (err) {
      setMsg(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    
    }
  };
  console.log("UID:", uid);
console.log("TOKEN:", token);
console.log("PASSWORD:", password);

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2>Reset Password</h2>

        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={styles.input}
        />

        <button onClick={handleReset} style={styles.button} disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        {msg && <p style={styles.msg}>{msg}</p>}
      </div>
    </div>
  );
  
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6",
  },
  box: {
    padding: "30px",
    background: "white",
    borderRadius: "10px",
    width: "300px",
    textAlign: "center",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  },
  input: {
    width: "100%",
    padding: "10px",
    margin: "10px 0",
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#2563eb",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
  msg: {
    fontSize: "12px",
    marginTop: "10px",
    color: "red",
  },
};