import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PaymentPage.css";
import { buildApiUrl } from "../utils/apiBaseUrl";

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || "";

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
  const navigate = useNavigate();

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const plan = params.get("plan") || "Subscription";
  const planPeriod = params.get("period") || "daily";
  const planKey = params.get("planKey") || `${planPeriod.toLowerCase()}:${String(plan).toLowerCase()}`;
  const planName = params.get("planName") || `${planPeriod.charAt(0).toUpperCase() + planPeriod.slice(1)} ${plan}`;
  const priceParam = params.get("price");
  const priceNumber = priceParam ? Number(priceParam) : null; // rupees

  useEffect(() => {
    // if user already paid, redirect to dashboard
    (async () => {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(buildApiUrl('/api/payment/status'), {
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
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");

    const res = await fetch(buildApiUrl('/api/payment/create-order'), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
      body: JSON.stringify({ amount: amountPaise, planKey, planName }) // amount in paise
    });

    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      return;
    }

    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!ok) {
      setLoading(false);
      return;
    }

    const options = {
      key: data.key_id || RAZORPAY_KEY,
      amount: data.order.amount,
      currency: data.order.currency,
      name: "ExamSarkar",
      description: planName,
      order_id: data.order.id,
      handler: async function (response) {
        // verify on server
        const verify = await fetch(buildApiUrl('/api/payment/verify'), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
          body: JSON.stringify(response)
        });

        const v = await verify.json();
        if (verify.ok && v.success) {
          navigate("/dashboard");
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
        {!(localStorage.getItem("accessToken") || localStorage.getItem("token")) && (
          <div className="error">Please login first to continue to payment.</div>
        )}
        <button className="pay-btn" onClick={handlePay} disabled={loading || !(localStorage.getItem("accessToken") || localStorage.getItem("token"))}>
          {loading ? "Processing..." : `Pay ${priceNumber ? `₹${priceNumber}` : "₹499"}`}
        </button>
      </div>
    </div>
  );
}
