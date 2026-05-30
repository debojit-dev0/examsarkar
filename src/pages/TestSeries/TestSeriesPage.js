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
  const [loadingTests, setLoadingTests] = useState(true);

  const getVisibleFreeTests = (tests) => {
    if (!Array.isArray(tests)) return [];

    const today = new Date().toISOString().split("T")[0];

    return tests.filter((test) => {
      if (test?.access !== "free") return false;

      if (test?.type === "daily-quiz") {
        const testDate = test.date ? String(test.date).split("T")[0] : null;
        return testDate === today;
      }

      return true;
    });
  };

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

  useEffect(() => {
    let isActive = true;

    const loadFreeTests = async () => {
      try {
        setLoadingTests(true);
        const tests = await loadAdminTests();
        if (!isActive) return;
        setFreeTests(getVisibleFreeTests(tests));
      } catch (error) {
        console.error("Failed to load free tests:", error);
        if (isActive) {
          setFreeTests([]);
        }
      } finally {
        if (isActive) {
          setLoadingTests(false);
        }
      }
    };

    loadFreeTests();

    return () => {
      isActive = false;
    };
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

          <section className="free-tests-section">
            <div className="free-tests-header">
              <h2>Free Tests</h2>
              <p>Open any free test uploaded from the admin panel.</p>
            </div>

            {loadingTests ? (
              <div className="free-tests-empty">
                <div className="free-tests-empty-badge">LOADING</div>
                <h2>Loading free tests</h2>
                <p>Please wait while we fetch the latest uploaded tests.</p>
              </div>
            ) : freeTests.length > 0 ? (
              <div className="free-tests-grid">
                {freeTests.map((test) => (
                  <article className="free-test-card" key={test.id}>
                    <div className="free-test-topline">
                      <span className="free-badge">FREE</span>
                      <span className="free-test-type">{String(test.type || "test").replace(/-/g, " ").toUpperCase()}</span>
                    </div>
                    <h3>{test.testName || test.title || "Untitled Test"}</h3>
                    <p>{test.subject || test.planTag || "Uploaded free test"}</p>
                    <div className="free-test-meta">
                      <span>{test.questionCount || test.parsedQuestions?.length || 0} questions</span>
                      {test.date ? <span>{String(test.date).split("T")[0]}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="attempt-quiz-btn"
                      onClick={() => navigate(`/test/${test.id}`)}
                    >
                      Start Test
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="free-tests-empty">
                <div className="free-tests-empty-badge">NOT FOUND</div>
                <h2>Free tests not found</h2>
                <p>There are no uploaded free tests to show here right now.</p>
              </div>
            )}
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