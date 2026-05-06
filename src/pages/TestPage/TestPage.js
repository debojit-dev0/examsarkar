import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { loadAdminTests } from "../../utils/adminTestsStore";
import { buildApiUrl } from "../../utils/apiBaseUrl";
import Navbar from "../../components/Navbar/Navbar";
import "./TestPage.css";

export default function TestPage({ onLoginClick, onSignupClick }) {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptId = new URLSearchParams(location.search).get("attemptId");
  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState({ 0: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        const tests = await loadAdminTests();
        const foundTest = tests.find((t) => t.id === testId);

        if (!foundTest) {
          setError("Test not found");
          return;
        }

        setTest(foundTest);
        setVisitedQuestions({ 0: true });
        setLoading(false);
      } catch (err) {
        console.error("Failed to load test:", err);
        setError("Failed to load test");
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId]);

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleMarkForReview = (questionIndex) => {
    setMarkedForReview((prev) => ({
      ...prev,
      [questionIndex]: !prev[questionIndex],
    }));
  };

  const handleClear = () => {
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestion];
      return newAnswers;
    });
  };

  const goToQuestion = (index) => {
    setCurrentQuestion(index);
    setVisitedQuestions((prev) => ({
      ...prev,
      [index]: true,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < test.parsedQuestions.length - 1) {
      goToQuestion(currentQuestion + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      goToQuestion(currentQuestion - 1);
    }
  };

  const resolveDurationSeconds = (testConfig) => {
    const config = testConfig?.config || {};
    const configuredMinutes = Number(
      config.durationMinutes ||
      config.timeLimitMinutes ||
      config.duration ||
      testConfig?.durationMinutes
    );

    if (Number.isFinite(configuredMinutes) && configuredMinutes > 0) {
      return Math.round(configuredMinutes * 60);
    }

    const fallbackQuestions = Number(testConfig?.questionCount || 20);
    return Math.max(fallbackQuestions * 60, 15 * 60);
  };

  useEffect(() => {
    if (!test) return;

    const config = test.config || {};
    const configuredEndTime = config.endTime || config.endsAt || test.endTime;
    let initialSeconds = null;

    if (configuredEndTime) {
      const endMs = new Date(configuredEndTime).getTime();
      if (!Number.isNaN(endMs)) {
        initialSeconds = Math.max(Math.floor((endMs - Date.now()) / 1000), 0);
      }
    }

    if (initialSeconds === null) {
      initialSeconds = resolveDurationSeconds(test);
    }

    setRemainingSeconds(initialSeconds);
    setTotalDurationSeconds(initialSeconds);
  }, [test]);

  useEffect(() => {
    if (!test || !attemptId) return;

    const loadSavedAttempt = async () => {
      const accessToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (!accessToken) return;

      try {
        setLoadingAttempt(true);
        const res = await fetch(buildApiUrl(`/api/user/test-attempts/${encodeURIComponent(attemptId)}`), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load saved attempt");
        }

        const data = await res.json();
        const attempt = data?.attempt;
        if (!attempt) {
          throw new Error("Saved attempt not found");
        }

        setAnswers(attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {});
        setMarkedForReview(attempt.markedForReview && typeof attempt.markedForReview === "object" ? attempt.markedForReview : {});
        setResults({
          score: Number(attempt.score || 0),
          accuracy: Number(attempt.accuracy || 0),
          correct: Number(attempt.correct || 0),
          total: Number(attempt.total || 0),
          attempted: Number(attempt.attempted || 0),
          notAttempted: Number(attempt.notAttempted || 0),
          reviewCount: Number(attempt.reviewCount || 0),
          answers: attempt.answers && typeof attempt.answers === "object" ? attempt.answers : {},
          markedForReview: attempt.markedForReview && typeof attempt.markedForReview === "object" ? attempt.markedForReview : {},
          testName: attempt.testName || test.testName,
          timestamp: attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : new Date().toLocaleString(),
        });

        setCurrentQuestion(0);
        setSubmitted(true);
        setReviewMode(false);
        setRemainingSeconds(null);
        submitLockRef.current = true;
      } catch (savedAttemptError) {
        console.error("Saved attempt load error:", savedAttemptError);
        setError("Failed to load saved result");
      } finally {
        setLoadingAttempt(false);
      }
    };

    loadSavedAttempt();
  }, [test, attemptId]);

  const formatTimeLeft = (seconds) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const safe = Math.max(0, Number(seconds));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitLockRef.current || submitted || !test) {
      return;
    }

    submitLockRef.current = true;
    let correct = 0;
    let reviewCount = 0;
    
    test.parsedQuestions.forEach((question, index) => {
      if (answers[index] === question.answerIndex) {
        correct++;
      }
      if (markedForReview[index]) {
        reviewCount++;
      }
    });

    const total = test.parsedQuestions.length;
    const attempted = Object.keys(answers).length;
    const notAttempted = total - attempted;
    const score = Math.round((correct / total) * 100);
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const capturedRemainingSeconds = Math.max(Number(remainingSeconds || 0), 0);
    const timeTakenSeconds = Number.isFinite(totalDurationSeconds)
      ? Math.max(totalDurationSeconds - capturedRemainingSeconds, 0)
      : null;

    const resultData = {
      score,
      accuracy,
      correct,
      total,
      attempted,
      notAttempted,
      reviewCount,
      answers,
      markedForReview,
      testName: test.testName,
      timestamp: new Date().toLocaleString(),
      submittedBy: isAutoSubmit ? "timer" : "manual",
      timeLeft: formatTimeLeft(capturedRemainingSeconds),
      timeTakenSeconds,
    };

    const accessToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (accessToken) {
      try {
        await fetch(buildApiUrl("/api/user/test-attempts"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testId: test.id,
            testName: test.testName,
            score,
            accuracy,
            correct,
            total,
            attempted,
            notAttempted,
            reviewCount,
            answers,
            markedForReview,
            analysis: {
              correct,
              incorrect: total - correct,
              attempted,
              notAttempted,
              reviewCount,
              accuracy,
            },
            submittedBy: isAutoSubmit ? "timer" : "manual",
            timeTakenSeconds,
            timeLeftSeconds: capturedRemainingSeconds,
          }),
        });
      } catch (saveError) {
        console.error("Failed to save test attempt:", saveError);
      }
    }

    setResults(resultData);
    setSubmitted(true);
  }, [answers, markedForReview, remainingSeconds, submitted, test, totalDurationSeconds]);

  useEffect(() => {
    if (submitted || remainingSeconds === null) return;

    if (remainingSeconds <= 0) {
      handleSubmit(true);
      return;
    }

    const timerId = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [remainingSeconds, submitted, handleSubmit]);

  const splitQuestionIntoLines = (rawQuestion) => {
    const text = String(rawQuestion || "").trim();
    if (!text) return [];

    // Remove leading Qn. prefix from source text to avoid duplicate "Q1. Q1."
    const withoutQPrefix = text.replace(/^Q\d+\.\s*/i, "");
    const parts = withoutQPrefix
      .split(/\s+(?=\d+\.)/)
      .map((item) => item.trim())
      .filter(Boolean);

    return parts.length > 1 ? parts : [withoutQPrefix];
  };

  // Calculate statistics
  const calculateStats = () => {
    let attempted = 0;
    let notAnswered = 0;
    let markedReview = 0;
    let unattempted = 0;

    test.parsedQuestions.forEach((_, index) => {
      if (markedForReview[index]) {
        markedReview++;
        return;
      }

      if (answers[index] !== undefined) {
        attempted++;
      } else {
        if (visitedQuestions[index]) {
          notAnswered++;
        } else {
          unattempted++;
        }
      }
    });

    return { attempted, notAnswered, markedReview, unattempted };
  };

  if (loading || loadingAttempt) {
    return (
      <>
        <Navbar
          onHomeClick={() => navigate("/")}
          onPlansClick={() => navigate("/test-series")}
          onLoginClick={onLoginClick}
          onSignupClick={onSignupClick}
        />
        <div className="test-page">
          <div className="test-loading">
            <div className="spinner"></div>
            <p>Loading test...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !test) {
    return (
      <>
        <Navbar
          onHomeClick={() => navigate("/")}
          onPlansClick={() => navigate("/test-series")}
          onLoginClick={onLoginClick}
          onSignupClick={onSignupClick}
        />
        <div className="test-page">
          <div className="test-error">
            <h2>{error || "Test not found"}</h2>
            <button className="back-btn" onClick={() => navigate("/test-series")}>
              Back to Tests
            </button>
          </div>
        </div>
      </>
    );
  }

  if (submitted && !reviewMode) {
    return (
      <>
        <Navbar
          onHomeClick={() => navigate("/")}
          onPlansClick={() => navigate("/test-series")}
          onLoginClick={onLoginClick}
          onSignupClick={onSignupClick}
        />
        <div className="test-page results-page">
          <div className="results-container">
            <div className="results-header">
              <h1>{results.testName}</h1>
              <p className="submission-time">Submitted on {results.timestamp}</p>
            </div>

            {/* Score Card */}
            <div className="score-card">
              <div className="score-display">
                <div className="score-circle">
                  <div className="score-text">
                    <span className="score-number">{results.score}</span>
                    <span className="score-label">%</span>
                  </div>
                </div>
                <div className="score-info">
                  <h2>{results.score >= 60 ? "Great Job! 🎉" : "Good Effort! 💪"}</h2>
                  <p>You scored {results.correct} out of {results.total} questions correctly</p>
                </div>
              </div>

              <div className="score-breakdown">
                <div className="breakdown-item">
                  <span className="label">Accuracy</span>
                  <span className="value accent">{results.accuracy}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Attempted</span>
                  <span className="value">{results.attempted}</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Not Attempted</span>
                  <span className="value">{results.notAttempted}</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Marked for Review</span>
                  <span className="value">{results.reviewCount}</span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="statistics-section">
              <h3>Question Analysis</h3>
              <div className="stats-grid">
                <div className="stat-item correct">
                  <div className="stat-icon">✓</div>
                  <div className="stat-details">
                    <div className="stat-count">{results.correct}</div>
                    <div className="stat-label">Correct</div>
                  </div>
                </div>
                <div className="stat-item incorrect">
                  <div className="stat-icon">✕</div>
                  <div className="stat-details">
                    <div className="stat-count">{results.total - results.correct}</div>
                    <div className="stat-label">Incorrect</div>
                  </div>
                </div>
                <div className="stat-item unattempted">
                  <div className="stat-icon">—</div>
                  <div className="stat-details">
                    <div className="stat-count">{results.notAttempted}</div>
                    <div className="stat-label">Unattempted</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Review Answers Button */}
            <div className="results-actions">
              <button
                className="review-btn"
                onClick={() => {
                  setReviewMode(true);
                  goToQuestion(0);
                }}
              >
                Review Answers
              </button>
              <button
                className="back-btn"
                onClick={() => navigate("/test-series")}
              >
                Back to Tests
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (submitted && reviewMode) {
    const question = test.parsedQuestions[currentQuestion];
    const userAnswer = answers[currentQuestion];
    const isCorrect = userAnswer === question.answerIndex;

    return (
      <>
        <Navbar
          onHomeClick={() => navigate("/")}
          onPlansClick={() => navigate("/test-series")}
          onLoginClick={onLoginClick}
          onSignupClick={onSignupClick}
        />
        <div className="test-page review-page">
          <div className="review-container">
            {/* Left Sidebar - Question Palette */}
            <aside className="review-sidebar">
              <div className="sidebar-header">
                <h3>Review Answers</h3>
                <div className="legend">
                  <div className="legend-item">
                    <div className="legend-color correct"></div> Correct
                  </div>
                  <div className="legend-item">
                    <div className="legend-color incorrect"></div> Incorrect
                  </div>
                  <div className="legend-item">
                    <div className="legend-color unanswered"></div> Unanswered
                  </div>
                </div>
              </div>

              <div className="review-grid">
                {test.parsedQuestions.map((_, index) => {
                  const userAns = answers[index];
                  const isQCorrect = userAns === test.parsedQuestions[index].answerIndex;
                  let statusClass = "unanswered";
                  if (userAns !== undefined) {
                    statusClass = isQCorrect ? "correct" : "incorrect";
                  }

                  return (
                    <button
                      key={index}
                      className={`review-question-btn ${statusClass} ${
                        index === currentQuestion ? "active" : ""
                      }`}
                      onClick={() => goToQuestion(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Main Review Content */}
            <main className="review-content">
              <div className="review-header">
                <h2>Question {currentQuestion + 1} of {test.parsedQuestions.length}</h2>
                <div className={`status-badge ${isCorrect ? "correct" : userAnswer !== undefined ? "incorrect" : "unanswered"}`}>
                  {isCorrect ? "✓ Correct" : userAnswer !== undefined ? "✕ Incorrect" : "Unanswered"}
                </div>
              </div>

              <div className="review-question">
                <h3 className="question-text">{question.question}</h3>

                <div className="review-options">
                  {question.options.map((option, index) => {
                    const isUserSelected = userAnswer === index;
                    const isCorrectAnswer = index === question.answerIndex;

                    return (
                      <div
                        key={index}
                        className={`review-option ${
                          isCorrectAnswer ? "correct-answer" : ""
                        } ${isUserSelected && !isCorrectAnswer ? "incorrect-answer" : ""}`}
                      >
                        <div className="option-header">
                          <span className="option-letter">
                            {String.fromCharCode(65 + index)}
                          </span>
                          {isCorrectAnswer && <span className="correct-label">Correct Answer</span>}
                          {isUserSelected && !isCorrectAnswer && (
                            <span className="your-answer">Your Answer</span>
                          )}
                        </div>
                        <div className="option-text">{option}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation */}
              <div className="review-navigation">
                <button
                  className="nav-btn"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestion === 0}
                >
                  ← Previous
                </button>
                <button
                  className="nav-btn"
                  onClick={handleNextQuestion}
                  disabled={currentQuestion === test.parsedQuestions.length - 1}
                >
                  Next →
                </button>
              </div>

              <button
                className="finish-review-btn"
                onClick={() => navigate("/test-series")}
              >
                Back to Tests
              </button>
            </main>
          </div>
        </div>
      </>
    );
  }

  // Test Taking Mode
  const question = test.parsedQuestions[currentQuestion];
  const stats = calculateStats();
  const questionCount = test.parsedQuestions.length;
  const marksPerQuestion = Number(test?.config?.marksPerQuestion || 10);
  const totalMarks = questionCount * marksPerQuestion;
  const negativeMarks = Number(test?.config?.negativeMarks || 0.66);

  return (
    <>
      <Navbar
        onHomeClick={() => navigate("/")}
        onPlansClick={() => navigate("/test-series")}
        onLoginClick={onLoginClick}
        onSignupClick={onSignupClick}
      />

      <div className="test-page">
        <div className="test-exam-layout">
          <aside className="exam-left-panel">
            <h3 className="panel-title">Questions</h3>
            <ul className="question-stats-list">
              <li>Attempted: {stats.attempted}</li>
              <li>Not Answered: {stats.notAnswered}</li>
              <li>Marked for Review: {stats.markedReview}</li>
              <li>Unattempted: {stats.unattempted}</li>
            </ul>

            <button className="submit-btn" onClick={handleSubmit}>
              Submit Test
            </button>
            <button className="exit-btn" onClick={() => navigate("/test-series")}>
              Exit Test
            </button>
          </aside>

          <main className="exam-center-panel">
            <header className="exam-header">
              <div className="exam-header-top">
                <h2>{test.testName}</h2>
                <div className={`timer-chip ${remainingSeconds !== null && remainingSeconds <= 60 ? "danger" : ""}`}>
                  Time Left: {formatTimeLeft(remainingSeconds)}
                </div>
              </div>
              <p>{questionCount} Questions | {totalMarks} Marks</p>
              <p>Negative Marking - {negativeMarks} for incorrect answers</p>
            </header>

            <section className="question-card">
              <h3 className="question-title">
                {splitQuestionIntoLines(question.question).map((line, index) => (
                  <span key={index} className="question-line">
                    {index === 0 ? `Q${currentQuestion + 1}. ${line}` : line}
                  </span>
                ))}
              </h3>

              <div className="options-list">
                {question.options.map((option, index) => (
                  <label key={index} className="option">
                    <input
                      type="radio"
                      name={`question-${currentQuestion}`}
                      checked={answers[currentQuestion] === index}
                      onChange={() => handleAnswerSelect(currentQuestion, index)}
                    />
                    <span>{String.fromCharCode(65 + index)}) {option}</span>
                  </label>
                ))}
              </div>

              <div className="action-buttons">
                <button
                  className="action-btn"
                  onClick={() => handleMarkForReview(currentQuestion)}
                >
                  {markedForReview[currentQuestion] ? "Unmark Review" : "Mark for Review"}
                </button>
                <button className="action-btn" onClick={handleClear}>
                  Clear
                </button>
                <button
                  className="action-btn"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </button>
                <button
                  className="action-btn"
                  onClick={handleNextQuestion}
                  disabled={currentQuestion === test.parsedQuestions.length - 1}
                >
                  Next
                </button>
              </div>
            </section>
          </main>

          <aside className="exam-right-panel">
            <h3 className="panel-title">Question Palette</h3>
            <div className="palette-grid">
              {test.parsedQuestions.map((_, index) => {
                let statusClass = "unattempted";
                if (markedForReview[index]) {
                  statusClass = "marked";
                } else if (answers[index] !== undefined) {
                  statusClass = "answered";
                } else if (visitedQuestions[index]) {
                  statusClass = "not-answered";
                }

                return (
                  <button
                    key={index}
                    className={`palette-btn ${statusClass} ${
                      index === currentQuestion ? "active" : ""
                    }`}
                    onClick={() => goToQuestion(index)}
                    title={`Question ${index + 1}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="palette-legend">
              <p><span className="legend-dot answered"></span> Answered</p>
              <p><span className="legend-dot not-answered"></span> Not Answered</p>
              <p><span className="legend-dot marked"></span> Review</p>
              <p><span className="legend-dot unattempted"></span> Unattempted</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
