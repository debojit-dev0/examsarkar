import "./MainsTestSeriesPage.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import Navbar from "../../components/Navbar/Navbar";
import { useSEO } from "../../hooks/useSEO";

export default function MainsTestSeriesPage({ onLoginClick, onSignupClick }) {
  const navigate = useNavigate();

  useSEO({
    title: "UPSC Mains Test Series – GS1, GS2, GS3, GS4 & Essay Practice",
    description:
      "Premium UPSC Mains test series with GS1, GS2, GS3, GS4 and Essay practice modules. Structured answer writing practice for serious aspirants.",
    url: "https://www.examsarkar.com/mains-test-series",
  });

  const [hovered, setHovered] = useState(null);

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
        onPlansClick={() => navigate("/mains-test-series")}
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
          </div>

          {/* GRID */}
          <div className="mains-grid">
            {sections.map((item, i) => (
              <div
                key={item.key}
                className={`mains-card ${hovered === i ? "hovered" : ""}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(item.route)}
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
                  <button>
                    Start Practice →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* INFO SECTION */}
          <div className="mains-info">
            <h3>How this works</h3>
            <ul>
              <li>Daily/weekly answer writing practice</li>
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