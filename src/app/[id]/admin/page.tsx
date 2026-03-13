"use client";

import { useEffect, useState, useCallback } from "react";

interface TimerState {
  remaining_ms: number;
  is_paused: boolean;
  ended: boolean;
}

interface TimeRules {
  tier1_sub_ms: number;
  tier2_sub_ms: number;
  tier3_sub_ms: number;
  gifted_sub_ms: number;
  bits_per_100_ms: number;
  donation_per_dollar_ms: number;
  follow_ms: number;
  follow_enabled: boolean;
  raid_ms: number;
  raid_enabled: boolean;
}

interface TwitchConnection {
  connected?: boolean;
  username?: string;
  user_id?: string;
}

interface Integrations {
  streamelements_jwt: string | null;
  streamlabs_token: string | null;
}

interface OverlaySettings {
  enabled_events: {
    subs: boolean;
    bits: boolean;
    donations: boolean;
    follows: boolean;
    raids: boolean;
    channel_points: boolean;
  };
}

interface TimerEvent {
  id?: string;
  type: string;
  detail?: Record<string, unknown>;
  time_added_ms?: number;
  created_at?: string;
}

function formatTime(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

function minutesToMs(min: number): number {
  return min * 60000;
}

function friendlyEventName(type: string, detail?: Record<string, unknown>): string {
  switch (type) {
    case "sub_tier1": return "Tier 1 Sub";
    case "sub_tier2": return "Tier 2 Sub";
    case "sub_tier3": return "Tier 3 Sub";
    case "gifted_sub": {
      const count = (detail?.count || 1) as number;
      return `${count} Gift Sub${count > 1 ? "s" : ""}`;
    }
    case "bits": {
      const bits = (detail?.bits || 0) as number;
      return `${bits} Bits`;
    }
    case "donation": {
      const amount = (detail?.amount || 0) as number;
      return `$${amount} Donation`;
    }
    case "follow": return "Follow";
    case "raid": {
      const viewers = (detail?.viewers || 0) as number;
      return `Raid (${viewers} viewers)`;
    }
    case "custom_reward": return "Channel Points";
    default: return type;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "2rem",
    maxWidth: "900px",
    margin: "0 auto",
  } as React.CSSProperties,

  heading: {
    fontFamily: "var(--font-mono)",
    fontSize: "1.5rem",
    color: "var(--cyan)",
    marginBottom: "2rem",
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--purple)",
    marginBottom: "1rem",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.03em",
  } as React.CSSProperties,

  timerDisplay: {
    fontFamily: "var(--font-mono)",
    fontSize: "3.5rem",
    fontWeight: 700,
    textAlign: "center" as const,
    color: "var(--cyan)",
    letterSpacing: "0.1em",
    marginBottom: "1rem",
  } as React.CSSProperties,

  badge: {
    display: "inline-block",
    padding: "0.2rem 0.7rem",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.08em",
    marginLeft: "0.75rem",
  } as React.CSSProperties,

  btnRow: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
    justifyContent: "center",
  } as React.CSSProperties,

  btn: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.15s ease",
  } as React.CSSProperties,

  btnPrimary: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid var(--cyan)",
    background: "rgba(0, 255, 242, 0.1)",
    color: "var(--cyan)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,

  btnDanger: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid var(--pink)",
    background: "rgba(255, 74, 141, 0.1)",
    color: "var(--pink)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,

  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  label: {
    minWidth: "180px",
    fontSize: "0.85rem",
    color: "var(--text-dim)",
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,

  input: {
    padding: "0.4rem 0.6rem",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    width: "100px",
    outline: "none",
  } as React.CSSProperties,

  inputWide: {
    padding: "0.4rem 0.6rem",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    width: "100%",
    outline: "none",
  } as React.CSSProperties,

  desc: {
    fontSize: "0.75rem",
    color: "var(--text-dim)",
    marginTop: "0.2rem",
    marginBottom: "1rem",
  } as React.CSSProperties,

  toggle: {
    position: "relative" as const,
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "background 0.2s",
    border: "none",
    flexShrink: 0,
  } as React.CSSProperties,

  toggleDot: {
    position: "absolute" as const,
    top: "3px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s",
  } as React.CSSProperties,

  eventItem: {
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.85rem",
    fontFamily: "var(--font-mono)",
  } as React.CSSProperties,

  urlBox: {
    padding: "0.5rem 0.75rem",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--cyan)",
    wordBreak: "break-all" as const,
    marginBottom: "0.75rem",
    cursor: "pointer",
  } as React.CSSProperties,
};

// ─── Toggle Component ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        ...styles.toggle,
        background: checked ? "var(--cyan)" : "var(--border)",
      }}
    >
      <span
        style={{
          ...styles.toggleDot,
          left: checked ? "22px" : "3px",
        }}
      />
    </button>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function AdminPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Timer state
  const [timer, setTimer] = useState<TimerState>({
    remaining_ms: 0,
    is_paused: true,
    ended: false,
  });

  // Time rules
  const [rules, setRules] = useState<TimeRules | null>(null);

  // Twitch connection
  const [twitch, setTwitch] = useState<TwitchConnection>({});

  // Integrations
  const [integrations, setIntegrations] = useState<Integrations>({
    streamelements_jwt: null,
    streamlabs_token: null,
  });
  const [seInput, setSeInput] = useState("");
  const [slInput, setSlInput] = useState("");

  // Overlay settings
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    enabled_events: {
      subs: true,
      bits: true,
      donations: true,
      follows: false,
      raids: true,
      channel_points: true,
    },
  });

  // Events
  const [events, setEvents] = useState<TimerEvent[]>([]);

  // Copied state for URL copy buttons
  const [copied, setCopied] = useState<string | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchTimer = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/timer`);
      if (res.ok) setTimer(await res.json());
    } catch {}
  }, [id]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/settings`);
      if (res.ok) setRules(await res.json());
    } catch {}
  }, [id]);

  const fetchTwitch = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/twitch`);
      if (res.ok) setTwitch(await res.json());
    } catch {}
  }, [id]);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/integrations`);
      if (res.ok) setIntegrations(await res.json());
    } catch {}
  }, [id]);

  const fetchOverlaySettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/settings?type=overlay`);
      if (res.ok) setOverlaySettings(await res.json());
    } catch {}
  }, [id]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/${id}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data.slice(0, 20) : []);
      }
    } catch {}
  }, [id]);

  // Initial load
  useEffect(() => {
    fetchTimer();
    fetchRules();
    fetchTwitch();
    fetchIntegrations();
    fetchOverlaySettings();
    fetchEvents();
  }, [fetchTimer, fetchRules, fetchTwitch, fetchIntegrations, fetchOverlaySettings, fetchEvents]);

  // Poll timer every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchTimer, 2000);
    return () => clearInterval(interval);
  }, [fetchTimer]);

  // Poll events every 3 seconds
  useEffect(() => {
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // ─── Timer Actions ───────────────────────────────────────────────────────

  async function timerAction(action: string, ms?: number) {
    await fetch(`/api/${id}/timer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ms }),
    });
    fetchTimer();
  }

  // ─── Rules Saving ────────────────────────────────────────────────────────

  async function saveRule(field: string, value: number | boolean) {
    const updated = { ...rules, [field]: value } as TimeRules;
    setRules(updated);
    await fetch(`/api/${id}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  // ─── Twitch Actions ──────────────────────────────────────────────────────

  async function connectTwitch() {
    const res = await fetch(`/api/${id}/twitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function disconnectTwitch() {
    await fetch(`/api/${id}/twitch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    fetchTwitch();
  }

  // ─── Integration Saving ──────────────────────────────────────────────────

  async function saveIntegration(field: string, value: string) {
    await fetch(`/api/${id}/integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchIntegrations();
  }

  // ─── Overlay Settings ────────────────────────────────────────────────────

  async function saveOverlayToggle(event: string, enabled: boolean) {
    const updated = {
      ...overlaySettings,
      enabled_events: { ...overlaySettings.enabled_events, [event]: enabled },
    };
    setOverlaySettings(updated);
    await fetch(`/api/${id}/settings?type=overlay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "overlay", enabled_events: updated.enabled_events }),
    });
  }

  // ─── Copy URL ─────────────────────────────────────────────────────────────

  function copyUrl(url: string, label: string) {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const isPaused = timer.is_paused && !timer.ended;
  const timerColor = timer.ended
    ? "var(--pink)"
    : isPaused
      ? "var(--text-dim)"
      : "var(--cyan)";

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Marathon Timer — Admin</h1>

      {/* ── Timer Display & Controls ─────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Timer</div>
        <div style={{ ...styles.timerDisplay, color: timerColor }}>
          {formatTime(timer.remaining_ms)}
          {isPaused && !timer.ended && (
            <span
              style={{
                ...styles.badge,
                background: "rgba(136, 136, 160, 0.2)",
                color: "var(--text-dim)",
              }}
            >
              PAUSED
            </span>
          )}
          {timer.ended && (
            <span
              style={{
                ...styles.badge,
                background: "rgba(255, 74, 141, 0.2)",
                color: "var(--pink)",
              }}
            >
              ENDED
            </span>
          )}
        </div>
        <div style={styles.btnRow}>
          {!timer.is_paused ? (
            <button style={styles.btn} onClick={() => timerAction("pause")}>
              Pause
            </button>
          ) : (
            <button style={styles.btnPrimary} onClick={() => timerAction("resume")}>
              Start
            </button>
          )}
          <button style={styles.btn} onClick={() => timerAction("add", 5 * 60000)}>
            +5 min
          </button>
          <button style={styles.btn} onClick={() => timerAction("add", 10 * 60000)}>
            +10 min
          </button>
          <button style={styles.btn} onClick={() => timerAction("subtract", 5 * 60000)}>
            -5 min
          </button>
          <button style={styles.btnDanger} onClick={() => timerAction("reset", 86400000)}>
            Reset (24h)
          </button>
        </div>
      </div>

      {/* ── Twitch Connection ────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Twitch Connection</div>
        {twitch.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>
              Connected as <strong>{twitch.username}</strong>
            </span>
            <button style={styles.btnDanger} onClick={disconnectTwitch}>
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ ...styles.desc, marginBottom: "0.75rem" }}>
              Connect your Twitch account to receive sub, bit, and raid events automatically.
            </p>
            <button style={styles.btnPrimary} onClick={connectTwitch}>
              Connect Twitch
            </button>
          </div>
        )}
      </div>

      {/* ── Integration Tokens ───────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Integration Tokens</div>
        <p style={styles.desc}>
          Paste your StreamElements JWT or Streamlabs access token to receive donation and tip events.
        </p>

        {/* StreamElements */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
            StreamElements JWT
          </div>
          {integrations.streamelements_jwt && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
              Current: {integrations.streamelements_jwt}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              style={styles.inputWide}
              placeholder="Paste your StreamElements JWT token..."
              value={seInput}
              onChange={(e) => setSeInput(e.target.value)}
            />
            <button
              style={styles.btnPrimary}
              onClick={() => {
                if (seInput.trim()) {
                  saveIntegration("streamelements_jwt", seInput.trim());
                  setSeInput("");
                }
              }}
            >
              Save
            </button>
          </div>
          <div style={{ ...styles.desc, marginTop: "0.5rem" }}>
            Webhook URL:{" "}
            <span style={{ color: "var(--cyan)" }}>
              {baseUrl}/api/webhooks/streamelements/{id}
            </span>
          </div>
        </div>

        {/* Streamlabs */}
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
            Streamlabs Token
          </div>
          {integrations.streamlabs_token && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
              Current: {integrations.streamlabs_token}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              style={styles.inputWide}
              placeholder="Paste your Streamlabs access token..."
              value={slInput}
              onChange={(e) => setSlInput(e.target.value)}
            />
            <button
              style={styles.btnPrimary}
              onClick={() => {
                if (slInput.trim()) {
                  saveIntegration("streamlabs_token", slInput.trim());
                  setSlInput("");
                }
              }}
            >
              Save
            </button>
          </div>
          <div style={{ ...styles.desc, marginTop: "0.5rem" }}>
            Webhook URL:{" "}
            <span style={{ color: "var(--cyan)" }}>
              {baseUrl}/api/webhooks/streamlabs/{id}
            </span>
          </div>
        </div>
      </div>

      {/* ── Time Rules ───────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Time Rules</div>
        <p style={styles.desc}>
          Configure how much time (in minutes) each event adds to the timer. Changes save automatically.
        </p>

        {rules && (
          <>
            {/* Subscriptions */}
            <div style={styles.inputRow}>
              <span style={styles.label}>Tier 1 Sub</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.tier1_sub_ms)}
                onChange={(e) => saveRule("tier1_sub_ms", minutesToMs(Number(e.target.value)))}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>
            <div style={styles.inputRow}>
              <span style={styles.label}>Tier 2 Sub</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.tier2_sub_ms)}
                onChange={(e) => saveRule("tier2_sub_ms", minutesToMs(Number(e.target.value)))}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>
            <div style={styles.inputRow}>
              <span style={styles.label}>Tier 3 Sub</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.tier3_sub_ms)}
                onChange={(e) => saveRule("tier3_sub_ms", minutesToMs(Number(e.target.value)))}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>
            <div style={styles.inputRow}>
              <span style={styles.label}>Gift Sub (each)</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.gifted_sub_ms)}
                onChange={(e) => saveRule("gifted_sub_ms", minutesToMs(Number(e.target.value)))}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>

            {/* Bits & Donations */}
            <div style={{ ...styles.inputRow, marginTop: "0.5rem" }}>
              <span style={styles.label}>Bits (per 100)</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.bits_per_100_ms)}
                onChange={(e) => saveRule("bits_per_100_ms", minutesToMs(Number(e.target.value)))}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>
            <div style={styles.inputRow}>
              <span style={styles.label}>Donation (per $1)</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.donation_per_dollar_ms)}
                onChange={(e) =>
                  saveRule("donation_per_dollar_ms", minutesToMs(Number(e.target.value)))
                }
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
            </div>

            {/* Follows */}
            <div
              style={{
                ...styles.inputRow,
                marginTop: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={styles.label}>Follow</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.follow_ms)}
                onChange={(e) => saveRule("follow_ms", minutesToMs(Number(e.target.value)))}
                disabled={!rules.follow_enabled}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
              <Toggle
                checked={rules.follow_enabled}
                onChange={(v) => saveRule("follow_enabled", v)}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {rules.follow_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            {/* Raids */}
            <div style={styles.inputRow}>
              <span style={styles.label}>Raid</span>
              <input
                type="number"
                min={0}
                style={styles.input}
                value={msToMinutes(rules.raid_ms)}
                onChange={(e) => saveRule("raid_ms", minutesToMs(Number(e.target.value)))}
                disabled={!rules.raid_enabled}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>min</span>
              <Toggle
                checked={rules.raid_enabled}
                onChange={(v) => saveRule("raid_enabled", v)}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {rules.raid_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Overlay Settings ─────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Overlay Settings</div>
        <p style={styles.desc}>
          Choose which events are shown on the stream overlay when they occur.
        </p>

        {(
          [
            ["subs", "Subscriptions"],
            ["bits", "Bits / Cheers"],
            ["donations", "Donations / Tips"],
            ["follows", "Follows"],
            ["raids", "Raids"],
            ["channel_points", "Channel Points"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "0.9rem" }}>{label}</span>
            <Toggle
              checked={overlaySettings.enabled_events[key]}
              onChange={(v) => saveOverlayToggle(key, v)}
            />
          </div>
        ))}
      </div>

      {/* ── Recent Events ────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Recent Events</div>
        {events.length === 0 ? (
          <p style={{ ...styles.desc, fontStyle: "italic" }}>
            No events yet. Events will appear here as they come in.
          </p>
        ) : (
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {events.map((evt, i) => (
              <div key={evt.id || i} style={styles.eventItem}>
                <div>
                  <span style={{ color: "var(--purple)", marginRight: "0.5rem" }}>
                    {friendlyEventName(evt.type, evt.detail)}
                  </span>
                  {evt.detail?.user ? (
                    <span style={{ color: "var(--text-dim)" }}>{String(evt.detail.user)}</span>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {evt.time_added_ms !== undefined && evt.time_added_ms > 0 && (
                    <span style={{ color: "var(--cyan)", fontSize: "0.8rem", fontWeight: 600 }}>
                      +{Math.floor(evt.time_added_ms / 60000)}:{String(Math.floor((evt.time_added_ms % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  )}
                  {evt.created_at && (
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Links ────────────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Links</div>
        <p style={styles.desc}>
          Use these URLs to set up your OBS browser source and share access.
        </p>

        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
            Overlay URL (for OBS Browser Source)
          </div>
          <div
            style={styles.urlBox}
            onClick={() => copyUrl(`${baseUrl}/${id}/overlay`, "overlay")}
            title="Click to copy"
          >
            {baseUrl}/{id}/overlay
            {copied === "overlay" && (
              <span style={{ marginLeft: "0.5rem", color: "var(--purple)", fontSize: "0.75rem" }}>
                Copied!
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
            Admin URL
          </div>
          <div
            style={styles.urlBox}
            onClick={() => copyUrl(`${baseUrl}/${id}/admin`, "admin")}
            title="Click to copy"
          >
            {baseUrl}/{id}/admin
            {copied === "admin" && (
              <span style={{ marginLeft: "0.5rem", color: "var(--purple)", fontSize: "0.75rem" }}>
                Copied!
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
            Simulator URL
          </div>
          <div
            style={styles.urlBox}
            onClick={() => copyUrl(`${baseUrl}/${id}/simulator`, "simulate")}
            title="Click to copy"
          >
            {baseUrl}/{id}/simulator
            {copied === "simulate" && (
              <span style={{ marginLeft: "0.5rem", color: "var(--purple)", fontSize: "0.75rem" }}>
                Copied!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
