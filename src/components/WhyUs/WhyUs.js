import "./WhyUs.css";
import { FaTrophy, FaBookOpen, FaChartLine, FaBolt } from "react-icons/fa";

export default function WhyUs() {
  const features = [
    {
      icon: <FaBookOpen />,
      title: "UPSC-Level Questions",
      desc: "Curated questions matching real exam difficulty and patterns."
    },
    {
      icon: <FaTrophy />,
      title: "All India Ranking",
      desc: "Compete with aspirants nationwide and track your true performance."
    },
    {
      icon: <FaChartLine />,
      title: "Detailed Analytics",
      desc: "Understand strengths, weaknesses and improve with data-driven insights."
    },
    {
      icon: <FaBolt />,
      title: "Real Exam Experience",
      desc: "Simulate actual exam environment with timer & structured tests."
    }
  ];

  return (
    <section className="whyus-section">
      <div className="whyus-container">
        <div className="whyus-eyebrow">Why students choose ExamSarkar</div>

        <div className="whyus-header">
          <h2>Still Wondering Why Students Choose Us?</h2>
          <p>
            Everything you need to crack UPSC — practice, analysis, and real exam simulation in one place.
          </p>
        </div>

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

        <div className="whyus-highlight-row">
          <div className="whyus-highlight-pill">Built for serious UPSC prep</div>
          <div className="whyus-highlight-pill">Practice, rank, review, improve</div>
          <div className="whyus-highlight-pill">Fast, focused, exam-ready</div>
        </div>

        <div className="whyus-footer-note">
          Start your preparation journey today — consistency beats talent.
        </div>

      </div>
    </section>
  );
}