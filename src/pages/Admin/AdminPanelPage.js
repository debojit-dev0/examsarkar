import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiLock,
  FiEye,
  FiEdit3,
  FiTrash2,
  FiX,
  FiShield,
  FiUploadCloud,
  FiUsers
} from "react-icons/fi";
import JSZip from "jszip";
import { loadAdminTests, saveAdminTests } from "../../utils/adminTestsStore";
import "./AdminPanelPage.css";

const ROLE_SUPER_ADMIN = "super-admin";
const ROLE_CONTENT_ADMIN = "content-admin";

const PLAN_WEEKLY = "weekly";
const PLAN_MONTHLY = "monthly";
const PLAN_FREE = "free";

function normalizeDate(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function stableScoreFromSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 21);
  return 68 + normalized;
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

async function getQuestionCountFromFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  const normalizeSpace = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const isQuestionStart = (text) => /^Q\s*\d+\s*[.)]?\s*/i.test(text);
  const optionMatch = (text) => text.match(/^([A-D])[.)]\s*(.+)$/i);
  const isYellowHighlight = (color) => String(color || "").toUpperCase().includes("FFFF00");

  const buildParsedResult = (questions) => ({
    questionCount: questions.length,
    parsedQuestions: questions
  });

  const finalizeQuestion = (draft, questions) => {
    if (!draft || draft.options.length < 2) return;

    questions.push({
      id: questions.length + 1,
      question: draft.questionLines.join(" "),
      options: draft.options,
      answerIndex: draft.answerIndex
    });
  };

  const parseLinewiseQuestionPaper = (linesWithMeta) => {
    const questions = [];
    let current = null;

    linesWithMeta.forEach(({ text, isAnswer }) => {
      const cleanText = normalizeSpace(text);
      if (!cleanText) return;

      if (isQuestionStart(cleanText)) {
        finalizeQuestion(current, questions);
        current = {
          questionLines: [cleanText],
          options: [],
          answerIndex: null
        };
        return;
      }

      if (!current) return;

      const option = optionMatch(cleanText);
      if (option) {
        current.options.push(option[2]);

        if (isAnswer) {
          current.answerIndex = current.options.length - 1;
        }

        return;
      }

      if (current.options.length === 0) {
        current.questionLines.push(cleanText);
      }
    });

    finalizeQuestion(current, questions);
    return questions;
  };

  if (extension === "csv") {
    const csvText = await file.text();
    const rows = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsedQuestions = parseLinewiseQuestionPaper(
      rows.map((line) => ({ text: line, isAnswer: false }))
    );

    if (parsedQuestions.length > 0) {
      return buildParsedResult(parsedQuestions);
    }

    // Treat first row as header.
    return {
      questionCount: Math.max(rows.length - 1, 0),
      parsedQuestions: []
    };
  }

  if (extension === "xlsx" || extension === "xls") {
    const xlsx = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array", cellStyles: true });
    let bestParsedQuestions = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const ref = sheet?.["!ref"];
      if (!ref) return;

      const range = xlsx.utils.decode_range(ref);
      const linesWithMeta = [];

      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let col = range.s.c; col <= range.e.c; col += 1) {
          const address = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = sheet[address];
          if (!cell || cell.v === undefined || cell.v === null) continue;

          const text = normalizeSpace(cell.v);
          if (!text) continue;

          const style = cell.s || {};
          const color = String(style.fgColor?.rgb || "").toUpperCase();
          const isAnswer = isYellowHighlight(color);

          linesWithMeta.push({ text, isAnswer });
        }
      }

      const parsedQuestions = parseLinewiseQuestionPaper(linesWithMeta);
      if (parsedQuestions.length > bestParsedQuestions.length) {
        bestParsedQuestions = parsedQuestions;
      }
    });

    if (bestParsedQuestions.length > 0) {
      return buildParsedResult(bestParsedQuestions);
    }

    throw new Error("Could not parse questions from Excel. Use format: Q1... then A/B/C/D options.");
  }

  if (extension === "docx") {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("text");

    if (!documentXml) {
      throw new Error("Word file could not be read. Please upload a valid .docx file.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, "application/xml");
    const paragraphNodes = Array.from(xmlDoc.getElementsByTagName("w:p"));

    const linesWithMeta = paragraphNodes
      .map((paragraph) => {
        const runs = Array.from(paragraph.getElementsByTagName("w:r"));
        const texts = [];
        let isAnswer = false;

        runs.forEach((run) => {
          const textNodeList = Array.from(run.getElementsByTagName("w:t"));
          const runText = textNodeList.map((node) => node.textContent || "").join("");
          const runHighlight = run.getElementsByTagName("w:highlight")[0];
          const highlightColor = runHighlight?.getAttribute("w:val") || runHighlight?.getAttribute("val") || "";

          if (isYellowHighlight(highlightColor) || String(highlightColor).toLowerCase() === "yellow") {
            isAnswer = true;
          }

          if (runText) texts.push(runText);
        });

        return {
          text: texts.join("").trim(),
          isAnswer
        };
      })
      .filter((entry) => entry.text);

    const parsedQuestions = parseLinewiseQuestionPaper(linesWithMeta);

    if (parsedQuestions.length > 0) {
      return buildParsedResult(parsedQuestions);
    }

    throw new Error("No questions found in the Word file. Please use Q lines followed by A/B/C/D options.");
  }

  throw new Error("Please upload a CSV, Excel, or Word file (.csv, .xlsx, .xls, .docx).");
}

export default function AdminPanelPage({ initialRole = ROLE_SUPER_ADMIN, lockRole = false, onLogout }) {
  const [role, setRole] = useState(initialRole);
  const [formState, setFormState] = useState({
    testName: "",
    type: "daily",
    access: "free",
    date: "",
    file: null,
    totalQuestions: "",
    marksPerQuestion: "",
    totalMarks: "",
    durationMinutes: "",
    positiveMarks: "",
    negativeMarks: ""
  });

  const [planSettings, setPlanSettings] = useState({
    weeklyLimit: 7,
    monthlyLimit: 30,
    weeklyPrice: 299,
    monthlyPrice: 799,
    includeDailyQuizInWeekly: true,
    includeFreeTestsInWeekly: true,
    includeWeeklyInMonthly: true,
    includeDailyQuizInMonthly: true,
    includeFreeTestsInMonthly: true
  });

  const [tests, setTests] = useState([]);
  const [testsLoaded, setTestsLoaded] = useState(false);

  const [users] = useState([
    { id: "u1", name: "Aarav Sharma", plan: PLAN_WEEKLY, activeWindow: "today" },
    { id: "u2", name: "Meera Iyer", plan: PLAN_MONTHLY, activeWindow: "week" },
    { id: "u3", name: "Rohan Patel", plan: PLAN_FREE, activeWindow: "today" },
    { id: "u4", name: "Ishita Verma", plan: PLAN_MONTHLY, activeWindow: "week" },
    { id: "u5", name: "Kabir Rao", plan: PLAN_WEEKLY, activeWindow: "inactive" }
  ]);

  const [uploadFeedback, setUploadFeedback] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(PLAN_WEEKLY);
  const [reviewedTestId, setReviewedTestId] = useState(null);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0);
  const [editQuestionDraft, setEditQuestionDraft] = useState(null);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    let isActive = true;

    const fetchTests = async () => {
      try {
        const remoteTests = await loadAdminTests();
        if (!isActive) return;
        setTests(remoteTests);
      } catch (error) {
        console.error("Failed to load admin tests:", error);
        if (isActive) {
          setTests([]);
        }
      } finally {
        if (isActive) {
          setTestsLoaded(true);
        }
      }
    };

    fetchTests();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!testsLoaded) return;

    saveAdminTests(tests).catch((error) => {
      console.error("Failed to save admin tests:", error);
    });
  }, [tests, testsLoaded]);

  const reviewedTest = useMemo(
    () => tests.find((test) => test.id === reviewedTestId) || null,
    [tests, reviewedTestId]
  );

  const groupedTests = useMemo(() => {
    const weeklyCore = tests.filter((test) => test.type === "weekly").slice(0, planSettings.weeklyLimit);
    const monthlyCore = tests.filter((test) => test.type === "monthly").slice(0, planSettings.monthlyLimit);
    const dailyQuiz = tests.filter((test) => test.type === "daily-quiz");
    const freeTests = tests.filter((test) => test.access === "free");

    const weeklySet = [
      ...weeklyCore,
      ...(planSettings.includeDailyQuizInWeekly ? dailyQuiz : []),
      ...(planSettings.includeFreeTestsInWeekly ? freeTests : [])
    ];

    const monthlySet = [
      ...monthlyCore,
      ...(planSettings.includeWeeklyInMonthly ? weeklyCore : []),
      ...(planSettings.includeDailyQuizInMonthly ? dailyQuiz : []),
      ...(planSettings.includeFreeTestsInMonthly ? freeTests : [])
    ];

    const uniqueById = (arr) => {
      const seen = new Set();
      return arr.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    return {
      weeklyCore,
      monthlyCore,
      dailyQuiz,
      freeTests,
      weeklySet: uniqueById(weeklySet),
      monthlySet: uniqueById(monthlySet)
    };
  }, [tests, planSettings]);

  const dashboardMetrics = useMemo(() => {
    const totalUsers = users.length;
    const activeUsersToday = users.filter((user) => user.activeWindow === "today").length;
    const activeUsersThisWeek = users.filter((user) => user.activeWindow === "today" || user.activeWindow === "week").length;
    const totalTestsCreated = tests.length;

    const totalAttempts = tests.reduce((count, test) => {
      const intensity = test.type === "daily-quiz" ? 4 : test.type === "daily" ? 3 : 2;
      return count + intensity * 12;
    }, 0);

    const today = normalizeDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = normalizeDate(yesterdayDate);

    const todayQuiz = tests.find((test) => test.type === "daily-quiz" && test.date === today);
    const yesterdayQuiz = tests.find((test) => test.type === "daily-quiz" && test.date === yesterday);

    const todayQuizAttempts = todayQuiz ? Math.max(12, todayQuiz.questionCount * 2) : 0;
    const yesterdayQuizAttempts = yesterdayQuiz ? Math.max(10, yesterdayQuiz.questionCount * 2) : 0;

    return {
      totalUsers,
      activeUsersToday,
      activeUsersThisWeek,
      totalTestsCreated,
      totalAttempts,
      todayQuiz,
      yesterdayQuiz,
      todayQuizAttempts,
      yesterdayQuizAttempts,
      todayAvgScore: todayQuiz ? stableScoreFromSeed(todayQuiz.id) : 0,
      yesterdayAvgScore: yesterdayQuiz ? stableScoreFromSeed(yesterdayQuiz.id) : 0
    };
  }, [users, tests]);

  const visibleTestsForSelectedPlan = useMemo(() => {
    if (selectedPlan === PLAN_WEEKLY) return groupedTests.weeklySet;
    if (selectedPlan === PLAN_MONTHLY) return groupedTests.monthlySet;
    return groupedTests.freeTests;
  }, [selectedPlan, groupedTests]);

  const openTestReview = (testId) => {
    setReviewedTestId(testId);
    setReviewQuestionIndex(0);
    setEditQuestionDraft(null);
  };

  const closeTestReview = () => {
    setReviewedTestId(null);
    setEditQuestionDraft(null);
  };

  const deleteTest = (testId) => {
    const testToDelete = tests.find((test) => test.id === testId);
    if (!testToDelete) return;

    const confirmed = window.confirm(`Delete "${testToDelete.testName}"? This action cannot be undone.`);
    if (!confirmed) return;

    setTests((prevTests) => prevTests.filter((test) => test.id !== testId));

    if (reviewedTestId === testId) {
      closeTestReview();
    }
  };

  const startEditQuestion = (questionIndex) => {
    if (!reviewedTest?.parsedQuestions?.[questionIndex]) return;

    setReviewQuestionIndex(questionIndex);
    const question = reviewedTest.parsedQuestions[questionIndex];
    setEditQuestionDraft({
      questionIndex,
      question: question.question,
      options: [...question.options],
      answerIndex: Number.isInteger(question.answerIndex) ? question.answerIndex : 0
    });
  };

  const saveEditedQuestion = () => {
    if (!reviewedTest || !editQuestionDraft) return;

    setTests((prevTests) =>
      prevTests.map((test) => {
        if (test.id !== reviewedTest.id) return test;

        const nextParsedQuestions = (test.parsedQuestions || []).map((question, index) => {
          if (index !== editQuestionDraft.questionIndex) return question;

          return {
            ...question,
            question: editQuestionDraft.question,
            options: editQuestionDraft.options,
            answerIndex: editQuestionDraft.answerIndex
          };
        });

        return {
          ...test,
          parsedQuestions: nextParsedQuestions,
          questionCount: nextParsedQuestions.length
        };
      })
    );

    setEditQuestionDraft(null);
  };

  const deleteQuestion = (questionIndex) => {
    if (!reviewedTest) return;

    const nextQuestions = (reviewedTest.parsedQuestions || []).filter((_, index) => index !== questionIndex);
    const confirmDelete = window.confirm("Delete this question from the quiz?");
    if (!confirmDelete) return;

    setTests((prevTests) =>
      prevTests.map((test) =>
        test.id === reviewedTest.id
          ? {
              ...test,
              parsedQuestions: nextQuestions,
              questionCount: nextQuestions.length
            }
          : test
      )
    );

    setEditQuestionDraft(null);
    if (nextQuestions.length === 0) {
      setReviewedTestId(null);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));

    if (field === "type") {
      if (value === "daily-quiz") {
        setFormState((prev) => ({ ...prev, type: value, access: "free" }));
      }
      if (value === "weekly" || value === "monthly" || value === "daily") {
        setFormState((prev) => ({ ...prev, type: value, date: "" }));
      }
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!formState.testName.trim()) {
      setUploadFeedback("Test name is required.");
      return;
    }

    if (!formState.file) {
      setUploadFeedback("Upload one question paper file before creating a test.");
      return;
    }

    if (formState.type === "daily-quiz" && !formState.date) {
      setUploadFeedback("Daily quiz requires a quiz date.");
      return;
    }

    // Validate test configuration fields
    if (!formState.totalQuestions.trim()) {
      setUploadFeedback("Total number of questions is required.");
      return;
    }

    if (!formState.marksPerQuestion.trim()) {
      setUploadFeedback("Marks per question is required.");
      return;
    }

    if (!formState.totalMarks.trim()) {
      setUploadFeedback("Total marks is required.");
      return;
    }

    if (!formState.durationMinutes.trim()) {
      setUploadFeedback("Duration in minutes is required.");
      return;
    }

    if (!formState.positiveMarks.trim()) {
      setUploadFeedback("Marks for correct answer is required.");
      return;
    }

    if (!formState.negativeMarks.trim()) {
      setUploadFeedback("Marks for wrong answer is required.");
      return;
    }

    // Validate numeric values
    const totalQuestions = Number(formState.totalQuestions);
    const marksPerQuestion = Number(formState.marksPerQuestion);
    const totalMarks = Number(formState.totalMarks);
    const durationMinutes = Number(formState.durationMinutes);
    const positiveMarks = Number(formState.positiveMarks);
    const negativeMarks = Number(formState.negativeMarks);

    if (isNaN(totalQuestions) || totalQuestions <= 0) {
      setUploadFeedback("Total questions must be a valid positive number.");
      return;
    }

    if (isNaN(marksPerQuestion) || marksPerQuestion <= 0) {
      setUploadFeedback("Marks per question must be a valid positive number.");
      return;
    }

    if (isNaN(totalMarks) || totalMarks <= 0) {
      setUploadFeedback("Total marks must be a valid positive number.");
      return;
    }

    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      setUploadFeedback("Duration must be a valid positive number in minutes.");
      return;
    }

    if (isNaN(positiveMarks) || positiveMarks <= 0) {
      setUploadFeedback("Marks for correct answer must be a valid positive number.");
      return;
    }

    if (isNaN(negativeMarks) || negativeMarks > 0) {
      setUploadFeedback("Marks for wrong answer must be a valid negative number.");
      return;
    }

    try {
      const { questionCount, parsedQuestions } = await getQuestionCountFromFile(formState.file);

      const newTest = {
        id: `test-${Date.now()}`,
        testName: formState.testName.trim(),
        type: formState.type,
        access: formState.access,
        date: formState.type === "daily-quiz" ? formState.date : "",
        questionCount,
        parsedQuestions,
        fileName: formState.file.name,
        createdAt: normalizeDate(new Date()),
        // Test configuration
        config: {
          totalQuestions: Number(formState.totalQuestions),
          marksPerQuestion: Number(formState.marksPerQuestion),
          totalMarks: Number(formState.totalMarks),
          durationMinutes: Number(formState.durationMinutes),
          positiveMarks: Number(formState.positiveMarks),
          negativeMarks: Number(formState.negativeMarks)
        }
      };

      setTests((prev) => [newTest, ...prev]);
      setUploadFeedback(
        `Uploaded successfully. ${newTest.testName} parsed ${questionCount} questions${parsedQuestions.length ? " with highlighted answers" : ""}.`
      );

      setFormState({
        testName: "",
        type: "daily",
        access: "free",
        date: "",
        file: null,
        totalQuestions: "",
        marksPerQuestion: "",
        totalMarks: "",
        durationMinutes: "",
        positiveMarks: "",
        negativeMarks: ""
      });
    } catch (error) {
      setUploadFeedback(error.message || "Upload failed. Please try a valid CSV/Excel file.");
    }
  };

  return (
    <div className="admin-page-shell">
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />

      <main className="admin-page">
        <header className="admin-header">
          <div>
            <p className="eyebrow">ExamSarkar Admin Console</p>
            <h1>Smart Test Management Dashboard</h1>
            <p className="admin-subtitle">
              Upload once, tag by test type, and plans auto-distribute tests for user access.
            </p>
          </div>

          <div className="admin-header-actions">
            {lockRole ? (
              <div className="role-static">
                {role === ROLE_SUPER_ADMIN ? <FiShield /> : <FiLock />} {role === ROLE_SUPER_ADMIN ? "Super Admin" : "Content Admin"}
              </div>
            ) : (
              <div className="role-switcher" role="group" aria-label="Select admin role">
                <button
                  type="button"
                  onClick={() => setRole(ROLE_SUPER_ADMIN)}
                  className={role === ROLE_SUPER_ADMIN ? "role-btn active" : "role-btn"}
                >
                  <FiShield /> Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => setRole(ROLE_CONTENT_ADMIN)}
                  className={role === ROLE_CONTENT_ADMIN ? "role-btn active" : "role-btn"}
                >
                  <FiLock /> Content Admin
                </button>
              </div>
            )}

            {lockRole && onLogout ? (
              <button type="button" className="logout-btn" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>
        </header>

        <section className="stats-grid" aria-label="overview stats">
          <article className="stat-tile reveal-1">
            <p>Total Users</p>
            <h3>{dashboardMetrics.totalUsers}</h3>
            <span><FiUsers /> Registered aspirants</span>
          </article>

          <article className="stat-tile reveal-2">
            <p>Active Users</p>
            <h3>{dashboardMetrics.activeUsersToday} today</h3>
            <span><FiActivity /> {dashboardMetrics.activeUsersThisWeek} active this week</span>
          </article>

          <article className="stat-tile reveal-3">
            <p>Total Tests Created</p>
            <h3>{dashboardMetrics.totalTestsCreated}</h3>
            <span><FiFileText /> Daily + weekly + monthly</span>
          </article>

          <article className="stat-tile reveal-4">
            <p>Total Attempts</p>
            <h3>{dashboardMetrics.totalAttempts}</h3>
            <span><FiCheckCircle /> Aggregated from all tests</span>
          </article>
        </section>

        <section className="panel-card quiz-library-panel">
          <div className="panel-title-row">
            <h2><FiEye /> Quiz Library</h2>
            <span className="panel-badge">View / Edit / Delete</span>
          </div>

          <div className="quiz-library-list">
            {tests.map((test) => (
              <div className="quiz-library-row" key={test.id}>
                <div className="quiz-library-info">
                  <h4>{test.testName}</h4>
                  <p>
                    Type: <strong>{test.type}</strong> | Access: <strong>{test.access}</strong> | Questions: <strong>{test.questionCount}</strong>
                  </p>
                  {test.config && (
                    <p className="test-config-summary">
                      <strong>{test.config.totalMarks}</strong> marks | +{test.config.positiveMarks} / {test.config.negativeMarks}
                    </p>
                  )}
                </div>
                {test.config && (
                  <div className="timer-badge">
                    <FiClock />
                    <span>{formatDuration(test.config.durationMinutes)}</span>
                  </div>
                )}
                <div className="quiz-library-actions">
                  <button type="button" className="icon-action-btn" onClick={() => openTestReview(test.id)} aria-label={`View ${test.testName}`}>
                    <FiEye />
                  </button>
                  <button type="button" className="icon-action-btn danger" onClick={() => deleteTest(test.id)} aria-label={`Delete ${test.testName}`}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="daily-quiz-strip">
          <div className="quiz-card">
            <h3><FiCalendar /> Today&apos;s Quiz</h3>
            <p className="quiz-main">{dashboardMetrics.todayQuiz?.testName || "No quiz scheduled today"}</p>
            <p>Attempts: {dashboardMetrics.todayQuizAttempts}</p>
            <p>Avg Score: {dashboardMetrics.todayAvgScore ? `${dashboardMetrics.todayAvgScore}%` : "-"}</p>
          </div>

          <div className="quiz-card">
            <h3><FiClock /> Yesterday Performance</h3>
            <p className="quiz-main">{dashboardMetrics.yesterdayQuiz?.testName || "No quiz found"}</p>
            <p>Attempts: {dashboardMetrics.yesterdayQuizAttempts}</p>
            <p>Avg Score: {dashboardMetrics.yesterdayAvgScore ? `${dashboardMetrics.yesterdayAvgScore}%` : "-"}</p>
          </div>
        </section>

        <section className="admin-content-grid">
          <article className="panel-card upload-panel">
            <div className="panel-title-row">
              <h2><FiUploadCloud /> Upload Question Paper</h2>
              <span className="panel-badge">One upload, auto assignment</span>
            </div>

            <form className="upload-form" onSubmit={handleUpload}>
              <label>
                Test Name
                <input
                  type="text"
                  value={formState.testName}
                  onChange={(event) => handleFieldChange("testName", event.target.value)}
                  placeholder="Ex: Weekly Economy Test 03"
                />
              </label>

              <label>
                Type
                <select
                  value={formState.type}
                  onChange={(event) => handleFieldChange("type", event.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="daily-quiz">Daily Quiz</option>
                </select>
              </label>

              <label>
                Access
                <select
                  value={formState.access}
                  onChange={(event) => handleFieldChange("access", event.target.value)}
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>

              <label>
                Date (required for Daily Quiz)
                <input
                  type="date"
                  value={formState.date}
                  onChange={(event) => handleFieldChange("date", event.target.value)}
                  disabled={formState.type !== "daily-quiz"}
                />
              </label>

              <div className="form-section-divider">
                <h3>Test Configuration</h3>
              </div>

              <label>
                Total Number of Questions
                <input
                  type="number"
                  min="1"
                  value={formState.totalQuestions}
                  onChange={(event) => handleFieldChange("totalQuestions", event.target.value)}
                  placeholder="Ex: 100"
                />
              </label>

              <label>
                Marks Per Question
                <input
                  type="number"
                  step="0.5"
                  value={formState.marksPerQuestion}
                  onChange={(event) => handleFieldChange("marksPerQuestion", event.target.value)}
                  placeholder="Ex: 2"
                />
              </label>

              <label>
                Total Marks
                <input
                  type="number"
                  value={formState.totalMarks}
                  onChange={(event) => handleFieldChange("totalMarks", event.target.value)}
                  placeholder="Ex: 200"
                />
              </label>

              <label>
                Duration (Minutes)
                <input
                  type="number"
                  min="1"
                  value={formState.durationMinutes}
                  onChange={(event) => handleFieldChange("durationMinutes", event.target.value)}
                  placeholder="Ex: 120"
                />
              </label>

              <label>
                Marks for Correct Answer
                <input
                  type="number"
                  step="0.01"
                  value={formState.positiveMarks}
                  onChange={(event) => handleFieldChange("positiveMarks", event.target.value)}
                  placeholder="Ex: 2"
                />
              </label>

              <label>
                Marks for Wrong Answer (Negative)
                <input
                  type="number"
                  step="0.01"
                  value={formState.negativeMarks}
                  onChange={(event) => handleFieldChange("negativeMarks", event.target.value)}
                  placeholder="Ex: -0.33"
                />
              </label>

              <label>
                Upload File (.csv, .xlsx, .xls, .docx)
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setFormState((prev) => ({ ...prev, file }));
                  }}
                />
              </label>

              <button type="submit" className="primary-btn">Create Test + Auto Assign</button>

              {uploadFeedback ? <p className="feedback-text">{uploadFeedback}</p> : null}
            </form>
          </article>

          {role === ROLE_SUPER_ADMIN ? (
            <article className="panel-card plans-panel">
              <div className="panel-title-row">
                <h2><FiGrid /> Plan Builder</h2>
                <span className="panel-badge">Super Admin</span>
              </div>

              <div className="settings-grid">
                <label>
                  Weekly Plan Test Limit
                  <input
                    type="number"
                    min="1"
                    value={planSettings.weeklyLimit}
                    onChange={(event) =>
                      setPlanSettings((prev) => ({ ...prev, weeklyLimit: Number(event.target.value) || 1 }))
                    }
                  />
                </label>

                <label>
                  Monthly Plan Test Limit
                  <input
                    type="number"
                    min="1"
                    value={planSettings.monthlyLimit}
                    onChange={(event) =>
                      setPlanSettings((prev) => ({ ...prev, monthlyLimit: Number(event.target.value) || 1 }))
                    }
                  />
                </label>

                <label>
                  Weekly Price (INR)
                  <input
                    type="number"
                    min="0"
                    value={planSettings.weeklyPrice}
                    onChange={(event) =>
                      setPlanSettings((prev) => ({ ...prev, weeklyPrice: Number(event.target.value) || 0 }))
                    }
                  />
                </label>

                <label>
                  Monthly Price (INR)
                  <input
                    type="number"
                    min="0"
                    value={planSettings.monthlyPrice}
                    onChange={(event) =>
                      setPlanSettings((prev) => ({ ...prev, monthlyPrice: Number(event.target.value) || 0 }))
                    }
                  />
                </label>
              </div>

              <div className="toggle-stack">
                <label><input type="checkbox" checked={planSettings.includeDailyQuizInWeekly} onChange={(event) => setPlanSettings((prev) => ({ ...prev, includeDailyQuizInWeekly: event.target.checked }))} /> Include Daily Quiz in Weekly</label>
                <label><input type="checkbox" checked={planSettings.includeFreeTestsInWeekly} onChange={(event) => setPlanSettings((prev) => ({ ...prev, includeFreeTestsInWeekly: event.target.checked }))} /> Include Free Tests in Weekly</label>
                <label><input type="checkbox" checked={planSettings.includeWeeklyInMonthly} onChange={(event) => setPlanSettings((prev) => ({ ...prev, includeWeeklyInMonthly: event.target.checked }))} /> Include Weekly Tests in Monthly</label>
                <label><input type="checkbox" checked={planSettings.includeDailyQuizInMonthly} onChange={(event) => setPlanSettings((prev) => ({ ...prev, includeDailyQuizInMonthly: event.target.checked }))} /> Include Daily Quiz in Monthly</label>
                <label><input type="checkbox" checked={planSettings.includeFreeTestsInMonthly} onChange={(event) => setPlanSettings((prev) => ({ ...prev, includeFreeTestsInMonthly: event.target.checked }))} /> Include Free Tests in Monthly</label>
              </div>

              <div className="plan-summary-row">
                <div>
                  <h4>Weekly Plan</h4>
                  <p>{groupedTests.weeklySet.length} tests available</p>
                  <p><FiDollarSign /> INR {planSettings.weeklyPrice}</p>
                </div>
                <div>
                  <h4>Monthly Plan</h4>
                  <p>{groupedTests.monthlySet.length} tests available</p>
                  <p><FiDollarSign /> INR {planSettings.monthlyPrice}</p>
                </div>
              </div>
            </article>
          ) : (
            <article className="panel-card restricted-panel">
              <div className="panel-title-row">
                <h2><FiLock /> Restricted Mode</h2>
                <span className="panel-badge">Content Admin</span>
              </div>
              <p>
                You can upload question papers and create/edit tests. Payment analytics, user management,
                and plan pricing are available only to Super Admin.
              </p>
            </article>
          )}
        </section>

        <section className="admin-content-grid lower-grid">
          <article className="panel-card flow-panel">
            <h2><FiDatabase /> Flow Validation</h2>
            <ol>
              <li>Admin uploads questions and tags test type.</li>
              <li>System auto assigns tests into weekly/monthly/free buckets.</li>
              <li>Plans expose only assigned tests to buyers.</li>
              <li>User access is controlled by purchased plan.</li>
            </ol>

            <div className="plan-tabs">
              <button type="button" className={selectedPlan === PLAN_WEEKLY ? "tab-btn active" : "tab-btn"} onClick={() => setSelectedPlan(PLAN_WEEKLY)}>Weekly</button>
              <button type="button" className={selectedPlan === PLAN_MONTHLY ? "tab-btn active" : "tab-btn"} onClick={() => setSelectedPlan(PLAN_MONTHLY)}>Monthly</button>
              <button type="button" className={selectedPlan === PLAN_FREE ? "tab-btn active" : "tab-btn"} onClick={() => setSelectedPlan(PLAN_FREE)}>Free</button>
            </div>

            <div className="test-list">
              {visibleTestsForSelectedPlan.length === 0 ? (
                <p className="empty-state">No tests available in this plan right now.</p>
              ) : (
                visibleTestsForSelectedPlan.map((test) => (
                  <div className="test-item" key={test.id}>
                    <div>
                      <h4>{test.testName}</h4>
                      <p>
                        Type: <strong>{test.type}</strong> | Access: <strong>{test.access}</strong>
                      </p>
                    </div>
                    <div className="meta-col">
                      <span>{test.questionCount} questions</span>
                      <span>{test.date || test.createdAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          {role === ROLE_SUPER_ADMIN ? (
            <article className="panel-card users-panel">
              <h2><FiUsers /> Users and Access</h2>
              <div className="user-list">
                {users.map((user) => (
                  <div key={user.id} className="user-row">
                    <div>
                      <h4>{user.name}</h4>
                      <p>Plan: {user.plan}</p>
                    </div>
                    <span className={user.activeWindow === "inactive" ? "status-dot inactive" : "status-dot"}>
                      {user.activeWindow === "today" ? "Active Today" : user.activeWindow === "week" ? "Active This Week" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      </main>

      {reviewedTest ? (
        <div className="quiz-review-modal-backdrop" role="dialog" aria-modal="true" aria-label="Quiz review panel">
          <div className="quiz-review-modal">
            <div className="quiz-review-header">
              <div>
                <p className="eyebrow">Quiz Review</p>
                <h2>{reviewedTest.testName}</h2>
                <p className="quiz-review-subtitle">
                  Review every question, edit options, or delete incorrect items.
                </p>
                {reviewedTest.config && (
                  <div className="quiz-config-display">
                    <span className="config-item"><FiClock /> <strong>{formatDuration(reviewedTest.config.durationMinutes)}</strong></span>
                    <span className="config-item"><strong>{reviewedTest.config.totalMarks}</strong> marks</span>
                    <span className="config-item"><strong>{reviewedTest.config.totalQuestions}</strong> Q</span>
                    <span className="config-item">+{reviewedTest.config.positiveMarks} / {reviewedTest.config.negativeMarks}</span>
                  </div>
                )}
              </div>

              <button type="button" className="icon-close-btn" onClick={closeTestReview}>
                <FiX />
              </button>
            </div>

            {editQuestionDraft ? (
              <div className="question-editor">
                <h3>Edit Question</h3>

                <label>
                  Question
                  <textarea
                    value={editQuestionDraft.question}
                    onChange={(event) =>
                      setEditQuestionDraft((prev) => ({ ...prev, question: event.target.value }))
                    }
                    rows={3}
                  />
                </label>

                <div className="editor-options">
                  {editQuestionDraft.options.map((option, optionIndex) => (
                    <label key={`${optionIndex}-${option.slice(0, 10)}`}>
                      Option {String.fromCharCode(65 + optionIndex)}
                      <input
                        type="text"
                        value={option}
                        onChange={(event) =>
                          setEditQuestionDraft((prev) => {
                            const nextOptions = [...prev.options];
                            nextOptions[optionIndex] = event.target.value;
                            return { ...prev, options: nextOptions };
                          })
                        }
                      />
                    </label>
                  ))}
                </div>

                <label>
                  Correct Answer
                  <select
                    value={editQuestionDraft.answerIndex}
                    onChange={(event) =>
                      setEditQuestionDraft((prev) => ({ ...prev, answerIndex: Number(event.target.value) }))
                    }
                  >
                    {editQuestionDraft.options.map((option, optionIndex) => (
                      <option key={optionIndex} value={optionIndex}>
                        {String.fromCharCode(65 + optionIndex)}) {option}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="editor-actions">
                  <button type="button" className="primary-btn" onClick={saveEditedQuestion}>
                    Save Changes
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setEditQuestionDraft(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="quiz-review-summary-row">
              <div className="quiz-review-summary-card">
                <strong>{(reviewedTest.parsedQuestions || []).length}</strong>
                <span>Parsed Questions</span>
              </div>
              <div className="quiz-review-summary-card">
                <strong>{reviewQuestionIndex + 1}</strong>
                <span>Active Question</span>
              </div>
            </div>

            <div className="question-review-list compact">
              {(reviewedTest.parsedQuestions || []).length === 0 ? (
                <p className="empty-state">No parsed questions available for this quiz.</p>
              ) : (
                (reviewedTest.parsedQuestions || []).map((question, questionIndex) => (
                  <button
                    type="button"
                    key={`${reviewedTest.id}-${questionIndex}`}
                    className={questionIndex === reviewQuestionIndex ? "question-index-btn active" : "question-index-btn"}
                    onClick={() => {
                      setReviewQuestionIndex(questionIndex);
                      setEditQuestionDraft(null);
                    }}
                  >
                    Q{questionIndex + 1}
                  </button>
                ))
              )}
            </div>

            {reviewedTest.parsedQuestions?.[reviewQuestionIndex] ? (
              (() => {
                const currentQuestion = reviewedTest.parsedQuestions[reviewQuestionIndex];
                const correctOption = currentQuestion.options?.[currentQuestion.answerIndex] || "Not marked";

                return (
                  <article className="question-review-card focused">
                    <div className="question-review-head">
                      <h4>{currentQuestion.question}</h4>
                      <div className="question-review-actions">
                        <button type="button" className="icon-action-btn small" onClick={() => startEditQuestion(reviewQuestionIndex)}>
                          <FiEdit3 />
                        </button>
                        <button type="button" className="icon-action-btn small danger" onClick={() => deleteQuestion(reviewQuestionIndex)}>
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>

                    <div className="question-review-options">
                      {(currentQuestion.options || []).map((option, optionIndex) => (
                        <div
                          key={`${reviewQuestionIndex}-${optionIndex}`}
                          className={optionIndex === currentQuestion.answerIndex ? "option-row correct" : "option-row"}
                        >
                          <span>{String.fromCharCode(65 + optionIndex)}.</span>
                          <span>{option}</span>
                        </div>
                      ))}
                    </div>

                    <p className="correct-answer-line">
                      Correct Answer: <strong>{String.fromCharCode(65 + (currentQuestion.answerIndex ?? 0))}</strong> - {correctOption}
                    </p>
                  </article>
                );
              })()
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
