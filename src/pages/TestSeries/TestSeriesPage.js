import "./TestSeriesPage.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Navbar from "../../components/Navbar/Navbar";
import PlanSection from "../../components/PlanCard/PlanSection";
import SignupModal from "../../components/Auth/SignupModal";
import LoginModal from "../../components/Auth/LoginModal";
import { preloadRazorpayCheckout, startPaymentCheckout } from "../../components/Payment/PaymentModal";

export default function TestSeriesPage({ onLoginClick, onSignupClick }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null); // Store which plan user selected

  // Listen for global events to open auth modals (used by plan cards)
  useEffect(() => {
    const handler = (e) => {
      const mode = e?.detail?.mode;
      const planData = e?.detail?.plan;
      if (mode === 'login' || mode === 'signup') {
        setSelectedPlan(planData); // Store plan data
        setAuthMode(mode);
      }
    };
    window.addEventListener('openAuthModal', handler);
    return () => window.removeEventListener('openAuthModal', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const planData = e?.detail?.plan;
      if (!planData?.title || !planData?.price) return;
      startPaymentCheckout({
        plan: planData.title,
        price: planData.price,
        period: planData.type || 'daily',
        planKey: planData.planKey || `${(planData.type || 'daily').toLowerCase()}:${String(planData.title || '').toLowerCase()}`,
        planName: planData.planName || `${String(planData.type || 'Daily').charAt(0).toUpperCase() + String(planData.type || 'Daily').slice(1)} ${planData.title}`
      });
    };

    window.addEventListener('openPaymentModal', handler);
    return () => window.removeEventListener('openPaymentModal', handler);
  }, []);

  const slides = [
    {
      title: "AIR 1 Mindset",
      desc: "Consistency beats talent when strategy is right",
      img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f"
    },
    {
      title: "Daily Discipline",
      desc: "Small tests. Daily improvement. Big results.",
      img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085"
    },
    {
      title: "Built for UPSC",
      desc: "Aligned with real exam pattern & pressure",
      img: "https://images.unsplash.com/photo-1505666287802-931dc83a4c1b"
    }
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    preloadRazorpayCheckout();
  }, []);

  return (
    <>
      {/* ✅ Navbar now connected to App.js modal system */}
      <Navbar
        onHomeClick={() => navigate("/")}
        onPlansClick={() => navigate("/test-series")}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      <div className="test-container">
        <div className="test-inner">

          {/* CAROUSEL */}
          <div className="carousel">
            <div
              className="carousel-track"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide, i) => (
                <div
                  className="slide"
                  key={i}
                  style={{ backgroundImage: `url(${slide.img})` }}
                >
                  <div className="overlay">
                    <h2>{slide.title}</h2>
                    <p>{slide.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="dots">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={i === index ? "dot active" : "dot"}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </div>

          {/* HERO */}
          <div className="hero">
            <h1>Crack UPSC with Structured Test Series</h1>
            <p>Practice daily. Analyze deeply. Improve consistently.</p>
          </div>

          <p className="trust-line">
            Built for serious aspirants • Based on real UPSC pattern
          </p>

          {/* PLANS */}
          <PlanSection title="Daily Plan" price={99} type="daily" />
          <PlanSection title="Weekly Plan" price={299} type="weekly" />
          <PlanSection title="Monthly Plan" price={799} type="monthly" highlight />

        </div>
      </div>

      {/* AUTH MODALS */}
      <SignupModal
        isOpen={authMode === "signup"}
        onClose={() => setAuthMode(null)}
        switchToLogin={() => setAuthMode("login")}
        planData={selectedPlan}
      />

      <LoginModal
        isOpen={authMode === "login"}
        onClose={() => setAuthMode(null)}
        switchToSignup={() => setAuthMode("signup")}
        planData={selectedPlan}
      />
    </>
  );
}