import type { EngineLesson } from "@/lib/engineTypes";
import { SceneObjectView } from "./SceneObjectView";
import type { LessonPlayback } from "./useLessonPlayback";

/**
 * Pure whiteboard renderer. All state (which scene is active, whether
 * narration is playing, timing) now lives in useLessonPlayback and is
 * passed in as `playback` — this component just draws whatever that state
 * currently says is true. Narration, animation timing, and camera logic
 * are unchanged from the original LessonEngine; only their ownership moved.
 */
export function LessonEngine({
  lesson,
  question,
  playback,
  onContinue,
}: {
  lesson: EngineLesson;
  question: string;
  playback: LessonPlayback;
  onContinue: () => void;
}) {
  const { scene, index, sceneCount, isSpeaking, awaitingUser, finished } = playback;

  if (!scene) return null;

  const cam = scene.camera;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.03),0_20px_60px_-30px_rgba(15,15,30,0.25)]">
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
        <div className="ml-auto font-mono text-[11px] text-muted-foreground">
          {index + 1} / {sceneCount}
        </div>
      </div>

      <div
        className="relative h-[calc(100%-46px)] overflow-hidden"
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

      {awaitingUser && !finished && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <button
            onClick={onContinue}
            className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background shadow-lg transition-transform hover:scale-105 hover:opacity-90"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}