import React, { useState } from 'react';
import './../../pages/PaymentPage.css';
import { createRoot } from 'react-dom/client';

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || '';

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
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentModal({ plan = 'Subscription', price = 499, onClose = () => {} }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const isLoggedIn = Boolean(localStorage.getItem('token') || localStorage.getItem('user'));

  const handleOpenAuth = (mode) => {
    onClose();
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode } }));
  };

  const handlePay = async () => {
    if (!isLoggedIn) return;
    setLoading(true);

    const amountPaise = Math.round(Number(price) * 100);

    try {
      const res = await fetch(`${API_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ amount: amountPaise })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus({ error: data.message || 'Failed to create order' });
        setLoading(false);
        return;
      }

      const ok = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!ok) {
        setStatus({ error: 'Failed to load payment gateway' });
        setLoading(false);
        return;
      }

      const options = {
        key: data.key_id || RAZORPAY_KEY,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'ExamSarkar',
        description: plan,
        order_id: data.order.id,
        handler: async function (response) {
          const verify = await fetch(`${API_URL}/api/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
            body: JSON.stringify(response)
          });
          const v = await verify.json();
          if (verify.ok && v.success) {
            window.dispatchEvent(new CustomEvent('paymentSuccess', { detail: { orderId: data.order.id } }));
            onClose();
          } else {
            setStatus({ error: v.message || 'Payment verification failed' });
          }
        },
        modal: { ondismiss: function () { setLoading(false); } }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      setStatus({ error: 'Payment failed' });
    }

    setLoading(false);
  };

  return (
    <div className="payment-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '80px', zIndex: 9999 }}>
      <div className="payment-card" style={{ width: 420 }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 18, top: 12, border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h2>Complete Payment</h2>
        <p>{plan} — ₹{price}</p>
        {!isLoggedIn && (
          <div style={{ margin: '12px 0', color: '#b91c1c' }}>Please login first to continue to payment.</div>
        )}
        {status?.error && <div className="error">{status.error}</div>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          {!isLoggedIn && (
            <>
              <button className="pay-btn" onClick={() => handleOpenAuth('login')}>Login</button>
              <button className="pay-btn" onClick={() => handleOpenAuth('signup')}>Signup</button>
            </>
          )}
          <button className="pay-btn" onClick={handlePay} disabled={!isLoggedIn || loading}>
            {loading ? 'Processing...' : `Pay ₹${price}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// helper to open modal imperatively
export function showPaymentModal({ plan, price }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  function close() { root.unmount(); container.remove(); }
  root.render(<PaymentModal plan={plan} price={price} onClose={close} />);
  return { close };
}
