import "./SubPlanCard.css";
import { ArrowRight } from "lucide-react";
import { preloadRazorpayCheckout, startPaymentCheckout } from "../Payment/PaymentModal";

export default function SubPlanCard({ title, price, features, type }) {
  const handlePayment = () => {
    const isLoggedIn = Boolean(localStorage.getItem('accessToken') || localStorage.getItem('refreshToken'));
    const planPeriod = type || 'daily';
    const planSubject = title.toLowerCase() === 'ge' ? 'gs' : title.toLowerCase();
    const planKey = `${planPeriod}:${planSubject}`;
    const planName = `${planPeriod.charAt(0).toUpperCase() + planPeriod.slice(1)} ${title}`;

    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: { mode: 'login', plan: { title, price, type: planPeriod, planKey, planName } } }));
      return;
    }

    startPaymentCheckout({ plan: title, price, period: planPeriod, planKey, planName });
  };

  return (
    <div className={`sub-card ${type}`}>

      {/* HEADER */}
      <div className="sub-header">
        <h3>{title}</h3>
        <span className="price">₹{price}</span>
      </div>

      {/* FEATURES */}
      <ul className="features">
  {features.map((f, i) => (
    <li key={i}>
      <span className="tick"></span>
      <span>{f}</span>
    </li>
  ))}
</ul>

      {/* CTA */}
      <button className="buy-btn" onMouseEnter={() => preloadRazorpayCheckout()} onFocus={() => preloadRazorpayCheckout()} onClick={handlePayment}>
        Get Started
        <ArrowRight size={16} />
      </button>

    </div>
  );
}