import "./TestSeriesPage.css";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Navbar from "../../components/Navbar/Navbar";
import PlanSection from "../../components/PlanCard/PlanSection";
import SignupModal from "../../components/Auth/SignupModal";
import LoginModal from "../../components/Auth/LoginModal";
import { preloadRazorpayCheckout, startPaymentCheckout } from "../../components/Payment/PaymentModal";
import { loadPrelimsBannerSlides } from "../../utils/adminTestsStore";
import { useSEO } from "../../hooks/useSEO";
import ScholarshipTest from "../../components/ScholarshipTest/ScholarshipTest";
const DEFAULT_BANNER_SLIDES = [
  {
    id: "prelims-banner-1",
    title: "AIR 1 Mindset",
    subtitle: "Consistency beats talent when strategy is right",
    imageUrl: "https://media.assettype.com/english-sentinelassam/import/h-upload/2022/08/18/375889-lbsnaa.webp?auto=format%2Ccompress&fit=max&w=1200",
    link: "/test-series"
  },
  {
    id: "prelims-banner-2",
    title: "Daily Discipline",
    subtitle: "Small tests. Daily improvement. Big results.",
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    link: "/test-series"
  },
  {
    id: "prelims-banner-3",
    title: "Built for UPSC",
    subtitle: "Aligned with real exam pattern & pressure",
    imageUrl: "https://images.unsplash.com/photo-1505666287802-931dc83a4c1b?auto=format&fit=crop&w=1200&q=80",
    link: "/test-series"
  }
];

const normalizeBannerSlides = (slides) => {
  const source = Array.isArray(slides) && slides.length > 0 ? slides : DEFAULT_BANNER_SLIDES;
  return DEFAULT_BANNER_SLIDES.map((fallback, index) => {
    const item = source[index] || fallback;
    return {
      id: String(item?.id || fallback.id),
      title: String(item?.title || fallback.title).trim(),
      subtitle: String(item?.subtitle || fallback.subtitle).trim(),
      imageUrl: String(item?.imageUrl || item?.img || fallback.imageUrl).trim(),
      link: String(item?.link || fallback.link).trim()
    };
  });
};

const isExternalLink = (link) => /^https?:\/\//i.test(String(link || ""));


export default function TestSeriesPage({ onLoginClick, onSignupClick }) {
  useSEO({
    title: "Free UPSC Mock Tests & Daily Quizzes – Test Series",
    description:
      "Access free daily UPSC quizzes and premium full-length mock test series on ExamSarkar. Practice IAS, SSC, and government exam questions with detailed solutions.",
    url: "https://www.examsarkar.com/test-series",
  });
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null); // Store which plan user selected
  const [bannerSlides, setBannerSlides] = useState(DEFAULT_BANNER_SLIDES);

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

    const loadBannerSlides = async () => {
      try {
        const slides = await loadPrelimsBannerSlides();
        if (!isActive) return;
        setBannerSlides(normalizeBannerSlides(slides));
      } catch (error) {
        console.error("Failed to load prelims banner slides:", error);
        if (isActive) {
          setBannerSlides(DEFAULT_BANNER_SLIDES);
        }
      }
    };

    loadBannerSlides();

    return () => {
      isActive = false;
    };
  }, []);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= bannerSlides.length) {
      setIndex(0);
    }
  }, [bannerSlides.length, index]);

  useEffect(() => {
    if (bannerSlides.length === 0) return undefined;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % bannerSlides.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [bannerSlides.length]);

  useEffect(() => {
    preloadRazorpayCheckout();
  }, []);
  useEffect(() => {
  if (window.location.hash === '#scholarship-section') {
    const el = document.getElementById('scholarship-section');
    if (el) {
      setTimeout(() => {
        const navbarHeight = 90; // adjust if your navbar is taller/shorter
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - navbarHeight, behavior: 'smooth' });
      }, 300);
    }
  }
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
              {bannerSlides.map((slide, i) => {
                const slideContent = (
                  <div
                    className="slide"
                    style={{ backgroundImage: `url(${slide.imageUrl})` }}
                  >
                    <div className="overlay">
                      <h2>{slide.title}</h2>
                      <p>{slide.subtitle}</p>
                    </div>
                  </div>
                );

                if (isExternalLink(slide.link)) {
                  return (
                    <a
                      className="slide-link"
                      key={slide.id || i}
                      href={slide.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {slideContent}
                    </a>
                  );
                }

                return (
                  <Link className="slide-link" key={slide.id || i} to={slide.link || "/test-series"}>
                    {slideContent}
                  </Link>
                );
              })}
            </div>

            <div className="dots">
              {bannerSlides.map((_, i) => (
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

          <div id="scholarship-section" className="test-series-scholarship-section" style={{ marginTop: "24px", marginBottom: "24px" }}>
          <ScholarshipTest hideLeaderboard hideWinnersBanner />
        </div>
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