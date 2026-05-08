import "./TestSeriesPage.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Navbar from "../../components/Navbar/Navbar";
import PlanSection from "../../components/PlanCard/PlanSection";
import SignupModal from "../../components/Auth/SignupModal";
import LoginModal from "../../components/Auth/LoginModal";
import { preloadRazorpayCheckout, startPaymentCheckout } from "../../components/Payment/PaymentModal";
import { loadAdminTests } from "../../utils/adminTestsStore";

export default function TestSeriesPage({ onLoginClick, onSignupClick }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null); // Store which plan user selected
  const [freeTests, setFreeTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(null); // Track which test triggered auth

  const isLoggedIn = () => {
    return Boolean(localStorage.getItem("accessToken") || localStorage.getItem("refreshToken"));
  };

  const handleAttemptQuiz = (testId) => {
    if (!isLoggedIn()) {
      // Store the test ID and show login modal
      setSelectedTestId(testId);
      setAuthMode("login");
      return;
    }

    // Navigate to quiz page with test ID
    navigate(`/test/${testId}`, { state: { testId } });
  };

  // After modal closes, check if logged in and navigate to test if needed
  useEffect(() => {
    if (authMode === null && selectedTestId && isLoggedIn()) {
      // User just logged in and selected a test
      navigate(`/test/${selectedTestId}`, { state: { testId: selectedTestId } });
      setSelectedTestId(null);
    }
  }, [authMode, selectedTestId, navigate]);
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

  useEffect(() => {
    let isActive = true;

    const fetchFreeTests = async () => {
      try {
        const tests = await loadAdminTests();
        console.log("[TestSeries] All tests loaded:", tests);
        
        if (!isActive) return;

        const filtered = (Array.isArray(tests) ? tests : [])
          .filter((test) => {
            const isFree = test?.access === "free";
            console.log(`[TestSeries] Test "${test?.testName}": access=${test?.access}, isFree=${isFree}`);
            return isFree;
          })
          .sort((left, right) => {
            const leftTime = new Date(left?.createdAt || 0).getTime();
            const rightTime = new Date(right?.createdAt || 0).getTime();
            return rightTime - leftTime;
          });
        
        console.log("[TestSeries] Filtered free tests:", filtered);
        setFreeTests(filtered);
      } catch (error) {
        console.error("[TestSeries] Failed to load free tests:", error);
        if (isActive) {
          setFreeTests([]);
        }
      }
    };

    fetchFreeTests();

    return () => {
      isActive = false;
    };
  }, []);

  const formatSubject = (subject) => {
    const normalized = String(subject || "all").toLowerCase();
    if (normalized === "ge") return "GS / GE";
    if (normalized === "gs") return "GS / GE";
    if (normalized === "csat") return "CSAT";
    if (normalized === "combo") return "COMBO";
    return normalized.toUpperCase();
  };

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

          {/* FREE TESTS AT TOP */}
          <section className="free-tests-section">
            <div className="free-tests-header">
              <h2>Free Tests Uploaded by Admin</h2>
              <p>
                {freeTests.length > 0
                  ? "These free tests are available now."
                  : "No free tests uploaded yet."}
              </p>
            </div>

            {freeTests.length > 0 ? (
              <div className="free-tests-grid">
                {freeTests.map((test) => (
                  <article key={test.id} className="free-test-card">
                    <div className="free-test-topline">
                      <span className="free-badge">FREE</span>
                      <span className="free-test-type">{String(test.type || "daily").toUpperCase()}</span>
                    </div>
                    <h3>{test.testName || "Untitled Test"}</h3>
                    <p>{formatSubject(test.subject)}</p>
                    <div className="free-test-meta">
                      <span>{test.questionCount || 0} questions</span>
                      <span>{test.date ? `Date: ${test.date}` : "Always available"}</span>
                    </div>
                    <button 
                      className="attempt-quiz-btn"
                      onClick={() => handleAttemptQuiz(test.id)}
                    >
                      Attempt Quiz →
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {/* PLANS */}
          <PlanSection title="Daily Plan" price={99} type="daily" />
          <PlanSection title="Weekly Plan" price={299} type="weekly" />
          <PlanSection title="Monthly Plan" price={799} type="monthly" highlight />

        </div>
      </div>

      {/* AUTH MODALS */}
      <SignupModal
        isOpen={authMode === "signup"}
        onClose={() => {
          setAuthMode(null);
        }}
        switchToLogin={() => setAuthMode("login")}
        planData={selectedPlan}
      />

      <LoginModal
        isOpen={authMode === "login"}
        onClose={() => {
          setAuthMode(null);
        }}
        switchToSignup={() => setAuthMode("signup")}
        planData={selectedPlan}
      />
    </>
  );
}