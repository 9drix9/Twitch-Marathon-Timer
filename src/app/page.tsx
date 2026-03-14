"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; admin_secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function createTimer() {
    setLoading(true);
    try {
      const res = await fetch("/api/create", { method: "POST" });
      const data = await res.json();
      if (data.id && data.admin_secret) {
        setCreated(data);
      }
    } catch {
      setLoading(false);
    }
  }

  function copySecret() {
    if (!created) return;
    navigator.clipboard.writeText(created.admin_secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function goToAdmin() {
    if (!created) return;
    localStorage.setItem(`timer_${created.id}_secret`, created.admin_secret);
    router.push(`/${created.id}/admin`);
  }

  if (created) {
    return (
      <div
        style={{
          background: "var(--bg)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            color: "#4ade80",
            textAlign: "center",
          }}
        >
          Timer Created!
        </h1>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1.5rem",
            maxWidth: 520,
            width: "100%",
          }}
        >
          <p style={{ color: "var(--pink)", fontWeight: 700, fontSize: "0.95rem", marginBottom: "1rem" }}>
            Save your admin secret below. You need it to access your dashboard.
            It cannot be recovered if lost.
          </p>

          <div style={{ marginBottom: "0.5rem", fontSize: "0.85rem", color: "var(--text-dim)" }}>
            Admin Secret:
          </div>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.95rem",
              color: "var(--cyan)",
              wordBreak: "break-all",
              marginBottom: "0.75rem",
              userSelect: "all",
            }}
          >
            {created.admin_secret}
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={copySecret}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied!" : "Copy Secret"}
            </button>
            <button
              onClick={goToAdmin}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "8px",
                border: "1px solid var(--cyan)",
                background: "rgba(0, 255, 242, 0.1)",
                color: "var(--cyan)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Continue to Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "3rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, var(--cyan), var(--purple))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textAlign: "center",
        }}
      >
        Marathon Timer
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: "1.2rem", textAlign: "center", maxWidth: 500 }}>
        Free subathon &amp; marathon timer overlay for Twitch streamers.
        Subs, donations, bits, raids, and more add time to your countdown.
      </p>
      <button
        onClick={createTimer}
        disabled={loading}
        style={{
          padding: "1rem 2.5rem",
          fontSize: "1.1rem",
          fontWeight: 700,
          border: "none",
          borderRadius: "12px",
          cursor: loading ? "wait" : "pointer",
          background: "linear-gradient(135deg, var(--cyan), var(--purple))",
          color: "#000",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {loading ? "Creating..." : "Create Timer"}
      </button>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
        No login required. Your timer gets a unique link you can bookmark.
      </p>
    </div>
  );
}
