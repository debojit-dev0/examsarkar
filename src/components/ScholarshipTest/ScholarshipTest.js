import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../../utils/apiBaseUrl";
import "./ScholarshipTest.css";

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || "";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function formatCount(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

function getAccessToken() {
  return localStorage.getItem("accessToken") || localStorage.getItem("token");
}

export default function ScholarshipTest() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [myTestState, setMyTestState] = useState({ checked: false, available: false, message: "" });
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  const isLoggedIn = Boolean(getAccessToken());

  const loadStatus = useCallback(async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(buildApiUrl("/api/scholarship/status"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to load scholarship status:", err);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/scholarship/leaderboard"));
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  }, []);

  const loadWinners = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/scholarship/winners"));
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setWinners(Array.isArray(data.winners) ? data.winners : []);
      }
    } catch (err) {
      console.error("Failed to load winners:", err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStatus(), loadLeaderboard(), loadWinners()]);
    setLoading(false);
  }, [loadStatus, loadLeaderboard, loadWinners]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live clock — drives the countdown and the "has the test gone live" check
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const testStartMs = status?.testStartAt ? new Date(status.testStartAt).getTime() : null;
  const isTestLive = Boolean(testStartMs && now >= testStartMs);

  // Once the test has gone live and this user has an entry, check whether their
  // paper is ready to attempt or they've already submitted it.
  useEffect(() => {
    if (!status?.hasEntered || !isTestLive) return;
    let cancelled = false;

    (async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        const res = await fetch(buildApiUrl("/api/scholarship/my-test"), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) {
          setMyTestState({
            checked: true,
            available: Boolean(data?.test),
            message: data?.message || ""
          });
        }
      } catch (err) {
        console.error("Failed to check scholarship test availability:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status?.hasEntered, isTestLive]);

  const countdown = useMemo(() => {
    if (!testStartMs) return null;
    const diff = Math.max(testStartMs - now, 0);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  }, [testStartMs, now]);

  const handleEnter = async () => {
    if (!isLoggedIn) return;
    setPaying(true);
    try {
      const token = getAccessToken();
      const orderRes = await fetch(buildApiUrl("/api/scholarship/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const orderData = await orderRes.json().catch(() => null);
      if (!orderRes.ok) {
        alert(orderData?.message || "Could not start payment. Please try again.");
        setPaying(false);
        return;
      }

      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) {
        alert("Razorpay could not be loaded. Check your connection and try again.");
        setPaying(false);
        return;
      }

      const options = {
        key: orderData.key_id || RAZORPAY_KEY,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "ExamSarkar",
        description: `Scholarship Test Entry — ${status?.weekKey || ""}`,
        order_id: orderData.order.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(buildApiUrl("/api/scholarship/verify"), {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify(response)
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (verifyRes.ok && verifyData?.success) {
              await loadAll();
            } else {
              alert("Payment verification failed. Please contact support if the amount was deducted.");
            }
          } catch (err) {
            console.error("Scholarship verify error:", err);
            alert("Payment verification failed. Please contact support if the amount was deducted.");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false)
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Scholarship entry error:", err);
      alert("Something went wrong. Please try again.");
      setPaying(false);
    }
  };

  const handleStartTest = () => {
    if (!status?.weekKey) return;
    navigate(`/test/scholarship-${status.weekKey}`);
  };

  const slotsFilled = status?.slotsFilled || 0;
  const slotsTotal = status?.slotsTotal || 1000000;
  const slotsPercent = Math.min(100, Math.round((slotsFilled / slotsTotal) * 1000) / 10);

  const renderBadge = () => {
    if (!status) return null;
    if (!status.testExists) return <span className="scholarship-badge not-found">NOT FOUND</span>;
    if (status.hasEntered && isTestLive && myTestState.checked && !myTestState.available) {
      return <span className="scholarship-badge submitted">SUBMITTED</span>;
    }
    if (status.hasEntered && isTestLive) return <span className="scholarship-badge live">LIVE NOW</span>;
    if (status.hasEntered) return <span className="scholarship-badge entered">ENTERED ✓</span>;
    if (status.entryOpen) return <span className="scholarship-badge open">OPEN</span>;
    return <span className="scholarship-badge closed">CLOSED</span>;
  };

  const renderCTA = () => {
    if (!isLoggedIn) {
      return <p className="scholarship-note">Please login to enter this week's Scholarship Test.</p>;
    }
    if (!status) return null;
    if (status.hasEntered && isTestLive) {
      if (myTestState.checked && myTestState.available) {
        return (
          <button className="scholarship-cta" onClick={handleStartTest}>
            Start Test →
          </button>
        );
      }
      if (myTestState.checked && !myTestState.available) {
        return (
          <button
            className="scholarship-cta secondary"
            onClick={() =>
              document.getElementById("scholarship-leaderboard")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            View Leaderboard
          </button>
        );
      }
      return <p className="scholarship-note">Loading your paper…</p>;
    }
    if (status.hasEntered) {
      return <p className="scholarship-note">You're in! Come back Sunday 9:00 AM to take the test.</p>;
    }
    if (status.entryOpen) {
      return (
        <button className="scholarship-cta" onClick={handleEnter} disabled={paying}>
          {paying ? "Processing…" : `Pay ₹${status.entryFeeRupees} & Enter`}
        </button>
      );
    }
    return <p className="scholarship-note">Entry closed for this week. Next round opens Monday.</p>;
  };

  return (
    <div className="scholarship-card">
      <div className="scholarship-header">
        <div>
          <h3 className="scholarship-title">Scholarship Test</h3>
          <p className="scholarship-subtitle">Attend Scholarship Test every Sunday</p>
        </div>
        {renderBadge()}
      </div>

      {loading ? (
        <p className="scholarship-note">Loading…</p>
      ) : !status?.testExists ? (
        <div className="scholarship-empty">
          <p className="scholarship-empty-title">Tests not found</p>
          <p className="scholarship-note">Attend Scholarship Test every Sunday at 9:00 AM</p>
        </div>
      ) : (
        <>
          {winners.length > 0 && (
            <div className="scholarship-winners-banner">
              <p className="scholarship-winners-title">🏆 This Week's Winners</p>
              <div className="scholarship-winners-row">
                {winners.map((w) => (
                  <div key={w.rank} className={`scholarship-winner rank-${w.rank}`}>
                    <span className="scholarship-winner-medal">
                      {w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : "🥉"}
                    </span>
                    <span className="scholarship-winner-name">{w.name}</span>
                    <span className="scholarship-winner-score">{w.score}%</span>
                    <span className="scholarship-winner-prize">{formatINR(w.prize)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isTestLive && countdown && (
            <div className="scholarship-countdown">
              <div className="scholarship-countdown-tile">
                <span className="scholarship-countdown-value">{countdown.days}</span>
                <span className="scholarship-countdown-label">Days</span>
              </div>
              <div className="scholarship-countdown-tile">
                <span className="scholarship-countdown-value">{String(countdown.hours).padStart(2, "0")}</span>
                <span className="scholarship-countdown-label">Hrs</span>
              </div>
              <div className="scholarship-countdown-tile">
                <span className="scholarship-countdown-value">{String(countdown.minutes).padStart(2, "0")}</span>
                <span className="scholarship-countdown-label">Min</span>
              </div>
              <div className="scholarship-countdown-tile">
                <span className="scholarship-countdown-value">{String(countdown.seconds).padStart(2, "0")}</span>
                <span className="scholarship-countdown-label">Sec</span>
              </div>
            </div>
          )}

          <div className="scholarship-slots">
            <div className="scholarship-slots-bar">
              <div className="scholarship-slots-fill" style={{ width: `${slotsPercent}%` }} />
            </div>
            <p className="scholarship-slots-text">
              {formatCount(slotsFilled)} / {formatCount(slotsTotal)} slots filled ({slotsPercent}%)
            </p>
          </div>

          <div className="scholarship-cta-row">{renderCTA()}</div>

          <div className="scholarship-leaderboard" id="scholarship-leaderboard">
            <p className="scholarship-leaderboard-title">All India Ranking</p>
            {leaderboard.length === 0 ? (
              <p className="scholarship-note">No submissions yet this week. Be the first!</p>
            ) : (
              <div className="scholarship-leaderboard-list">
                {leaderboard.slice(0, 50).map((entry) => (
                  <div key={entry.uid} className="scholarship-leaderboard-row">
                    <span className="scholarship-rank">#{entry.rank}</span>
                    <span className="scholarship-name">{entry.name}</span>
                    <span className="scholarship-score">{entry.score}%</span>
                  </div>
                ))}
                {leaderboard.length > 50 && (
                  <p className="scholarship-note">Showing top 50 of {formatCount(leaderboard.length)} entries.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
