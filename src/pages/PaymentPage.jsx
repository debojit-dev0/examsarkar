import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./PaymentPage.css";
import { buildApiUrl } from "../utils/apiBaseUrl";
import { handleUnauthorized } from "../utils/apiErrorHandler";

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || "";

// Toast notification component
function showToast(message, type = 'info') {
  const toastContainer = document.createElement('div');
  const isMobile = window.innerWidth < 768;
  
  toastContainer.style.cssText = `
    position: fixed;
    ${isMobile ? 'bottom: 20px; left: 50%; transform: translateX(-50%);' : 'top: 20px; right: 20px;'}
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    animation: slideIn 0.3s ease-out;
    width: ${isMobile ? 'calc(100% - 40px)' : 'auto'};
    max-width: ${isMobile ? '90vw' : '400px'};
    word-wrap: break-word;
  `;
  toastContainer.textContent = message;
  document.body.appendChild(toastContainer);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toastContainer.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toastContainer.remove(), 300);
  }, 3000);
}

// Add keyframe animations
if (!document.getElementById('toast-animations-page')) {
  const style = document.createElement('style');
  style.id = 'toast-animations-page';
  style.textContent = `
    @keyframes slideIn {
      from { 
        transform: translateX(400px) translateY(0);
        opacity: 0; 
      }
      to { 
        transform: translateX(0) translateY(0);
        opacity: 1; 
      }
    }
    @keyframes slideOut {
      from { 
        transform: translateX(0) translateY(0);
        opacity: 1; 
      }
      to { 
        transform: translateX(400px) translateY(0);
        opacity: 0; 
      }
    }
    @media (max-width: 767px) {
      @keyframes slideIn {
        from { 
          transform: translateX(-50%) translateY(100px);
          opacity: 0; 
        }
        to { 
          transform: translateX(-50%) translateY(0);
          opacity: 1; 
        }
      }
      @keyframes slideOut {
        from { 
          transform: translateX(-50%) translateY(0);
          opacity: 1; 
        }
        to { 
          transform: translateX(-50%) translateY(100px);
          opacity: 0; 
        }
      }
    }
  `;
  document.head.appendChild(style);
}

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

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

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

    if (res.status === 401) {
      setLoading(false);
      handleUnauthorized();
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      showToast(data.message || 'Failed to create payment order', 'error');
      return;
    }

    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!ok) {
      setLoading(false);
      showToast('Razorpay could not be loaded. Check your connection and try again.', 'error');
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

        if (verify.status === 401) {
          handleUnauthorized();
          return;
        }

        const v = await verify.json();
        if (verify.ok && v.success) {
          showToast('Payment successful! Redirecting to dashboard...', 'success');
          navigate("/dashboard");
        } else {
          showToast('Payment verification failed. Please try again.', 'error');
        }
      },
      modal: { 
        ondismiss: function () { 
          setLoading(false);
          showToast('Payment cancelled. You can try again anytime.', 'info');
        } 
      }
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
