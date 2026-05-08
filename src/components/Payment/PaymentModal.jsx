import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { buildApiUrl } from '../../utils/apiBaseUrl';
import { handleUnauthorized } from '../../utils/apiErrorHandler';

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
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
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

export function preloadRazorpayCheckout() {
  return loadScript('https://checkout.razorpay.com/v1/checkout.js');
}

export default function PaymentModal({ plan = 'Subscription', price = 499, period = 'daily', planKey = '', planName = '', onClose = () => {} }) {
  const isLoggedIn = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('refreshToken'));

  const resolvedPlanKey = planKey || `${String(period || 'daily').toLowerCase()}:${String(plan || '').toLowerCase()}`;
  const resolvedPlanName = planName || `${String(period || 'Daily').charAt(0).toUpperCase() + String(period || 'Daily').slice(1)} ${plan}`;

  const handlePay = useCallback(async () => {
    if (!isLoggedIn) return;

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
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
      if (!res.ok) {
            if (res.status === 401) {
              handleUnauthorized();
              return;
            }
        showToast(data.message || 'We could not create your payment order. Please try again.', 'error');
        return;
      }

      const ok = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!ok) {
        showToast('Razorpay could not be loaded. Check your connection and try again.', 'error');
        return;
      }

      const options = {
        key: data.key_id || RAZORPAY_KEY,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'ExamSarkar',
        description: resolvedPlanName,
        order_id: data.order.id,
        handler: function (response) {
          // Do not verify here; rely on server-side webhook to confirm payment and attach the plan.
          // Notify the app UI and close the modal immediately.
          window.dispatchEvent(new CustomEvent('paymentSuccess', { detail: { orderId: data.order.id, planKey: resolvedPlanKey, planName: resolvedPlanName } }));
          onClose();
        },
        modal: {
          ondismiss: function () {
            // close modal on dismiss and show message
            showToast('Payment cancelled. You can try again anytime.', 'info');
            onClose();
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showToast('Something went wrong while starting the payment. Please try again.', 'error');
    }
  }, [isLoggedIn, onClose, price, resolvedPlanKey, resolvedPlanName]);

  // Do not auto-open checkout on mount. Require explicit user action (click "Pay").
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
              <button onClick={() => { handlePay(); }} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
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

// Direct checkout function - opens Razorpay immediately without intermediate modal
export async function startPaymentCheckout({ plan, price, period = 'daily', planKey = '', planName = '' }) {
  const isLoggedIn = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('refreshToken'));
  if (!isLoggedIn) return;

  const resolvedPlanKey = planKey || `${String(period || 'daily').toLowerCase()}:${String(plan || '').toLowerCase()}`;
  const resolvedPlanName = planName || `${String(period || 'Daily').charAt(0).toUpperCase() + String(period || 'Daily').slice(1)} ${plan}`;
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
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      showToast(data.message || 'We could not create your payment order. Please try again.', 'error');
      return;
    }

    const ok = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    if (!ok) {
      showToast('Razorpay could not be loaded. Check your connection and try again.', 'error');
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
        const verifyRes = await fetch(buildApiUrl('/api/payment/verify'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`
          },
          body: JSON.stringify(response)
        });

        if (verifyRes.status === 401) {
          handleUnauthorized();
          return;
        }

        const verifyJson = await verifyRes.json();
        if (!verifyRes.ok || !verifyJson?.success) {
          showToast('Payment verification failed. Please try again.', 'error');
          return;
        }

        window.dispatchEvent(new CustomEvent('paymentSuccess', { detail: { orderId: data.order.id, planKey: resolvedPlanKey, planName: resolvedPlanName } }));
        showToast('Payment successful! Redirecting to dashboard...', 'success');
      },
      modal: {
        ondismiss: function () {
          // User cancelled payment - show friendly message
          showToast('Payment cancelled. You can try again anytime.', 'info');
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    showToast('Something went wrong while starting the payment. Please try again.', 'error');
  }
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
