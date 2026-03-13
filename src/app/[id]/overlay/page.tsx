"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TimerState {
  remaining_ms: number;
  is_paused: boolean;
  max_cap_ms: number;
  ended: boolean;
}

interface StoredEvent {
  id: string;
  event_id: string;
  source: string;
  type: string;
  detail: Record<string, unknown>;
  time_added_ms: number;
  created_at: string;
}

interface DisplayEvent {
  id: string;
  text: string;
  timeAdded: string;
  createdAt: number;
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

const EVENT_TYPE_TO_SETTING: Record<string, keyof OverlaySettings["enabled_events"]> = {
  sub_tier1: "subs",
  sub_tier2: "subs",
  sub_tier3: "subs",
  gifted_sub: "subs",
  bits: "bits",
  donation: "donations",
  follow: "follows",
  raid: "raids",
  custom_reward: "channel_points",
};

function formatTime(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimeAdded(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `+${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildEventText(event: StoredEvent): string {
  const detail = event.detail;
  const user = (detail.user_name || detail.user || detail.username || "Someone") as string;
  const time = formatTimeAdded(event.time_added_ms);

  switch (event.type) {
    case "sub_tier1":
      return `\u2B50 ${user} subscribed (Tier 1)! ${time}`;
    case "sub_tier2":
      return `\u2B50 ${user} subscribed (Tier 2)! ${time}`;
    case "sub_tier3":
      return `\u2B50 ${user} subscribed (Tier 3)! ${time}`;
    case "gifted_sub": {
      const count = (detail.count || detail.total || 1) as number;
      return `\uD83C\uDF81 ${user} gifted ${count} sub(s)! ${time}`;
    }
    case "bits": {
      const bits = (detail.bits || detail.amount || 0) as number;
      return `\uD83D\uDC8E ${user} cheered ${bits} bits! ${time}`;
    }
    case "donation": {
      const amount = (detail.amount || 0) as number;
      return `\uD83D\uDCB0 ${user} donated $${amount}! ${time}`;
    }
    case "follow":
      return `\u2764\uFE0F ${user} followed! ${time}`;
    case "raid": {
      const viewers = (detail.viewers || detail.viewer_count || 0) as number;
      return `\uD83D\uDE80 ${user} raided with ${viewers} viewers! ${time}`;
    }
    case "custom_reward": {
      const title = (detail.reward_title || detail.title || "a reward") as string;
      return `\uD83C\uDFC6 ${user} redeemed ${title}! ${time}`;
    }
    default:
      return `${user} triggered ${event.type}! ${time}`;
  }
}

export default function OverlayPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [displayTime, setDisplayTime] = useState("00:00:00");
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [pulse, setPulse] = useState(false);

  const endTimeRef = useRef<number>(0);
  const isPausedRef = useRef(true);
  const remainingMsRef = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const overlaySettingsRef = useRef<OverlaySettings>({
    enabled_events: {
      subs: true,
      bits: true,
      donations: true,
      follows: false,
      raids: true,
      channel_points: true,
    },
  });

  // Set transparent background
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      document.documentElement.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  // Poll timer state every 1.5s with drift-tolerant sync
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/${id}/timer`);
        if (!res.ok) return;
        const state: TimerState = await res.json();

        isPausedRef.current = state.is_paused;

        if (state.is_paused || state.ended) {
          remainingMsRef.current = state.remaining_ms;
          endTimeRef.current = 0;
          setDisplayTime(formatTime(state.remaining_ms));
        } else {
          const serverEnd = Date.now() + state.remaining_ms;
          const drift = Math.abs((endTimeRef.current || 0) - serverEnd);

          if (drift > 2000 || endTimeRef.current === 0) {
            endTimeRef.current = serverEnd;
          }
        }
      } catch {
        // silently ignore fetch errors
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  // Poll events every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/${id}/events`);
        if (!res.ok) return;
        const allEvents: StoredEvent[] = await res.json();
        if (allEvents.length === 0) return;

        const settings = overlaySettingsRef.current;
        const latestId = allEvents[0]?.id;

        if (lastEventIdRef.current === null) {
          lastEventIdRef.current = latestId;
          return;
        }

        if (latestId === lastEventIdRef.current) return;

        // Find new events (everything before the last seen id)
        const newEvents: StoredEvent[] = [];
        for (const evt of allEvents) {
          if (evt.id === lastEventIdRef.current) break;
          newEvents.push(evt);
        }

        lastEventIdRef.current = latestId;

        // Filter by overlay settings and convert to display events
        const displayEvents: DisplayEvent[] = newEvents
          .filter((evt) => {
            const settingKey = EVENT_TYPE_TO_SETTING[evt.type];
            if (!settingKey) return true;
            return settings.enabled_events[settingKey];
          })
          .map((evt) => ({
            id: evt.id,
            text: buildEventText(evt),
            timeAdded: formatTimeAdded(evt.time_added_ms),
            createdAt: Date.now(),
          }))
          .reverse(); // oldest first so they appear in order

        if (displayEvents.length > 0) {
          setPulse(true);
          setTimeout(() => setPulse(false), 600);

          setEvents((prev) => [...prev, ...displayEvents]);
        }
      } catch {
        // silently ignore
      }
    };

    const interval = setInterval(poll, 2000);
    poll();
    return () => clearInterval(interval);
  }, [id]);

  // Poll overlay settings every 10s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/${id}/settings?type=overlay`);
        if (!res.ok) return;
        const settings: OverlaySettings = await res.json();
        overlaySettingsRef.current = settings;
      } catch {
        // silently ignore
      }
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Auto-dismiss events after 5 seconds
  useEffect(() => {
    if (events.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setEvents((prev) => prev.filter((e) => now - e.createdAt < 5000));
    }, 500);
    return () => clearInterval(timer);
  }, [events.length]);

  // requestAnimationFrame countdown loop
  const animationLoop = useCallback(() => {
    if (!isPausedRef.current && endTimeRef.current > 0) {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setDisplayTime(formatTime(remaining));
    }
  }, []);

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdate >= 100) {
        animationLoop();
        lastUpdate = timestamp;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animationLoop]);

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }

        @keyframes pulseGlow {
          0% {
            text-shadow:
              0 0 10px rgba(0, 255, 255, 0.8),
              0 0 20px rgba(0, 255, 255, 0.6),
              0 0 40px rgba(0, 255, 255, 0.4),
              0 0 80px rgba(0, 255, 255, 0.3);
          }
          50% {
            text-shadow:
              0 0 20px rgba(0, 255, 255, 1),
              0 0 40px rgba(0, 255, 255, 0.8),
              0 0 60px rgba(0, 255, 255, 0.6),
              0 0 100px rgba(0, 255, 255, 0.4);
          }
          100% {
            text-shadow:
              0 0 10px rgba(0, 255, 255, 0.8),
              0 0 20px rgba(0, 255, 255, 0.6),
              0 0 40px rgba(0, 255, 255, 0.4),
              0 0 80px rgba(0, 255, 255, 0.3);
          }
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          background: transparent !important;
          overflow: hidden;
        }

        .overlay-container {
          position: fixed;
          inset: 0;
          background: transparent;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-family: 'Courier New', Courier, monospace;
        }

        .timer-display {
          font-size: 4rem;
          font-weight: bold;
          color: #ffffff;
          text-shadow:
            0 0 10px rgba(0, 255, 255, 0.8),
            0 0 20px rgba(0, 255, 255, 0.6),
            0 0 40px rgba(0, 255, 255, 0.4),
            0 0 80px rgba(0, 255, 255, 0.3);
          letter-spacing: 0.1em;
          user-select: none;
        }

        .timer-display.pulse {
          animation: pulseGlow 0.6s ease-in-out;
        }

        .event-feed {
          position: fixed;
          bottom: 40px;
          left: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 600px;
          pointer-events: none;
        }

        .event-item {
          background: rgba(0, 0, 0, 0.7);
          border-left: 3px solid rgba(0, 255, 255, 0.8);
          padding: 10px 16px;
          border-radius: 0 8px 8px 0;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 1.1rem;
          animation: slideIn 0.4s ease-out forwards;
          white-space: nowrap;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        .event-item.dismissing {
          animation: slideOut 0.4s ease-in forwards;
        }
      `}</style>

      <div className="overlay-container">
        <div className={`timer-display${pulse ? " pulse" : ""}`}>
          {displayTime}
        </div>
      </div>

      <div className="event-feed">
        {events.map((event) => (
          <div
            key={event.id}
            className={`event-item${Date.now() - event.createdAt > 4600 ? " dismissing" : ""}`}
          >
            {event.text}
          </div>
        ))}
      </div>
    </>
  );
}
