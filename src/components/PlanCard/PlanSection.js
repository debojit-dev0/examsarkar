import "./PlanSection.css";
import SubPlanCard from "./SubPlanCard";

export default function PlanSection({ title, price, type, highlight }) {

  // 🔥 FEATURE LOGIC
  const getFeatures = (type, subject) => {
    if (type === "daily") {
      if (subject === "GS") {
        return [
          "01 Test per purchase",
          "Focused on GS & CA",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
        ];
      }
  
      if (subject === "CSAT") {
        return [
          "01 Test per purchase",
          "Focused on Analytical, RC",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
        ];
      }
  
      return [
        "02 Tests per purchase",
        "Focused on GS & CSAT",
        "Timed Practice Test",
        "Instant Results and Solutions",
        "Performance Tracking",
        "Exam Simulation Mode",
      ];
    }
  
    if (type === "weekly") {
      if (subject === "GS") {
        return [
          "07 Tests per purchase",
          "Focused on GS & CA",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
          "Detailed Performance Analysis",
        ];
      }
  
      if (subject === "CSAT") {
        return [
          "07 Tests per purchase",
          "Focused on Analytical and RC",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
          "Detailed Performance Analysis",
        ];
      }
  
      return [
        "14 Tests per purchase",
        "Focused on GS & CSAT",
        "Timed Practice Test",
        "Instant Results and Solutions",
        "Performance Tracking",
        "Exam Simulation Mode",
        "Detailed Performance Analysis",
      ];
    }
  
    if (type === "monthly") {
      if (subject === "GS") {
        return [
          "30-31 Tests per purchase",
          "Focused on GS & CA",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
          "Detailed Performance Analysis",
          "Weak Area Identification",
        ];
      }
  
      if (subject === "CSAT") {
        return [
          "30-31 Tests per purchase",
          "Focused on Analytical & RC",
          "Timed Practice Test",
          "Instant Results and Solutions",
          "Performance Tracking",
          "Exam Simulation Mode",
          "Detailed Performance Analysis",
          "Weak Area Identification",
        ];
      }
  
      return [
        "60-62 Tests per purchase",
        "Focused on GS & CSAT",
        "Timed Practice Test",
        "Instant Results and Solutions",
        "Performance Tracking",
        "Exam Simulation Mode",
        "Detailed Performance Analysis",
        "Weak Area Identification",
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
      return subject === "COMBO" ? 149 : 99;
    }
  
    if (type === "weekly") {
      return subject === "COMBO" ? 999 : 599;
    }
  
    if (type === "monthly") {
      return subject === "COMBO" ? 2499 : 1499;
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

  {type === "weekly" && (
    <span className="badge">Best Value</span>
  )}

  {highlight && type !== "weekly" && (
    <span className="badge">Most Popular</span>
  )}
</div>
      {/* 🔥 CARDS (NOW 3) */}
      <div className="sub-row">

        {/* GS */}
        <SubPlanCard
          title="GS"
          price={getPrice("GS")}
          features={getFeatures(type, "GS")}
          type={type}
        />

        {/* CSAT */}
        <SubPlanCard
          title="CSAT"
          price={getPrice("CSAT")}
          features={getFeatures(type, "CSAT")}
          type={type}
        />

        {/* 🔥 COMBO */}
        <SubPlanCard
          title="COMBO"
          price={getPrice("COMBO")}
          features={getFeatures(type, "COMBO")}
          type={type}
        />

      </div>

    </div>
  );
}