import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaClipboardCheck,
  FaPenNib,
  FaCheckCircle,
  FaArrowRight,
} from "react-icons/fa";
import "./Tiles.css";

const testSeriesData = [
  {
    title: "Prelims Test Series",
    icon: FaClipboardCheck,
    description:
      "Master GS Paper I & CSAT through exam-oriented mock tests, detailed analytics, and real exam simulation.",
    points: [
      "GS Paper I & CSAT Coverage",
      "Timed Mock Tests",
      "Instant Results & Solutions",
      "Performance Analytics",
    ],
    buttonText: "Explore Prelims",
    path: "/test-series",
  },
  {
    title: "Mains Test Series",
    icon: FaPenNib,
    description:
      "Enhance answer-writing skills with structured Mains tests, evaluation, and detailed feedback.",
    points: [
      "GS I, II, III & IV Coverage",
      "Essay Practice",
      "Expert Evaluation",
      "Detailed Feedback",
    ],
    buttonText: "Explore Mains",
    path: "/mains-test-series",
  },
];

const TestSeries = () => {
  const navigate = useNavigate();

  return (
    <section className="container">
      <div className="section-header">
        <h2 className="heading">Choose Your Preparation Path</h2>
        <p className="subheading">
          Practice, evaluate and improve with structured UPSC-focused test
          series.
        </p>
      </div>

      <div className="cards">
        {testSeriesData.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              className="card"
              key={index}
              role="button"
              tabIndex={0}
              onClick={() => navigate(item.path)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  navigate(item.path);
                }
              }}
            >
              <div className="card-header">
                <div className="card-icon">
                  <Icon />
                </div>

                <h3 className="title">{item.title}</h3>
              </div>

              <p className="description">{item.description}</p>

              <ul className="features">
                {item.points.map((point, i) => (
                  <li key={i}>
                    <FaCheckCircle />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <button
                className="btn"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(item.path);
                }}
              >
                {item.buttonText}
                <FaArrowRight />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TestSeries;