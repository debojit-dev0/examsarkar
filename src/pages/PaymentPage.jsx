import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PaymentPage.css";

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || "";

// Auto-detect backend URL for Netlify or local dev
const getApiUrl = () => {
  if (window.location.hostname.includes('.netlify.app')) {
    return `${window.location.protocol}//${window.location.host}/.netlify/functions/api`;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5000`;
};

const API_URL = getApiUrl();

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const plan = params.get("plan") || "Subscription";
  const priceParam = params.get("price");
  const priceNumber = priceParam ? Number(priceParam) : null; // rupees

  useEffect(() => {
    // if user already paid, redirect to dashboard
    (async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/payment/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.paid) {
            navigate("/dashboard");
          }
        }
      } catch (e) {}
    })();
  }, [navigate]);

  const handlePay = async () => {
    setLoading(true);
    const amountPaise = priceNumber ? Math.round(priceNumber * 100) : 49900;

    const res = await fetch(`${API_URL}/api/payment/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      body: JSON.stringify({ amount: amountPaise }) // amount in paise
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus({ error: data.message || "Failed to create order" });
      setLoading(false);
      return;
    }

    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!ok) {
      setStatus({ error: "Failed to load payment gateway" });
      setLoading(false);
      return;
    }

    const options = {
      key: data.key_id || RAZORPAY_KEY,
      amount: data.order.amount,
      currency: data.order.currency,
      name: "ExamSarkar",
      description: plan,
      order_id: data.order.id,
      handler: async function (response) {
        // verify on server
        const verify = await fetch(`${API_URL}/api/payment/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          body: JSON.stringify(response)
        });

        const v = await verify.json();
        if (verify.ok && v.success) {
          navigate("/dashboard");
        } else {
          setStatus({ error: v.message || "Payment verification failed" });
        }
      },
      modal: { ondismiss: function () { setLoading(false); } }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    setLoading(false);
  };

  return (
    <div className="payment-page">
      <div className="payment-card">
        <h2>Complete Payment</h2>
        <p>{plan} — {priceNumber ? `₹${priceNumber}` : `₹499`}</p>
        {!localStorage.getItem("token") && (
          <div className="error">Please login first to continue to payment.</div>
        )}
        {status?.error && <div className="error">{status.error}</div>}
        <button className="pay-btn" onClick={handlePay} disabled={loading || !localStorage.getItem("token")}>
          {loading ? "Processing..." : `Pay ${priceNumber ? `₹${priceNumber}` : "₹499"}`}
        </button>
      </div>
    </div>
  );
}
