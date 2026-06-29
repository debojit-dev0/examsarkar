import { useState } from "react";
import "./FreeTest.css";

const mockQuestions = [
  {
    id: 1,
    question: "Who is the President of India?",
    options: ["A. Modi", "B. Draupadi Murmu", "C. Kovind", "D. Manmohan Singh"],
    answer: "B. Draupadi Murmu"
  },
  {
    id: 2,
    question: "Capital of India?",
    options: ["A. Mumbai", "B. Delhi", "C. Kolkata", "D. Chennai"],
    answer: "B. Delhi"
  }
];

export default function FreeTestQuiz() {
  const [selected, setSelected] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (qId, option) => {
    setSelected((prev) => ({
      ...prev,
      [qId]: option
    }));
  };

  const handleSubmit = () => {
    setSubmitted(true);

    // 🚨 AFTER SUBMIT → REDIRECT TO LOGIN
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="submittedScreen">
        <h2>Redirecting to Login...</h2>
        <p>Please login to view your result</p>
      </div>
    );
  }

  return (
    <div className="quizContainer">

      <h2>Free UPSC Mock Test</h2>

      {mockQuestions.map((q) => (
        <div key={q.id} className="questionCard">

          <h3>{q.question}</h3>

          <div className="options">
            {q.options.map((opt, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={selected[q.id] === opt}
                  onChange={() => handleSelect(q.id, opt)}
                />
                {opt}
              </label>
            ))}
          </div>

        </div>
      ))}

      <button className="submitBtn" onClick={handleSubmit}>
        Submit Test
      </button>

    </div>
  );
}