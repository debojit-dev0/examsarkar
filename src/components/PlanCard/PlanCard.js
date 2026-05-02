import "./PlanCard.css";
import SubPlanCard from "./SubPlanCard";

export default function PlanSection({ title, highlight }) {

  const isDaily = title === "Daily Plan";
  const isWeekly = title === "Weekly Plan";

  return (
    <div className={`plan-card ${highlight ? "highlight" : ""}`}>

      {highlight && <div className="badge">Most Popular</div>}

      <h2>{title}</h2>

      <div className="sub-container">

        {/* GS */}
        <SubPlanCard
          title="GS"
          price={isDaily ? 99 : isWeekly ? 599 : 2499}
          features={[
            "Topic-wise Tests",
            "Current Affairs MCQs",
            "Performance Tracking"
          ]}
        />

        {/* CSAT */}
        <SubPlanCard
          title="CSAT"
          price={isDaily ? 99 : isWeekly ? 599 : 2499}
          features={[
            "Practice Tests",
            "Time Analysis",
            "Aptitude Practice"
          ]}
        />

        {/* 🔥 COMBO */}
        <SubPlanCard
          title="COMBO"
          price={isDaily ? 149 : isWeekly ? 999 : 3999}
          features={[
            "GS + CSAT Included",
            "Full Test Access",
            "Advanced Analytics"
          ]}
        />

      </div>

    </div>
  );
}