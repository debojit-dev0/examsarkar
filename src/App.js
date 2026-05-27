import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import HeroSlider from "./components/HeroSlider/HeroSlider";
import "./App.css";
import { buildApiUrl } from "./utils/apiBaseUrl";

const Tiles = lazy(() => import("./components/Tiles/Tiles"));
const WhyUs = lazy(() => import("./components/WhyUs/WhyUs"));
const HowItWorks = lazy(() => import("./components/HowItWorks/HowItWorks"));
const Testimonials = lazy(() => import("./components/Testimonials/Testimonials"));
const CTA = lazy(() => import("./components/CTA/CTA"));
const Footer = lazy(() => import("./components/Footer/Footer"));

const SignupModal = lazy(() => import("./components/Auth/SignupModal"));
const LoginModal = lazy(() => import("./components/Auth/LoginModal"));

const TestSeriesPage = lazy(() => import("./pages/TestSeries/TestSeriesPage"));
const TestPage = lazy(() => import("./pages/TestPage/TestPage"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const AdminAuthPage = lazy(() => import("./pages/Admin/AdminAuthPage"));
const ContactPage = lazy(() => import("./pages/Contact/ContactPage"));

const sectionFallback = <div style={{ minHeight: 120 }} />;

function DeferredSection({ minHeight = 120, rootMargin = "250px 0px", children }) {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (shouldRender || !containerRef.current) return;

    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={containerRef} style={{ minHeight }}>
      {shouldRender ? <Suspense fallback={sectionFallback}>{children}</Suspense> : sectionFallback}
    </div>
  );
}


// 🔥 NEW WRAPPER COMPONENT (handles navigation)
function AppContent() {
  const [authMode, setAuthMode] = useState(null);
  const [homeStats, setHomeStats] = useState(null);
  const navigate = useNavigate();

  // listen for global events to open auth modals (used by PaymentModal)
  useEffect(() => {
    const handler = (e) => {
      const mode = e?.detail?.mode;
      if (mode === 'login' || mode === 'signup') setAuthMode(mode);
    };
    window.addEventListener('openAuthModal', handler);
    return () => window.removeEventListener('openAuthModal', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      navigate('/dashboard');
    };

    window.addEventListener('paymentSuccess', handler);
    return () => window.removeEventListener('paymentSuccess', handler);
  }, [navigate]);

  useEffect(() => {
    let isActive = true;

    const loadStats = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/stats"));
        if (!response.ok) return;
        const data = await response.json();
        if (isActive) {
          setHomeStats(data.stats || null);
        }
      } catch (error) {
        console.error("Failed to load home stats:", error);
      }
    };

    loadStats();

    return () => {
      isActive = false;
    };
  }, []);

  const handleLoginClick = () => {
    const hasSession = Boolean(localStorage.getItem("accessToken") || localStorage.getItem("refreshToken"));
    if (hasSession) {
      // if already logged in, navigate to dashboard
      navigate("/dashboard");
      return;
    }

    setAuthMode("login");
  };

  const handleStartFreeTest = () => {
    navigate("/test-series");
  };

  // refs for smooth scroll
  const heroRef = useRef(null);

  const scrollToHero = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Suspense fallback={<div className="app-shell-loading">Loading...</div>}>
    <Routes>

      {/* ================= HOME PAGE ================= */}
      <Route
        path="/"
        element={
          <>
            {/* NAVBAR */}
            <Navbar
              onSignupClick={() => setAuthMode("signup")}
              onLoginClick={handleLoginClick}
              onHomeClick={scrollToHero}
              onPlansClick={() => navigate("/test-series")} // 🔥 CHANGED HERE
            />

            {/* HERO */}
            <div ref={heroRef}>
              <HeroSlider
                onStartFreeTest={handleStartFreeTest}
                onLoginClick={handleLoginClick}
                onDashboardClick={() => navigate("/dashboard")}
                isLoggedIn={Boolean(localStorage.getItem("accessToken") || localStorage.getItem("refreshToken"))}
                stats={homeStats}
              />
            </div>

            {/* MAIN SECTIONS */}
            <DeferredSection minHeight={180}>
              <Tiles />
            </DeferredSection>
            <DeferredSection minHeight={180}>
              <WhyUs />
            </DeferredSection>
            {/* <FreeTest /> */}
            <DeferredSection minHeight={160}>
              <HowItWorks />
            </DeferredSection>
            <DeferredSection minHeight={160}>
              <Testimonials />
            </DeferredSection>
            <DeferredSection minHeight={160}>
              <CTA
                onStartFreeTest={handleStartFreeTest}
                onExploreTestSeries={() => navigate("/test-series")}
                stats={homeStats}
              />
            </DeferredSection>

            {/* FOOTER */}
            <DeferredSection minHeight={140}>
              <Footer />
            </DeferredSection>

            {/* AUTH MODALS */}
            {authMode === "signup" && (
              <Suspense fallback={null}>
                <SignupModal
                  isOpen={authMode === "signup"}
                  onClose={() => setAuthMode(null)}
                  switchToLogin={() => setAuthMode("login")}
                />
              </Suspense>
            )}

            {authMode === "login" && (
              <Suspense fallback={null}>
                <LoginModal
                  isOpen={authMode === "login"}
                  onClose={() => setAuthMode(null)}
                  switchToSignup={() => setAuthMode("signup")}
                />
              </Suspense>
            )}
          </>
        }
      />

      {/* ================= TEST SERIES PAGE ================= */}
      <Route path="/test-series" element={<TestSeriesPage onLoginClick={handleLoginClick} onSignupClick={() => setAuthMode("signup")} />} />
      
      {/* ================= TEST QUIZ PAGE ================= */}
      <Route path="/test/:testId" element={<TestPage onLoginClick={handleLoginClick} onSignupClick={() => setAuthMode("signup")} />} />
      
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/admin" element={<AdminAuthPage />} />
      <Route path="/contact" element={<ContactPage onLoginClick={handleLoginClick} onSignupClick={() => setAuthMode("signup")} onHomeClick={scrollToHero} onPlansClick={() => navigate("/test-series")} />} />

    </Routes>
    </Suspense>
  );
}


// 🔥 MAIN APP EXPORT
function App() {
  return <AppContent />;
}

export default App;