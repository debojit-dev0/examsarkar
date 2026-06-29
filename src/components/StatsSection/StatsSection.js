import "./StatsSection.css";
import { useEffect, useState } from "react";

export default function StatsSection() {
  const stats = [
    { label: "Active Students", value: 12000 },
    { label: "Tests Available", value: 350 },
    { label: "Questions Practiced", value: 50000 },
    { label: "Top Rankers", value: 1200 }
  ];

  return (
    <section className="stats-section">
      <div className="stats-container">
        {stats.map((item, index) => (
          <StatCard key={index} value={item.value} label={item.label} />
        ))}
      </div>
    </section>
  );
}

/* 🔥 Counter Component */
function StatCard({ value, label }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);

    const counter = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(counter);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(counter);
  }, [value]);

  return (
    <div className="stat-card">
      <h2>{count.toLocaleString()}+</h2>
      <p>{label}</p>
    </div>
  );
}