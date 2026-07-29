import { useEffect, useRef, useState } from "react";
import type { EngineLesson, Scene } from "@/lib/engineTypes";
import { SceneObjectView } from "./SceneObjectView";

export function LessonEngine({ lesson, question }: { lesson: EngineLesson; question: string }) {
  const scenes = lesson.scenes;
  const [index, setIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [awaitingUser, setAwaitingUser] = useState(false);
  const [finished, setFinished] = useState(false);

  const scene: Scene | undefined = scenes[index];

  useEffect(() => {
    setIndex(0);
    setFinished(false);
  }, [lesson]);

  function goNext() {
    if (index < scenes.length - 1) setIndex((n) => n + 1);
    else setFinished(true);
  }

  useEffect(() => {
    if (!scene) return;
    setAwaitingUser(false);

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (scene.waitForUser) setAwaitingUser(true);
        else setTimeout(goNext, 400);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      fallbackTimer = setTimeout(() => {
        if (scene.waitForUser) setAwaitingUser(true);
        else goNext();
      }, scene.duration * 1000);
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lesson]);

  function replay() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIndex(0);
    setFinished(false);
  }

  if (!scene) return null;

  const cam = scene.camera;

  return (
    <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.03),0_20px_60px_-30px_rgba(15,15,30,0.25)]">
      <style>{`
        @keyframes eng-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes eng-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes eng-highlight { 0% { background: transparent; } 30% { background: oklch(0.9 0.08 90 / 0.6); } 100% { background: oklch(0.9 0.08 90 / 0.25); } }
        @keyframes eng-zoom { from { transform: translate(-50%,-50%) scale(0.6); opacity: 0; } to { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
        @keyframes eng-pulse { 0%, 100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.08); } }
        @keyframes eng-rotate { from { opacity: 0; transform: translate(-50%,-50%) rotate(-15deg); } to { opacity: 1; transform: translate(-50%,-50%) rotate(0deg); } }
        @keyframes eng-slide-left { from { opacity: 0; transform: translate(calc(-50% - 24px), -50%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes eng-slide-right { from { opacity: 0; transform: translate(calc(-50% + 24px), -50%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes eng-slide-up { from { opacity: 0; transform: translate(-50%, calc(-50% + 24px)); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes eng-slide-down { from { opacity: 0; transform: translate(-50%, calc(-50% - 24px)); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes eng-bar-grow { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
      `}</style>

      <div className="absolute inset-0 hairline-grid opacity-40" aria-hidden />

      <div className="relative flex items-center gap-2 border-b px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <span className="h-2.5 w-2.5 rounded-full bg-hairline" />
        <div className="ml-3 flex items-center gap-2 truncate text-[11px] font-mono text-muted-foreground">
          <span className={"inline-block h-1.5 w-1.5 rounded-full bg-brand " + (isSpeaking ? "animate-pulse" : "")} />
          {lesson.title || question}
        </div>
        <div className="ml-auto font-mono text-[11px] text-muted-foreground">{index + 1} / {scenes.length}</div>
      </div>

      <div
        className="relative h-[calc(100%-46px-40px)] overflow-hidden"
        style={{
          transform: `scale(${cam.zoom}) translate(${cam.panX}%, ${cam.panY}%)`,
          transformOrigin: "center",
          transition: "transform 0.6s ease-out",
        }}
      >
        {scene.objects
          .slice()
          .sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1))
          .map((obj) => (
            <SceneObjectView key={obj.id} obj={obj} />
          ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-center gap-1.5">
        {scenes.map((_, i) => (
          <span key={i} className={"h-1.5 w-1.5 rounded-full transition-colors " + (i === index ? "bg-brand" : i < index ? "bg-brand/40" : "bg-hairline")} />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between border-t bg-background/80 px-4 py-2 backdrop-blur">
        <div className="truncate text-xs text-muted-foreground">
          <span className="text-foreground">Narration:</span> {scene.narration}
        </div>
        {awaitingUser && !finished && (
          <button onClick={goNext} className="pointer-events-auto ml-3 flex-shrink-0 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90">
            Continue
          </button>
        )}
        {finished && (
          <button onClick={replay} className="pointer-events-auto ml-3 flex-shrink-0 rounded-full border bg-background px-3 py-1 text-[11px] font-medium hover:bg-secondary">
            Replay
          </button>
        )}
      </div>
    </div>
  );
}