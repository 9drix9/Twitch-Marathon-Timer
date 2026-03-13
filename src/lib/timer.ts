import { redis, keys } from "./db";

export interface TimerState {
  remaining_ms: number;
  is_paused: boolean;
  max_cap_ms: number;
  ended: boolean;
}

interface StoredTimer {
  end_time: number;
  remaining_ms: number;
  is_paused: boolean;
  max_cap_ms: number;
}

const DEFAULT_TIMER: StoredTimer = {
  end_time: 0,
  remaining_ms: 86400000, // 24 hours
  is_paused: true,
  max_cap_ms: 172800000, // 48 hours
};

async function getStored(id: string): Promise<StoredTimer> {
  const k = keys(id);
  const data = await redis().get<StoredTimer>(k.timerState);
  if (!data) {
    const startMs =
      parseInt(process.env.TIMER_START_SECONDS || "86400", 10) * 1000;
    const initial = { ...DEFAULT_TIMER, remaining_ms: startMs };
    await redis().set(k.timerState, initial);
    return initial;
  }
  return data;
}

async function save(id: string, s: StoredTimer): Promise<void> {
  await redis().set(keys(id).timerState, s);
}

function toState(s: StoredTimer): TimerState {
  let remaining: number;
  if (s.is_paused) {
    remaining = s.remaining_ms;
  } else {
    remaining = Math.max(0, s.end_time - Date.now());
  }
  return {
    remaining_ms: remaining,
    is_paused: s.is_paused,
    max_cap_ms: s.max_cap_ms,
    ended: remaining <= 0 && !s.is_paused,
  };
}

export async function getTimerState(id: string): Promise<TimerState> {
  return toState(await getStored(id));
}

export async function pauseTimer(id: string): Promise<TimerState> {
  const r = await getStored(id);
  if (r.is_paused) return toState(r);
  const remaining = Math.max(0, r.end_time - Date.now());
  r.is_paused = true;
  r.remaining_ms = remaining;
  await save(id, r);
  return toState(r);
}

export async function resumeTimer(id: string): Promise<TimerState> {
  const r = await getStored(id);
  if (!r.is_paused) return toState(r);
  if (r.remaining_ms <= 0) return toState(r);
  r.is_paused = false;
  r.end_time = Date.now() + r.remaining_ms;
  await save(id, r);
  return toState(r);
}

export async function addTime(id: string, ms: number): Promise<TimerState> {
  const r = await getStored(id);
  if (r.is_paused) {
    r.remaining_ms = Math.min(r.remaining_ms + ms, r.max_cap_ms);
  } else {
    const currentRemaining = Math.max(0, r.end_time - Date.now());
    const newRemaining = Math.min(currentRemaining + ms, r.max_cap_ms);
    r.end_time = Date.now() + newRemaining;
  }
  await save(id, r);
  return toState(r);
}

export async function subtractTime(id: string, ms: number): Promise<TimerState> {
  const r = await getStored(id);
  if (r.is_paused) {
    r.remaining_ms = Math.max(0, r.remaining_ms - ms);
  } else {
    const currentRemaining = Math.max(0, r.end_time - Date.now());
    const newRemaining = Math.max(0, currentRemaining - ms);
    r.end_time = Date.now() + newRemaining;
  }
  await save(id, r);
  return toState(r);
}

export async function resetTimer(id: string, ms: number): Promise<TimerState> {
  const r = await getStored(id);
  r.is_paused = true;
  r.remaining_ms = ms;
  r.end_time = 0;
  await save(id, r);
  return toState(r);
}

export async function setMaxCap(id: string, ms: number): Promise<void> {
  const r = await getStored(id);
  r.max_cap_ms = ms;
  await save(id, r);
}

// ── Event processing ──────────────────────────────────

export interface TimerEvent {
  event_id: string;
  source: string;
  type: string;
  detail: Record<string, unknown>;
  time_added_ms: number;
}

export interface StoredEvent {
  id: string;
  event_id: string;
  source: string;
  type: string;
  detail: Record<string, unknown>;
  time_added_ms: number;
  created_at: string;
}

export async function processEvent(id: string, evt: TimerEvent): Promise<boolean> {
  const r = redis();
  const k = keys(id);

  // Dedup: try to add to seen set
  const added = await r.sadd(k.eventsSeen, evt.event_id);
  if (added === 0) return false;

  const stored: StoredEvent = {
    id: evt.event_id,
    event_id: evt.event_id,
    source: evt.source,
    type: evt.type,
    detail: evt.detail,
    time_added_ms: evt.time_added_ms,
    created_at: new Date().toISOString(),
  };

  await r.lpush(k.events, JSON.stringify(stored));
  await r.ltrim(k.events, 0, 99);

  if (evt.time_added_ms > 0) {
    await addTime(id, evt.time_added_ms);
  }

  return true;
}

export async function getRecentEvents(id: string, limit = 20): Promise<StoredEvent[]> {
  const raw = await redis().lrange(keys(id).events, 0, limit - 1);
  return raw.map((item) => {
    if (typeof item === "string") return JSON.parse(item);
    return item as unknown as StoredEvent;
  });
}
