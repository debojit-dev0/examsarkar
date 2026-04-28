import "./TestSeriesPage.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";

import Navbar from "../../components/Navbar/Navbar";
import PlanSection from "../../components/PlanCard/PlanSection";
import { getLatestFreeDailyQuiz, loadAdminTests } from "../../utils/adminTestsStore";

const TOPICS = [
  "Indian Polity",
  "Modern History",
  "Economy",
  "Geography",
  "Environment",
  "Science & Tech"
];

function buildQuestionBank(totalQuestions) {
  const total = Math.min(100, Math.max(10, totalQuestions || 20));

  return Array.from({ length: total }, (_, index) => {
    const topic = TOPICS[index % TOPICS.length];
    const questionNumber = index + 1;

    return {
      id: questionNumber,
      topic,
      question: `Q${questionNumber}. Which statement is correct about ${topic}?`,
      options: [
        `${topic} is only relevant for mains, not prelims.`,
        `${topic} can be ignored if current affairs are strong.`,
        `${topic} requires both conceptual clarity and revision-based practice.`,
        `${topic} has no relation with UPSC test-taking strategy.`
      ],
      answerIndex: 2
    };
  });
}

function buildQuestionBankFromUploaded(test) {
  const parsed = Array.isArray(test?.parsedQuestions) ? test.parsedQuestions : [];
  if (!parsed.length) return [];

  return parsed.map((item, index) => ({
    id: index + 1,
    topic: TOPICS[index % TOPICS.length],
    question: item.question,
    options: item.options,
    answerIndex: Number.isInteger(item.answerIndex) ? item.answerIndex : -1
  }));
}

function formatQuestionText(rawText) {
  const base = String(rawText || "").replace(/\r\n?/g, "\n").trim();
  if (!base) return "";

  // Keep statement-style lines (1./2./3.) on separate lines for readability.
  return base
    .replace(/\s+([1-9]\d*\.)\s+/g, "\n$1 ")
    .replace(/\s+(Which\s+of\s+the\s+statements?\s+given\s+below\s+is\/are\s+correct\??)/i, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function TestSeriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const freeDailyRef = useRef(null);

  const slides = [
    {
      title: "AIR 1 Mindset",
      desc: "Consistency beats talent when strategy is right",
      img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f"
    },
    {
      title: "Daily Discipline",
      desc: "Small tests. Daily improvement. Big results.",
      img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085"
    },
    {
      title: "Built for UPSC",
      desc: "Aligned with real exam pattern & pressure",
      img: "https://images.unsplash.com/photo-1505666287802-931dc83a4c1b"
    }
  ];

  const [index, setIndex] = useState(0);
  const [tests, setTests] = useState([]);
  const [isExamMode, setIsExamMode] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [questionBank, setQuestionBank] = useState([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [reviewFlags, setReviewFlags] = useState({});
  const [visitedFlags, setVisitedFlags] = useState({ 1: true });
  const [submittedSummary, setSubmittedSummary] = useState(null);

  const selectedDailyQuiz = useMemo(() => getLatestFreeDailyQuiz(tests), [tests]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    let isActive = true;

    const refreshTests = async () => {
      try {
        const remoteTests = await loadAdminTests();
        if (!isActive) return;
        setTests(remoteTests);
      } catch (error) {
        console.error("Failed to load tests:", error);
        if (isActive) {
          setTests([]);
        }
      }
    };

    refreshTests();

    const handleFocus = () => {
      refreshTests();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      isActive = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (location.hash === "#free-daily-test") {
      freeDailyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  useEffect(() => {
    if (!isExamMode || !isTestRunning || timeLeftSec <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          setIsTestRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamMode, isTestRunning, timeLeftSec]);

  useEffect(() => {
    setIsExamMode(false);
    setIsTestRunning(false);
    setTimeLeftSec(0);
    setQuestionBank([]);
    setSelectedAnswers({});
    setReviewFlags({});
    setVisitedFlags({ 1: true });
    setActiveQuestionIndex(0);
    setSubmittedSummary(null);
  }, [selectedDailyQuiz?.id]);

  useEffect(() => {
    if (!questionBank.length) return;
    const currentQuestion = questionBank[activeQuestionIndex];
    if (!currentQuestion) return;

    setVisitedFlags((prev) => ({
      ...prev,
      [currentQuestion.id]: true
    }));
  }, [activeQuestionIndex, questionBank]);

  const formatTimer = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleFreeDailyTestNav = () => {
    freeDailyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRunTest = () => {
    if (!selectedDailyQuiz) return;
    const uploadedQuestionBank = buildQuestionBankFromUploaded(selectedDailyQuiz);
    const resolvedQuestionBank = uploadedQuestionBank.length
      ? uploadedQuestionBank
      : buildQuestionBank(Math.min(100, Math.max(10, selectedDailyQuiz.questionCount || 20)));

    const durationMinutes = Math.min(120, Math.max(15, Math.ceil(resolvedQuestionBank.length * 0.9)));

    setQuestionBank(resolvedQuestionBank);
    setSelectedAnswers({});
    setReviewFlags({});
    setVisitedFlags({ 1: true });
    setActiveQuestionIndex(0);
    setSubmittedSummary(null);
    setTimeLeftSec(durationMinutes * 60);
    setIsExamMode(true);
    setIsTestRunning(true);
  };

  const handleEndTest = () => {
    setIsExamMode(false);
    setIsTestRunning(false);
    setTimeLeftSec(0);
    setSubmittedSummary(null);
  };

  const activeQuestion = questionBank[activeQuestionIndex];

  const getQuestionStatus = (questionId) => {
    if (reviewFlags[questionId]) return "review";
    if (selectedAnswers[questionId] !== undefined) return "answered";
    if (visitedFlags[questionId]) return "not-answered";
    return "unattempted";
  };

  const metrics = {
    answered: 0,
    review: 0,
    notAnswered: 0,
    unattempted: 0
  };

  questionBank.forEach((question) => {
    const status = getQuestionStatus(question.id);
    if (status === "answered") metrics.answered += 1;
    if (status === "review") metrics.review += 1;
    if (status === "not-answered") metrics.notAnswered += 1;
    if (status === "unattempted") metrics.unattempted += 1;
  });

  const handleSelectOption = (optionIndex) => {
    if (!activeQuestion) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: optionIndex
    }));
  };

  const handleMarkForReview = () => {
    if (!activeQuestion) return;
    setReviewFlags((prev) => ({
      ...prev,
      [activeQuestion.id]: true
    }));
  };

  const handleClearAnswer = () => {
    if (!activeQuestion) return;

    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[activeQuestion.id];
      return next;
    });

    setReviewFlags((prev) => {
      const next = { ...prev };
      delete next[activeQuestion.id];
      return next;
    });
  };

  const goPrevious = () => {
    setActiveQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setActiveQuestionIndex((prev) => Math.min(questionBank.length - 1, prev + 1));
  };

  const handleSubmitTest = () => {
    if (!questionBank.length) return;

    const correct = questionBank.reduce((count, question) => {
      return selectedAnswers[question.id] === question.answerIndex ? count + 1 : count;
    }, 0);

    const answeredCount = Object.keys(selectedAnswers).length;
    const accuracy = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;

    setIsTestRunning(false);
    setSubmittedSummary({
      correct,
      answered: answeredCount,
      total: questionBank.length,
      accuracy
    });
  };

  if (isExamMode && activeQuestion) {
    return (
      <>
        <Navbar
          onHomeClick={() => navigate("/")}
          onPlansClick={() => navigate("/test-series")}
          onFreeDailyTestClick={() => freeDailyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />

        <div className="exam-shell">
          <div className="exam-topbar">
            <h1>UPSC Prelims Daily Test</h1>
            <div className="exam-topbar-meta">
              <p>Time Left: {formatTimer(timeLeftSec)}</p>
              <button type="button" className="exam-ghost-btn">View Leaderboard</button>
            </div>
          </div>

          <div className="exam-layout">
            <aside className="exam-left-panel">
              <h3>Questions</h3>
              <ul>
                <li>Attempted: {metrics.answered}</li>
                <li>Not Answered: {metrics.notAnswered}</li>
                <li>Marked for Review: {metrics.review}</li>
                <li>Unattempted: {metrics.unattempted}</li>
              </ul>

              <button type="button" className="exam-primary-btn" onClick={handleSubmitTest}>Submit Test</button>
              <button type="button" className="exam-danger-btn" onClick={handleEndTest}>Exit Test</button>
            </aside>

            <main className="exam-center-panel">
              <div className="exam-meta">
                <h2>{selectedDailyQuiz?.testName || "General Studies Paper"}</h2>
                <p>{questionBank.length} Questions | 200 Marks</p>
                <p>Negative Marking - 0.66 for incorrect answers</p>
              </div>

              <section className="question-card">
                <h3 className="question-text">{formatQuestionText(activeQuestion.question)}</h3>

                <div className="option-list">
                  {activeQuestion.options.map((option, optionIndex) => (
                    <label key={option} className="option-item">
                      <input
                        type="radio"
                        name={`question-${activeQuestion.id}`}
                        checked={selectedAnswers[activeQuestion.id] === optionIndex}
                        onChange={() => handleSelectOption(optionIndex)}
                        disabled={Boolean(submittedSummary)}
                      />
                      <span>{String.fromCharCode(65 + optionIndex)}) {option}</span>
                    </label>
                  ))}
                </div>

                <div className="question-actions">
                  <button type="button" onClick={handleMarkForReview} disabled={Boolean(submittedSummary)}>Mark for Review</button>
                  <button type="button" onClick={handleClearAnswer} disabled={Boolean(submittedSummary)}>Clear</button>
                  <button type="button" onClick={goPrevious} disabled={activeQuestionIndex === 0}>Previous</button>
                  <button type="button" onClick={goNext} disabled={activeQuestionIndex === questionBank.length - 1}>Next</button>
                </div>
              </section>

              <section className="mentor-card">
                <h4>AI Mentor Analysis</h4>
                {submittedSummary ? (
                  <>
                    <p>Accuracy: {submittedSummary.accuracy}%</p>
                    <p>Correct: {submittedSummary.correct} | Answered: {submittedSummary.answered} | Total: {submittedSummary.total}</p>
                    <p>Tip: Focus more on Indian Polity and revision-based elimination.</p>
                  </>
                ) : (
                  <>
                    <p>Accuracy Projection: {Math.max(55, Math.min(92, 60 + metrics.answered))}%</p>
                    <p>Weak Area: Indian Polity</p>
                    <p>Tip: Attempt easy and direct questions first to optimize score.</p>
                  </>
                )}
              </section>
            </main>

            <aside className="exam-right-panel">
              <h3>Question Palette</h3>
              <div className="palette-grid">
                {questionBank.map((question, idx) => {
                  const status = getQuestionStatus(question.id);
                  return (
                    <button
                      type="button"
                      key={question.id}
                      className={`palette-btn ${status} ${idx === activeQuestionIndex ? "active" : ""}`}
                      onClick={() => setActiveQuestionIndex(idx)}
                    >
                      {question.id}
                    </button>
                  );
                })}
              </div>

              <div className="legend">
                <p><span className="chip answered" />Answered</p>
                <p><span className="chip not-answered" />Not Answered</p>
                <p><span className="chip review" />Review</p>
                <p><span className="chip unattempted" />Unattempted</p>
              </div>
            </aside>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar
        onHomeClick={() => navigate("/")}
        onPlansClick={() => {}}
        onFreeDailyTestClick={handleFreeDailyTestNav}
      />

      <div className="test-container">
        <div className="test-inner">

          {/* 🔥 CAROUSEL FIRST */}
          <div className="carousel">
            <div
              className="carousel-track"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide, i) => (
                <div
                  className="slide"
                  key={i}
                  style={{ backgroundImage: `url(${slide.img})` }}
                >
                  <div className="overlay">
                    <h2>{slide.title}</h2>
                    <p>{slide.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="dots">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={i === index ? "dot active" : "dot"}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </div>

          {/* 🔥 HERO BELOW */}
          <div className="hero">
            <h1>Crack UPSC with Structured Test Series</h1>
            <p>Practice daily. Analyze deeply. Improve consistently.</p>
          </div>

          {/* TRUST */}
          <p className="trust-line">
            Built for serious aspirants • Based on real UPSC pattern
          </p>

          <section className="free-daily-quiz-card" aria-label="Free daily test" id="free-daily-test" ref={freeDailyRef}>
            <p className="daily-kicker">Free Daily Test</p>
            <h3>{selectedDailyQuiz ? selectedDailyQuiz.testName : "No daily quiz uploaded yet"}</h3>
            <p>
              {selectedDailyQuiz
                ? `Type: ${selectedDailyQuiz.type} | Questions: ${selectedDailyQuiz.questionCount}`
                : "Upload a Daily Quiz from Admin Panel to see it here instantly."}
            </p>
            <button type="button" onClick={handleRunTest} disabled={!selectedDailyQuiz}>
              {selectedDailyQuiz ? "Run Test" : "No Test Available"}
            </button>

            {selectedDailyQuiz ? (
              <div className="runner-box" role="region" aria-label="Test runner">
                <div className="runner-row">
                  <p>
                    <strong>Current Test:</strong> {selectedDailyQuiz.testName}
                  </p>
                  <p>
                    <strong>Status:</strong> {isTestRunning ? "Running" : "Ready"}
                  </p>
                </div>

                <div className="runner-row">
                  <p>
                    <strong>Questions:</strong> {selectedDailyQuiz.questionCount}
                  </p>
                  <p>
                    <strong>Timer:</strong> {isTestRunning ? formatTimer(timeLeftSec) : "Not started"}
                  </p>
                </div>

                <div className="runner-actions">
                  <button type="button" className="runner-btn secondary" onClick={handleRunTest}>
                    {isTestRunning ? "Restart Test" : "Start Now"}
                  </button>
                  <button type="button" className="runner-btn danger" onClick={handleEndTest} disabled={!isTestRunning && timeLeftSec === 0}>
                    End Test
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {/* PLANS */}
          <PlanSection title="Daily Plan" price={99} type="daily" />
          <PlanSection title="Weekly Plan" price={299} type="weekly" />
          <PlanSection title="Monthly Plan" price={799} type="monthly" highlight />

        </div>
      </div>
    </>
  );
}