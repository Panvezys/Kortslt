import { useSyncExternalStore, useCallback } from "react";

/**
 * Admin "view-as-coach" state. When an admin enters view-as mode for a
 * specific coach, all coach-scoped GETs append `?asCoach=<id>` so the API
 * returns that coach's data instead of the admin's own. Mutations stay
 * strictly self — view-as is read-only.
 *
 * State lives in sessionStorage so it persists across navigation within the
 * tab but clears on tab close. A tiny pub/sub keeps multiple components on
 * the page in sync after `enter`/`exit`.
 */

const STORAGE_KEY = "view-as-coach";
const EVENT = "view-as-coach-change";

interface State {
  id: number;
  name: string;
}

function read(): State | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    if (typeof parsed.id !== "number" || typeof parsed.name !== "string") return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

function write(next: State | null): void {
  if (typeof window === "undefined") return;
  if (next) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  // Also listen to native storage events for cross-tab changes (rare but cheap).
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// useSyncExternalStore requires referentially stable snapshots. We memoize on
// the JSON string so consumers don't re-render unless the value actually changes.
let cachedRaw: string | null = null;
let cached: State | null = null;
function snapshot(): State | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = read();
  return cached;
}

function serverSnapshot(): State | null {
  return null;
}

export function useViewAsCoach(): {
  asCoachId: number | null;
  asCoachName: string | null;
  enter: (id: number, name: string) => void;
  exit: () => void;
} {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const enter = useCallback((id: number, name: string) => write({ id, name }), []);
  const exit = useCallback(() => write(null), []);
  return {
    asCoachId: state?.id ?? null,
    asCoachName: state?.name ?? null,
    enter,
    exit,
  };
}

/**
 * Append `?asCoach=<id>` (or `&asCoach=`) to a URL when view-as mode is active.
 * Safe to call from non-React code — reads sessionStorage directly.
 *
 * Only use this on read-only endpoints. Wiring it into a mutation URL would
 * let an admin write data as another coach, which the backend explicitly
 * refuses to do.
 */
export function withCoachViewAs(url: string): string {
  const state = read();
  if (!state) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}asCoach=${state.id}`;
}

export function getViewAsCoachId(): number | null {
  return read()?.id ?? null;
}
