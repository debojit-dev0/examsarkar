import "./MainsTestSeriesPage.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import Navbar from "../../components/Navbar/Navbar";
import { useSEO } from "../../hooks/useSEO";
import { buildApiUrl } from "../../utils/apiBaseUrl";
import { restoreAuthSession } from "../../api/authApi";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let _rzpScriptPromise = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!_rzpScriptPromise) {
    _rzpScriptPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = RAZORPAY_SCRIPT;
      s.onload = () => resolve(true);
      s.onerror = () => { _rzpScriptPromise = null; resolve(false); };
      document.body.appendChild(s);
    });
  }
  return _rzpScriptPromise;
}

function showToast(msg, type = "info") {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;top:20px;right:20px;padding:14px 20px;border-radius:8px;color:#fff;font-weight:600;font-size:14px;z-index:99999;max-width:360px;background:${type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#3b82f6"}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const SUBJECT_LABELS = {
  gs1: 'GS Paper I',
  gs2: 'GS Paper II',
  gs3: 'GS Paper III',
  gs4: 'GS Paper IV',
  essay: 'Essay Writing'
};

export default function MainsTestSeriesPage({ onLoginClick, onSignupClick }) {
  const navigate = useNavigate();

  useSEO({
    title: "UPSC Mains Test Series – GS1, GS2, GS3, GS4 & Essay Practice",
    description:
      "Premium UPSC Mains test series with GS1, GS2, GS3, GS4 and Essay practice modules. Structured answer writing practice for serious aspirants.",
    url: "https://www.examsarkar.com/mains-test-series",
  });

  const [hovered, setHovered] = useState(null);
  const [loadingSubject, setLoadingSubject] = useState(null);

  const handleStartPractice = async (item) => {
    let token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (!token) {
      try {
        const restoredSession = await restoreAuthSession();
        token = restoredSession?.accessToken || localStorage.getItem("accessToken") || localStorage.getItem("token");
      } catch (error) {
        console.error("Failed to restore mains session:", error);
      }
    }

    if (!token) {
      window.dispatchEvent(new CustomEvent("openAuthModal", { detail: { mode: "login" } }));
      return;
    }

    if (loadingSubject) return;
    setLoadingSubject(item.key);

    try {
      const planKey = `mains:${item.key}`;
      const planName = SUBJECT_LABELS[item.key] || item.title;

      // Check if already purchased — if so, go directly to dashboard
      const statusRes = await fetch(buildApiUrl(`/api/payment/status?planKey=${encodeURIComponent(planKey)}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.paid) {
          navigate("/dashboard");
          return;
        }
      }

      // Create Razorpay order on the server (price is set server-side, not from URL)
      const orderRes = await fetch(buildApiUrl("/api/payment/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planKey, planName })
      });

      if (orderRes.status === 401) {
        window.dispatchEvent(new CustomEvent("openAuthModal", { detail: { mode: "login" } }));
        return;
      }

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        showToast(orderData.message || "Could not start payment. Please try again.", "error");
        return;
      }

      const ok = await loadRazorpay();
      if (!ok) {
        showToast("Payment gateway unavailable. Check your internet connection.", "error");
        return;
      }

      const rzp = new window.Razorpay({
        key: orderData.key_id || process.env.REACT_APP_RAZORPAY_KEY_ID || "",
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "ExamSarkar",
        description: planName,
        order_id: orderData.order.id,
        handler: async function (response) {
          const verifyRes = await fetch(buildApiUrl("/api/payment/verify"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(response)
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) {
            showToast("Payment successful! Redirecting to dashboard...", "success");
            setTimeout(() => navigate("/dashboard"), 800);
          } else {
            showToast("Payment verification failed. Please contact support.", "error");
          }
        },
        modal: {
          ondismiss: () => {
            setLoadingSubject(null);
            showToast("Payment cancelled.", "info");
          }
        }
      });

      rzp.open();
    } catch (err) {
      console.error("Mains payment error:", err);
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoadingSubject(null);
    }
  };

  const sections = [
    {
      key: "gs1",
      title: "GS Paper I",
      subtitle: "History • Geography • Society",
      desc: "Build conceptual depth + structured answers for GS1.",
      route: "/mains/gs1",
      color: "#ff6b6b",
    },
    {
      key: "gs2",
      title: "GS Paper II",
      subtitle: "Polity • Governance • IR",
      desc: "Answer writing for polity, governance & international relations.",
      route: "/mains/gs2",
      color: "#4dabf7",
    },
    {
      key: "gs3",
      title: "GS Paper III",
      subtitle: "Economy • Environment • Security",
      desc: "Analytical answers for economy, tech & environment.",
      route: "/mains/gs3",
      color: "#51cf66",
    },
    {
      key: "gs4",
      title: "GS Paper IV",
      subtitle: "Ethics • Integrity • Aptitude",
      desc: "Case studies + ethical reasoning mastery.",
      route: "/mains/gs4",
      color: "#ffd43b",
    },
    {
      key: "essay",
      title: "Essay Writing",
      subtitle: "UPSC Essay Practice",
      desc: "Improve structure, flow, depth & expression.",
      route: "/mains/essay",
      color: "#b197fc",
    },
  ];

  return (
    <>
      <Navbar
        onHomeClick={() => navigate("/")}
        onMainsClick={() => navigate("/mains-test-series")}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      <div className="mains-container">
        <div className="mains-inner">

          {/* HERO */}
          <div className="mains-hero">
            <h1>UPSC Mains Test Series</h1>
            <p>
              Master answer writing with structured practice for GS1–GS4 and Essay.
            </p>
            <div className="mains-badge">
              Built for serious Mains aspirants
            </div>

            <div className="syllabus-glass-card">
  <div className="syllabus-content">
    <div className="syllabus-icon">📘</div>

    <div>
      <h3>Complete UPSC Mains Syllabus</h3>
      <p>
        GS Papers I–IV + Essay syllabus compiled in a structured, exam-ready format.
      </p>

      <div className="syllabus-tags">
        <span>✔ Official Pattern</span>
        <span>✔ Updated</span>
        <span>✔ Print Friendly</span>
      </div>
    </div>
  </div>

  <a
    href="/syllabus/SYLLABUS.docx"
    download
    className="syllabus-download-btn"
    onClick={(e) => e.stopPropagation()}
  >
    ⬇ Download Syllabus
  </a>
</div>
          </div>

          {/* GRID */}
          <div className="mains-grid">
            {sections.map((item, i) => (
              <div
                key={item.key}
                className={`mains-card ${hovered === i ? "hovered" : ""}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleStartPractice(item)}
                style={{
                  borderTop: `4px solid ${item.color}`,
                }}
              >
                <div className="mains-card-top">
                  <span
                    className="dot"
                    style={{ background: item.color }}
                  />
                  <span className="tag">SECTION</span>
                </div>

                <h2>{item.title}</h2>
                <h4>{item.subtitle}</h4>
                <p>{item.desc}</p>

                <div className="mains-card-footer">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartPractice(item); }}
                    disabled={loadingSubject === item.key}
                    style={{ opacity: loadingSubject === item.key ? 0.7 : 1, cursor: loadingSubject === item.key ? "wait" : "pointer" }}
                  >
                    {loadingSubject === item.key ? "Please wait..." : "Start Practice →"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* INFO SECTION */}
          <div className="mains-info">
            <h3>How this works</h3>
            <ul>
              <li>Daily answer writing practice</li>
              <li>UPSC-style evaluation structure</li>
              <li>Model answers + frameworks</li>
              <li>Progressive difficulty building</li>
            </ul>
          </div>

        </div>
      </div>
    </>
  );
}