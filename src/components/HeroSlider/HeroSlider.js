import { useEffect, useState } from "react";
import "./HeroSlider.css";
import { FaBullseye, FaRocket } from "react-icons/fa";


const images = [
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f",
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1170&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f"
];

export default function HeroSlider({ onSignupClick, onLoginClick }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="heroSlider">

      {/* BACKGROUND IMAGES */}
      {images.map((img, i) => (
        <div
          key={i}
          className={`bg ${i === index ? "active" : ""}`}
          style={{ backgroundImage: `url(${img})` }}
        />
      ))}

      {/* OVERLAY */}
      <div className="overlay"></div>

      {/* CONTENT */}
      <div className="content">

        <h1>Crack UPSC Prelims 2026</h1>

        <p>
          Practice smarter with CSAT, GS tests & real exam ranking
        </p>

        {/* BUTTONS */}
        <div className="buttons">
          <button className="primary" onClick={onSignupClick}>
            <FaRocket className="btn-icon" />
            Start Free Test
          </button>

          <button className="secondary" onClick={onLoginClick}>
            Login
          </button>
        </div>

        {/* HERO TAGS */}
        <div className="hero-tags">

          {/* LIVE STUDENTS (RED) */}
          <div className="tag-item live">
            <span className="live-dot"></span>
            {/* <FaFire className="tag-icon live-icon" /> */}
            <span>1,284 Students are Live Now</span>
          </div>

          <div className="divider">•</div>

          {/* REGISTERED (GREEN) */}
          <div className="tag-item registered">
            <span className="registered-dot"></span>
            {/* <FaChartBar className="tag-icon green"></FaChartBar> */}
            <span>10,532 Registered This Week</span>
          </div>

          <div className="divider">•</div>

          {/* SUCCESS RATE */}
          <div className="tag-item">
            <FaBullseye className="tag-icon blue" />
            <span>98% Students Improved Scores</span>
          </div>

        </div>

      </div>
    </section>
  );
}