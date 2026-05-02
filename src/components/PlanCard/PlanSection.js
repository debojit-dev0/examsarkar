import "./PlanSection.css";
import SubPlanCard from "./SubPlanCard";

export default function PlanSection({ title, price, type, highlight }) {

  // 🔥 FEATURE LOGIC
  const getFeatures = (type, subject) => {

    const common = [
      "Timed Practice Tests",
      "Instant Results & Solutions",
      "Performance Tracking"
    ];

    if (type === "daily") {
      return [
        ...common,
        "1 Free Sectional Test",
        subject === "CSAT"
          ? "Basic Aptitude Practice"
          : subject === "GS"
          ? "Daily Current Affairs MCQs"
          : "GS + CSAT Combined Access"
      ];
    }

    if (type === "weekly") {
      return [
        ...common,
        "2 Free Tests (Sectional + Mini Mock)",
        subject === "CSAT"
          ? "Timed CSAT Practice Sets"
          : subject === "GS"
          ? "Topic-wise GS Tests"
          : "Full GS + CSAT Access",
        "Detailed Performance Analysis",
        "Weak Area Identification"
      ];
    }

    if (type === "monthly") {
      return [
        ...common,
        "4 Full-Length Mock Tests",
        subject === "CSAT"
          ? "Advanced CSAT Drills"
          : subject === "GS"
          ? "Complete GS Coverage"
          : "Complete GS + CSAT Bundle",
        "All India Ranking",
        "Detailed Analytics Dashboard",
        "Exam Simulation Mode",
        "Topper Strategy Insights"
      ];
    }

    return [];
  };

  // 🔥 SUBTITLE
  const getSubtitle = () => {
    if (type === "daily") return "Start your preparation";
    if (type === "weekly") return "Most students prefer this";
    return "Complete UPSC-level preparation";
  };

  // 🔥 PRICE LOGIC
  const getPrice = (subject) => {
    if (type === "daily") {
      if (subject === "COMBO") return 149;
      return 99;
    }

    if (type === "weekly") {
      if (subject === "COMBO") return 999;
      return 599;
    }

    if (type === "monthly") {
      if (subject === "COMBO") return 3999;
      return 2499;
    }

    return price;
  };

  return (
    <div className={`plan-section ${highlight ? "highlight" : ""}`}>

      {/* HEADER */}
      <div className="plan-header">
        <div>
          <h2>{title}</h2>
          <p className="plan-subtitle">{getSubtitle()}</p>
        </div>

        {highlight && <span className="badge">Most Popular</span>}
      </div>

      {/* WEEKLY TAG */}
      {type === "weekly" && (
        <div className="best-tag">Best Value</div>
      )}

      {/* 🔥 CARDS (NOW 3) */}
      <div className="sub-row">

        {/* GS */}
        <SubPlanCard
          title="GS"
          price={getPrice("GS")}
          features={getFeatures(type, "GS")}
        />

        {/* CSAT */}
        <SubPlanCard
          title="CSAT"
          price={getPrice("CSAT")}
          features={getFeatures(type, "CSAT")}
        />

        {/* 🔥 COMBO */}
        <SubPlanCard
          title="COMBO"
          price={getPrice("COMBO")}
          features={getFeatures(type, "COMBO")}
        />

      </div>

    </div>
  );
}