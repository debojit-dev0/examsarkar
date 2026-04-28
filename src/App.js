import { useState, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar/Navbar";
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
import AdminAuthPage from "./pages/Admin/AdminAuthPage";

import "./App.css";


// NEW WRAPPER COMPONENT (handles navigation)
function AppContent() {
  const [authMode, setAuthMode] = useState(null);

  const navigate = useNavigate();

  // refs for smooth scroll
  const heroRef = useRef(null);

  const scrollToHero = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
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
              onLoginClick={() => setAuthMode("login")}
              onHomeClick={scrollToHero}
              onPlansClick={() => navigate("/test-series")} //  CHANGED HERE
              onFreeDailyTestClick={() => navigate("/test-series#free-daily-test")}
            />

            {/* HERO */}
            <div ref={heroRef}>
              <HeroSlider
                onSignupClick={() => setAuthMode("signup")}
                onLoginClick={() => setAuthMode("login")}
              />
              
            </div>
            {/* MAIN SECTIONS */}
            <Tiles />
            <WhyUs />
            {/* <FreeTest /> */}
            <HowItWorks />
            <Testimonials />
            <CTA />

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

      {/* ================= ADMIN PANEL ================= */}
      <Route path="/admin" element={<AdminAuthPage />} />

    </Routes>
  );
}


// 🔥 MAIN APP EXPORT
function App() {
  return <AppContent />;
}

export default App;