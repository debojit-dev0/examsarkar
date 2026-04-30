import { useState, useRef, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
import { showPaymentModal } from "./components/Payment/PaymentModal";
import HeroSlider from "./components/HeroSlider/HeroSlider";
import Tiles from "./components/Tiles/Tiles";
import WhyUs from "./components/WhyUs/WhyUs";
// import FreeTest from "./components/FreeTest/FreeTest";
import HowItWorks from "./components/HowItWorks/HowItWorks";
import Testimonials from "./components/Testimonials/Testimonials";
import CTA from "./components/CTA/CTA";
import Footer from "./components/Footer/Footer";

import SignupModal from "./components/Auth/SignupModal";
import LoginModal from "./components/Auth/LoginModal";

import TestSeriesPage from "./pages/TestSeries/TestSeriesPage";
import Dashboard from "./pages/Dashboard/Dashboard";
import PaymentPage from "./pages/PaymentPage";

import "./App.css";


// 🔥 NEW WRAPPER COMPONENT (handles navigation)
function AppContent() {
  const [authMode, setAuthMode] = useState(null);

  // listen for global events to open auth modals (used by PaymentModal)
  useEffect(() => {
    const handler = (e) => {
      const mode = e?.detail?.mode;
      if (mode === 'login' || mode === 'signup') setAuthMode(mode);
    };
    window.addEventListener('openAuthModal', handler);
    return () => window.removeEventListener('openAuthModal', handler);
  }, []);

  const navigate = useNavigate();

  const handleLoginClick = () => {
    const hasSession = Boolean(localStorage.getItem("token") || localStorage.getItem("user"));
    if (hasSession) {
      // open payment as modal when already logged in
      showPaymentModal({ plan: 'Subscription', price: 499 });
      return;
    }

    setAuthMode("login");
  };

  // refs for smooth scroll
  const heroRef = useRef(null);
  const plansRef = useRef(null);

  const scrollToHero = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
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
                onSignupClick={() => setAuthMode("signup")}
                onLoginClick={handleLoginClick}
              />
            </div>

            {/* MAIN SECTIONS */}
            <Tiles />
            <WhyUs />
            {/* <FreeTest /> */}
            <HowItWorks />
            <Testimonials />
            <CTA />

            {/* SCROLL TARGET */}
            <div ref={plansRef}></div>

            {/* FOOTER */}
            <Footer />

            {/* AUTH MODALS */}
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
          </>
        }
      />

      {/* ================= TEST SERIES PAGE ================= */}
      <Route path="/test-series" element={<TestSeriesPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/payment" element={<PaymentPage />} />

    </Routes>
  );
}


// 🔥 MAIN APP EXPORT
function App() {
  return <AppContent />;
}

export default App;