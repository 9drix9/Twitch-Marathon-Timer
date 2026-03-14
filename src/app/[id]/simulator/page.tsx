"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TimerState {
  remaining_ms: number;
  is_paused: boolean;
  max_cap_ms?: number | null;
}

interface SimulateResponse {
  event_id: string;
  time_added_ms: number;
  type: string;
}

const BUTTONS = [
  { label: "Tier 1 Sub", type: "sub_tier1", meta: { user: "TestUser" } },
  { label: "Tier 2 Sub", type: "sub_tier2", meta: { user: "TestUser" } },
  { label: "Tier 3 Sub", type: "sub_tier3", meta: { user: "TestUser" } },
  { label: "Gift 5 Subs", type: "gifted_sub", meta: { user: "TestUser", count: 5 } },
  { label: "100 Bits", type: "bits", meta: { user: "TestUser", bits: 100 } },
  { label: "500 Bits", type: "bits", meta: { user: "TestUser", bits: 500 } },
  { label: "$5 Donation", type: "donation", meta: { user: "TestUser", amount: 5 } },
  { label: "$25 Donation", type: "donation", meta: { user: "TestUser", amount: 25 } },
  { label: "Follow", type: "follow", meta: { user: "TestUser" } },
  { label: "Raid (50 viewers)", type: "raid", meta: { user: "TestUser", viewers: 50 } },
] as const;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatAdded(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const sign = ms >= 0 ? "+" : "-";
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

export default function SimulatorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [adminSecret, setAdminSecret] = useState<string>("");
  const [secretInput, setSecretInput] = useState("");
  const [authLoaded, setAuthLoaded] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`timer_${id}_secret`);
    if (stored) setAdminSecret(stored);
    setAuthLoaded(true);
  }, [id]);

  function submitSecret() {
    const val = secretInput.trim();
    if (!val) return;
    localStorage.setItem(`timer_${id}_secret`, val);
    setAdminSecret(val);
    setAuthError(false);
  }

  async function fetchTimer() {
    try {
      const res = await fetch(`/api/${id}/timer`);
      if (res.ok) setTimer(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchTimer();
    const interval = setInterval(fetchTimer, 2000);
    return () => clearInterval(interval);
  }, [id]);

  async function simulate(type: string, meta: Record<string, unknown>) {
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/${id}/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { Authorization: `Bearer ${adminSecret}` } : {}),
        },
        body: JSON.stringify({ type, meta }),
      });
      if (res.status === 401) {
        setAuthError(true);
        setSending(false);
        return;
      }
      if (res.ok) {
        const data: SimulateResponse = await res.json();
        const added = formatAdded(data.time_added_ms);
        setFeedback(`Added ${added} to timer`);
        fetchTimer();
      } else {
        setFeedback("Error simulating event");
      }
    } catch {
      setFeedback("Network error");
    } finally {
      setSending(false);
    }
  }

  // Login gate
  if (authLoaded && (!adminSecret || authError)) {
    return (
      <div style={{
        background: "var(--bg)", minHeight: "100vh", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem",
      }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "12px", padding: "1.5rem", maxWidth: 440, width: "100%", textAlign: "center",
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--purple)", marginBottom: "1rem", fontFamily: "var(--font-mono)" }}>
            Simulator Login
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
            Enter your admin secret to use the simulator.
          </p>
          {authError && (
            <p style={{ color: "var(--pink)", fontSize: "0.85rem", marginBottom: "0.75rem", fontWeight: 600 }}>
              Invalid secret.
            </p>
          )}
          <input
            type="password"
            style={{
              padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)",
              fontSize: "0.85rem", width: "100%", outline: "none", marginBottom: "0.75rem",
            }}
            placeholder="Paste your admin secret..."
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSecret()}
          />
          <button
            onClick={submitSecret}
            style={{
              padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid var(--cyan)",
              background: "rgba(0, 255, 242, 0.1)", color: "var(--cyan)", fontFamily: "var(--font-mono)",
              fontSize: "0.85rem", cursor: "pointer", fontWeight: 600,
            }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
      }}
    >
      <Link
        href={`/${id}/admin`}
        style={{
          alignSelf: "flex-start",
          color: "var(--cyan)",
          textDecoration: "none",
          fontSize: "0.9rem",
          opacity: 0.8,
        }}
      >
        &larr; Back to Admin
      </Link>

      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, var(--cyan), var(--purple))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Event Simulator
      </h1>

      {/* Timer State */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "1.25rem 2rem",
          textAlign: "center",
          minWidth: 280,
        }}
      >
        {timer ? (
          <>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "2.5rem",
                fontWeight: 700,
                color: "var(--cyan)",
                letterSpacing: "0.05em",
              }}
            >
              {formatTime(timer.remaining_ms)}
            </div>
            <div
              style={{
                color: !timer.is_paused ? "var(--cyan)" : "var(--pink)",
                fontSize: "0.85rem",
                marginTop: "0.5rem",
                fontWeight: 600,
              }}
            >
              {!timer.is_paused ? "RUNNING" : "PAUSED"}
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-dim)" }}>Loading timer...</div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          style={{
            background: "rgba(0, 255, 242, 0.08)",
            border: "1px solid rgba(0, 255, 242, 0.25)",
            borderRadius: "8px",
            padding: "0.75rem 1.5rem",
            color: "var(--cyan)",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          {feedback}
        </div>
      )}

      {/* Button Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "0.75rem",
          width: "100%",
          maxWidth: 700,
        }}
      >
        {BUTTONS.map((btn) => (
          <button
            key={btn.label}
            onClick={() => simulate(btn.type, { ...btn.meta })}
            disabled={sending}
            style={{
              padding: "0.9rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              border: "1px solid var(--border)",
              borderRadius: "10px",
              cursor: sending ? "wait" : "pointer",
              background: "var(--surface)",
              color: "var(--text)",
              transition: "border-color 0.2s, background 0.2s",
              opacity: sending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--purple)";
              e.currentTarget.style.background = "rgba(180, 74, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "1rem" }}>
        Simulated events use the same time rules as real events.
      </p>
    </div>
  );
}
