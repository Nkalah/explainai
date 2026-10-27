import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineLesson, Scene } from "@/lib/engineTypes";
import { bookmarksStore, lessonKeyFor, preferences } from "./lessonStorage";

export const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface LessonPlayback {
  scene: Scene | undefined;
  index: number;
  sceneCount: number;
  isPlaying: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  speed: PlaybackSpeed;
  awaitingUser: boolean;
  finished: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  bookmarks: Set<number>;
  lessonKey: string;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (index: number) => void;
  restart: () => void;
  toggleMute: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  toggleBookmark: (index?: number) => void;
}

/**
 * Owns the exact playback state machine that used to live inside
 * LessonEngine.tsx (scene index, TTS narration, auto-advance timing,
 * waitForUser gating) — unmodified in behavior — plus the additions needed
 * for external controls: play/pause, speed, mute, manual step navigation,
 * and per-lesson bookmarks. LessonEngine becomes a pure renderer of
 * whatever this hook currently says is true.
 */
export function useLessonPlayback(lesson: EngineLesson): LessonPlayback {
  const scenes = lesson.scenes;
  const lessonKey = lessonKeyFor(lesson.title, lesson.objective);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(() => preferences.getMuted());
  const [speed, setSpeedState] = useState<PlaybackSpeed>(() => preferences.getSpeed() as PlaybackSpeed);
  const [awaitingUser, setAwaitingUser] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bookmarks, setBookmarksState] = useState<Set<number>>(() => bookmarksStore.get(lessonKey));
  // Bumped on every restart() so the narration effect re-runs even when
  // restarting from scene 0 (where `index` wouldn't otherwise change).
  const [restartTick, setRestartTick] = useState(0);

  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene: Scene | undefined = scenes[index];

  // Reset to the start whenever a genuinely new lesson comes in.
  useEffect(() => {
    setIndex(0);
    setFinished(false);
    setBookmarksState(bookmarksStore.get(lessonKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    fallbackTimerRef.current = null;
    advanceTimerRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const goNext = useCallback(() => {
    setAwaitingUser(false);
    setIndex((n) => {
      if (n < scenes.length - 1) return n + 1;
      setFinished(true);
      return n;
    });
  }, [scenes.length]);

  const goPrev = useCallback(() => {
    setAwaitingUser(false);
    setFinished(false);
    setIndex((n) => Math.max(0, n - 1));
  }, []);

  const goToStep = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(scenes.length - 1, target));
      setAwaitingUser(false);
      setFinished(false);
      setIndex(clamped);
    },
    [scenes.length]
  );

  const restart = useCallback(() => {
    clearTimers();
    setAwaitingUser(false);
    setFinished(false);
    setIndex(0);
    setIsPlaying(true);
    setRestartTick((t) => t + 1);
  }, [clearTimers]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      preferences.setMuted(next);
      return next;
    });
  }, []);

  const setSpeed = useCallback((next: PlaybackSpeed) => {
    setSpeedState(next);
    preferences.setSpeed(next);
  }, []);

  const toggleBookmark = useCallback(
    (target?: number) => {
      const id = target ?? index;
      setBookmarksState((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        bookmarksStore.set(lessonKey, next);
        return next;
      });
    },
    [index, lessonKey]
  );

  // The actual narration/advance effect — same shape as the original
  // LessonEngine effect, gated additionally by isPlaying and isMuted.
  useEffect(() => {
    if (!scene) return;
    setAwaitingUser(false);
    clearTimers();

    if (!isPlaying) return; // paused: hold on the current scene, do nothing

    const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

    if (hasSpeech && !isMuted) {
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.rate = speed;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (scene.waitForUser) setAwaitingUser(true);
        else advanceTimerRef.current = setTimeout(goNext, 400 / speed);
      };
      utterance.onerror = () => {
        // TTS failed mid-utterance (voice unavailable, browser quirk) —
        // fall back to timed advance rather than stalling the lesson.
        setIsSpeaking(false);
        fallbackTimerRef.current = setTimeout(() => {
          if (scene.waitForUser) setAwaitingUser(true);
          else goNext();
        }, (scene.duration * 1000) / speed);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Muted, or no speechSynthesis available: advance on a timer instead,
      // still respecting speed and waitForUser.
      fallbackTimerRef.current = setTimeout(() => {
        if (scene.waitForUser) setAwaitingUser(true);
        else goNext();
      }, (scene.duration * 1000) / speed);
    }

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lesson, isPlaying, isMuted, speed, restartTick]);

  return {
    scene,
    index,
    sceneCount: scenes.length,
    isPlaying,
    isSpeaking,
    isMuted,
    speed,
    awaitingUser,
    finished,
    canGoPrev: index > 0,
    canGoNext: index < scenes.length - 1,
    bookmarks,
    lessonKey,
    play,
    pause,
    togglePlay,
    goNext,
    goPrev,
    goToStep,
    restart,
    toggleMute,
    setSpeed,
    toggleBookmark,
  };
}