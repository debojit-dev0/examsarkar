import "./SubPlanCard.css";
import { ArrowRight } from "lucide-react";
import { showPaymentModal } from "../Payment/PaymentModal";

export default function SubPlanCard({ title, price, features, type }) {
  const handlePayment = () => {
    showPaymentModal({ plan: title, price });
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
      <button className="buy-btn" onClick={handlePayment}>
        Get Started
        <ArrowRight size={16} />
      </button>

    </div>
  );
}