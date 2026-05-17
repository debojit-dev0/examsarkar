import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBolt,
  FaGlobe,
  FaBook,
  FaCheckCircle,
} from "react-icons/fa";
import "./Tiles.css";

const testSeriesData = [
  {
    title: "UPSC Prelims 2026 Complete Test Series",
    users: "120K+",
    tests: "85 Total Tests",
    free: "10 Free Tests",
    lang: "English, Hindi",
    points: [
      "Full Length Mock Tests",
      "Sectional Tests",
      "Previous Year Questions",
    ],
  },
  {
    title: "CSAT Prelims 2026 Test Series",
    users: "80K+",
    tests: "60 Total Tests",
    free: "8 Free Tests",
    lang: "English, Hindi",
    points: [
      "Quantitative Aptitude",
      "Logical Reasoning",
      "Comprehension Practice",
    ],
  },
];

const TestSeries = () => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <h2 className="heading">Popular Test Series</h2>

      <div className="cards">
        {testSeriesData.map((item, index) => (
          <div
            className="card"
            key={index}
            role="button"
            tabIndex={0}
            onClick={() => navigate("/test-series")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                navigate("/test-series");
              }
            }}
          >
            
            <div className="card-top">
              <div className="logo">
                <FaBook />
              </div>

              <div className="users">
                <FaBolt /> {item.users}
              </div>
            </div>

            <h3 className="title">{item.title}</h3>

            <p className="tests">
              {item.tests} | <span>{item.free}</span>
            </p>

            <p className="lang">
              <FaGlobe /> {item.lang}
            </p>

            <ul className="features">
              {item.points.map((p, i) => (
                <li key={i}>
                  <FaCheckCircle /> {p}
                </li>
              ))}
            </ul>

            <button
              className="btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate("/test-series");
              }}
            >
              View Test Series
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestSeries;