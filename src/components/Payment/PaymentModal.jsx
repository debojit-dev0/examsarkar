import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { buildApiUrl } from '../../utils/apiBaseUrl';

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || '';
let razorpayScriptPromise = null;

function loadScript(src) {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-razorpay-checkout="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.razorpayCheckout = 'true';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

export function preloadRazorpayCheckout() {
  return loadScript('https://checkout.razorpay.com/v1/checkout.js');
}

export default function PaymentModal({ plan = 'Subscription', price = 499, period = 'daily', planKey = '', planName = '', onClose = () => {} }) {
  const [status, setStatus] = useState(null);

  const isLoggedIn = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('refreshToken'));

  const resolvedPlanKey = planKey || `${String(period || 'daily').toLowerCase()}:${String(plan || '').toLowerCase()}`;
  const resolvedPlanName = planName || `${String(period || 'Daily').charAt(0).toUpperCase() + String(period || 'Daily').slice(1)} ${plan}`;

  const showStatus = (nextStatus) => {
    setStatus(nextStatus);
  };

  const handlePay = useCallback(async () => {
    if (!isLoggedIn) return;
    setStatus(null);

    const amountPaise = Math.round(Number(price) * 100);

    try {
      const res = await fetch(buildApiUrl('/api/payment/create-order'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` 
        },
        body: JSON.stringify({ amount: amountPaise, planKey: resolvedPlanKey, planName: resolvedPlanName })
      });

      const data = await res.json();
      if (!res.ok) {
        showStatus({
          type: 'failed',
          title: 'Payment failed',
          message: data.message || 'We could not create your payment order. Please try again.',
          tone: 'danger'
        });
        return;
      }

      const ok = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!ok) {
        showStatus({
          type: 'failed',
          title: 'Gateway unavailable',
          message: 'Razorpay could not be loaded. Check your connection and try again.',
          tone: 'danger'
        });
        return;
      }

      const options = {
        key: data.key_id || RAZORPAY_KEY,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'ExamSarkar',
        description: resolvedPlanName,
        order_id: data.order.id,
        handler: async function (response) {
          const verify = await fetch(buildApiUrl('/api/payment/verify'), {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` 
            },
            body: JSON.stringify(response)
          });
          const v = await verify.json();
          if (verify.ok && v.success) {
            window.dispatchEvent(new CustomEvent('paymentSuccess', { detail: { orderId: data.order.id, planKey: resolvedPlanKey, planName: resolvedPlanName } }));
            onClose();
          } else {
            showStatus({
              type: 'failed',
              title: 'Payment failed',
              message: v.message || 'Your payment could not be verified. No amount was confirmed.',
              tone: 'danger'
            });
          }
        },
        modal: {
          ondismiss: function () {
            showStatus({
              type: 'cancelled',
              title: 'Payment cancelled',
              message: 'You closed the payment window before completing the transaction.',
              tone: 'warning'
            });
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showStatus({
        type: 'failed',
        title: 'Payment failed',
        message: 'Something went wrong while starting the payment. Please try again.',
        tone: 'danger'
      });
    }
  }, [isLoggedIn, onClose, price, resolvedPlanKey, resolvedPlanName]);

  // Do not auto-open checkout on mount. Require explicit user action (click "Pay").

  // Initial view: when there's no status, render a simple payment card
  // that requires the user to click Pay. Status panel is shown only
  // after a payment attempt (success, failure, cancelled).
  if (!status) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2, 6, 23, 0.64)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: 'min(520px, 100%)', borderRadius: 24, background: '#ffffff', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.28)', border: '1px solid rgba(226,232,240,0.5)', overflow: 'hidden' }}>
          <div style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Complete Payment</h2>
              <button onClick={onClose} aria-label="Close payment" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <p style={{ marginTop: 0, color: '#475569' }}>{resolvedPlanName}</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0' }}>
              <strong style={{ fontSize: 18 }}>₹{price}</strong>
              {!isLoggedIn ? (
                <div style={{ color: '#ef4444' }}>Please login to continue</div>
              ) : (
                <button onClick={() => { showStatus({ type: 'processing' }); handlePay(); }} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  Pay ₹{price}
                </button>
              )}
            </div>

            <div style={{ color: '#94a3b8', fontSize: 13 }}>Payment is securely processed via Razorpay.</div>
          </div>
        </div>
      </div>
    );
  }

  const toneStyles = status.tone === 'warning'
    ? {
        badgeBg: 'rgba(245, 158, 11, 0.16)',
        badgeColor: '#b45309',
        buttonBg: '#f59e0b',
        buttonText: '#ffffff',
        panelBorder: 'rgba(245, 158, 11, 0.28)'
      }
    : {
        badgeBg: 'rgba(220, 38, 38, 0.12)',
        badgeColor: '#b91c1c',
        buttonBg: '#2563eb',
        buttonText: '#ffffff',
        panelBorder: 'rgba(37, 99, 235, 0.18)'
      };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2, 6, 23, 0.64)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(460px, 100%)', borderRadius: 24, background: '#ffffff', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.28)', border: `1px solid ${toneStyles.panelBorder}`, overflow: 'hidden' }}>
        <div style={{ padding: '28px 28px 22px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', background: toneStyles.badgeBg, color: toneStyles.badgeColor, fontSize: 24, fontWeight: 800 }}>
              {status.type === 'cancelled' ? '!' : '×'}
            </div>
            <button onClick={onClose} aria-label="Close payment status" style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>✕</button>
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: 24, lineHeight: 1.2, color: '#0f172a' }}>{status.title}</h2>
          <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 15, lineHeight: 1.6 }}>{status.message}</p>

          <div style={{ borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <span style={{ color: '#64748b' }}>Plan</span>
              <strong style={{ color: '#0f172a' }}>{resolvedPlanName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#64748b' }}>Amount</span>
              <strong style={{ color: '#0f172a' }}>₹{price}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => {
                setStatus(null);
                handlePay();
              }}
              style={{ flex: 1, border: 'none', borderRadius: 14, padding: '14px 18px', background: toneStyles.buttonBg, color: toneStyles.buttonText, fontWeight: 700, cursor: 'pointer', boxShadow: '0 12px 24px rgba(37, 99, 235, 0.22)' }}
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 18px', background: '#ffffff', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// helper to open modal imperatively
export function showPaymentModal({ plan, price, period = 'daily', planKey = '', planName = '' }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  function close() { root.unmount(); container.remove(); }
  root.render(<PaymentModal plan={plan} price={price} period={period} planKey={planKey} planName={planName} onClose={close} />);
  return { close };
}
