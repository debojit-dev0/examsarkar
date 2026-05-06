import { lazy, Suspense, useState, useRef, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import HeroSlider from "./components/HeroSlider/HeroSlider";
import "./App.css";

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

const sectionFallback = <div style={{ minHeight: 120 }} />;


// 🔥 NEW WRAPPER COMPONENT (handles navigation)
function AppContent() {
  const [authMode, setAuthMode] = useState(null);
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

  const handleLoginClick = () => {
    const hasSession = Boolean(localStorage.getItem("token") || localStorage.getItem("user"));
    if (hasSession) {
      // if already logged in, navigate to dashboard
      navigate("/dashboard");
      return;
    }

    setAuthMode("login");
  };

  const handleStartFreeTest = () => {
    const hasSession = Boolean(localStorage.getItem("token") || localStorage.getItem("user"));
    if (hasSession) {
      // if logged in, go to test series
      navigate("/test-series");
      return;
    }

    // if not logged in, show login modal
    setAuthMode("login");
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
              />
            </div>

            {/* MAIN SECTIONS */}
            <Suspense fallback={sectionFallback}>
              <Tiles />
            </Suspense>
            <Suspense fallback={sectionFallback}>
              <WhyUs />
            </Suspense>
            {/* <FreeTest /> */}
            <Suspense fallback={sectionFallback}>
              <HowItWorks />
            </Suspense>
            <Suspense fallback={sectionFallback}>
              <Testimonials />
            </Suspense>
            <Suspense fallback={sectionFallback}>
              <CTA
                onStartFreeTest={handleStartFreeTest}
                onExploreTestSeries={() => navigate("/test-series")}
              />
            </Suspense>

            {/* FOOTER */}
            <Suspense fallback={sectionFallback}>
              <Footer />
            </Suspense>

            {/* AUTH MODALS */}
            <Suspense fallback={null}>
              <SignupModal
                isOpen={authMode === "signup"}
                onClose={() => setAuthMode(null)}
                switchToLogin={() => setAuthMode("login")}
              />

              <LoginModal
                isOpen={authMode === "login"}
                onClose={() => setAuthMode(null)}
                switchToSignup={() => setAuthMode("signup")}
              />
            </Suspense>
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

    </Routes>
    </Suspense>
  );
}


// 🔥 MAIN APP EXPORT
function App() {
  return <AppContent />;
}

export default App;