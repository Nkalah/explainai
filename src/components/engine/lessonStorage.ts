// Lightweight localStorage helpers. Preferences (mute, speed) are global;
// notes and bookmarks are scoped per-lesson via a stable key derived from
// the lesson's title + objective, so re-generating "the same" lesson from
// the same question reconnects to prior notes/bookmarks.

export function lessonKeyFor(title: string, objective: string): string {
  const raw = `${title}::${objective}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `lesson_${Math.abs(hash)}`;
}

function safeGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota, etc) — fail silently, this is best-effort persistence.
  }
}

export const preferences = {
  getMuted(): boolean {
    return safeGet("explainai_muted") === "1";
  },
  setMuted(muted: boolean): void {
    safeSet("explainai_muted", muted ? "1" : "0");
  },
  getSpeed(): number {
    const raw = safeGet("explainai_speed");
    const n = raw ? parseFloat(raw) : 1;
    return [0.5, 0.75, 1, 1.25, 1.5, 2].includes(n) ? n : 1;
  },
  setSpeed(speed: number): void {
    safeSet("explainai_speed", String(speed));
  },
};

export const notesStore = {
  get(lessonKey: string): string {
    return safeGet(`explainai_notes_${lessonKey}`) ?? "";
  },
  set(lessonKey: string, text: string): void {
    safeSet(`explainai_notes_${lessonKey}`, text);
  },
};

export const bookmarksStore = {
  get(lessonKey: string): Set<number> {
    const raw = safeGet(`explainai_bookmarks_${lessonKey}`);
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw) as number[]);
    } catch {
      return new Set();
    }
  },
  set(lessonKey: string, ids: Set<number>): void {
    safeSet(`explainai_bookmarks_${lessonKey}`, JSON.stringify(Array.from(ids)));
  },
};
