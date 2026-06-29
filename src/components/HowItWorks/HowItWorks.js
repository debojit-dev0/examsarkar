import React from "react";
import {
  FaBookOpen,
  FaPen,
  FaChartBar,
  FaRocket,
} from "react-icons/fa";
import "./HowItWorks.css";

const steps = [
  {
    icon: <FaBookOpen />,
    title: "Choose Your Test Series",
    desc: "Select UPSC Prelims or CSAT based on your preparation goals.",
  },
  {
    icon: <FaPen />,
    title: "Attempt Real Exam Tests",
    desc: "Practice with exam-level mock tests designed by experts.",
  },
  {
    icon: <FaChartBar />,
    title: "Analyze Your Performance",
    desc: "Get detailed insights on accuracy, speed & weak areas.",
  },
  {
    icon: <FaRocket />,
    title: "Improve & Crack UPSC",
    desc: "Track progress and boost your chances of success.",
  },
];

const HowItWorks = () => {
  return (
    <div className="how-container">
      <h2 className="how-heading">Your Path to UPSC Success</h2>

      <div className="steps">

        {steps.map((step, index) => (
          <div className="step-card" key={index}>
            
            <div className="icon">{step.icon}</div>

            <h3>{step.title}</h3>
            <p>{step.desc}</p>

            {/* Connector Line */}
            {index !== steps.length - 1 && <div className="connector"></div>}
          </div>
        ))}

      </div>
    </div>
  );
};

export default HowItWorks;