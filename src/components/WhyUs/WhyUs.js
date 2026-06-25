import "./WhyUs.css";
import { FaTrophy, FaBookOpen, FaChartLine, FaBolt } from "react-icons/fa";

export default function WhyUs() {
  const features = [
    {
      icon: <FaBookOpen />,
      title: "UPSC-Level Question Quality",
      desc: "Every question is designed to match real UPSC Prelims & Mains difficulty standards."
    },
    {
      icon: <FaTrophy />,
      title: "All India Ranking System",
      desc: "Compete with serious aspirants across India and understand your real standing."
    },
    {
      icon: <FaChartLine />,
      title: "Deep Performance Analytics",
      desc: "Track accuracy, weak areas, and improvement trends with detailed insights."
    },
    {
      icon: <FaBolt />,
      title: "Real Exam Simulation",
      desc: "Timed tests with UPSC-like pressure to build speed, accuracy, and confidence."
    }
  ];

  return (
    <section className="whyus-section">
      <div className="whyus-container">

        {/* HEADER */}
        <div className="whyus-header">

          <div className="whyus-badge">
            Why Top UPSC Aspirants Trust Us
          </div>

          <h2>
            Built for Serious Aspirants,
            <span> Not Casual Learners</span>
          </h2>

          <p>
            Practice UPSC-level questions, analyze performance deeply,
            and simulate real exam pressure — all inside one ecosystem designed for selection.
          </p>

        </div>

        {/* GRID */}
        <div className="whyus-grid">
          {features.map((item, index) => (
            <div className="whyus-card" key={index}>
              <div className="whyus-icon-wrap">
                <div className="whyus-icon">{item.icon}</div>
              </div>

              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* HIGHLIGHTS */}
        <div className="whyus-highlight-row">
          <div className="whyus-highlight-pill">Daily Practice System</div>
          <div className="whyus-highlight-pill">Real Exam Environment</div>
          <div className="whyus-highlight-pill">Nationwide Competition</div>
        </div>

        {/* FOOTER LINE */}
        <div className="whyus-footer-note">
          Consistency wins UPSC — we help you stay consistent, focused, and exam-ready.
        </div>

      </div>
    </section>
  );
}