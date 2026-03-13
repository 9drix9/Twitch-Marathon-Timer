"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createTimer() {
    setLoading(true);
    try {
      const res = await fetch("/api/create", { method: "POST" });
      const data = await res.json();
      if (data.id) {
        router.push(`/${data.id}/admin`);
      }
    } catch {
      setLoading(false);
    }
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
