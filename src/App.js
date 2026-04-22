import { useState, useRef } from "react";

import Navbar from "./components/Navbar/Navbar";
import HeroSlider from "./components/HeroSlider/HeroSlider";
import Tiles from "./components/Tiles/Tiles";
import WhyUs from "./components/WhyUs/WhyUs";
import FreeTest from "./components/FreeTest/FreeTest";
import HowItWorks from "./components/HowItWorks/HowItWorks";
import Testimonials from "./components/Testimonials/Testimonials";
import CTA from "./components/CTA/CTA";
import Footer from "./components/Footer/Footer";

import SignupModal from "./components/Auth/SignupModal";
import LoginModal from "./components/Auth/LoginModal";

import "./App.css";

function App() {
  const [authMode, setAuthMode] = useState(null);

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
    <>
      {/* NAVBAR (NOW FULLY CONNECTED) */}
      <Navbar
        onSignupClick={() => setAuthMode("signup")}
        onLoginClick={() => setAuthMode("login")}
        onHomeClick={scrollToHero}
        onPlansClick={scrollToPlans}
      />

      {/* HERO SECTION */}
      <div ref={heroRef}>
        <HeroSlider
          onSignupClick={() => setAuthMode("signup")}
          onLoginClick={() => setAuthMode("login")}
        />
      </div>

      {/* MAIN SECTIONS */}
      <Tiles />
      <WhyUs />
      <FreeTest />
      <HowItWorks />
      <Testimonials />
      <CTA />

      {/* PLANS TARGET (for navbar scroll) */}
      <div ref={plansRef}></div>

      {/* FOOTER */}
      <Footer />

      {/* ========================= */}
      {/* AUTH MODALS (GLOBAL CONTROL) */}
      {/* ========================= */}

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
  );
}

export default App;