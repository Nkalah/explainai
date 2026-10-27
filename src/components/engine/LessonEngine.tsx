import { memo, useMemo } from "react";
import type { EngineLesson } from "@/lib/engineTypes";
import { SceneObjectView } from "./SceneObjectView";
import type { LessonPlayback } from "./useLessonPlayback";

type LessonEngineProps = {
  lesson: EngineLesson;
  question: string;
  playback: LessonPlayback;
  onContinue: () => void;
};

function LessonEngineView({ lesson, question, playback, onContinue }: LessonEngineProps) {
  const { scene, index, sceneCount, isSpeaking, awaitingUser, finished } = playback;
  const sortedObjects = useMemo(
    () => scene?.objects.slice().sort((a, b) => (a.layer ?? 1) - (b.layer ?? 1)) ?? [],
    [scene?.objects],
  );
  if (!scene) return null;

  const cam = scene.camera;
  const hasImage = !!scene.image;
  const annotations = scene.annotations;

  return (
    <div className="relative h-full w-full">
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
            <span
              className={
                "inline-block h-1.5 w-1.5 rounded-full bg-brand " +
                (isSpeaking ? "animate-pulse" : "")
              }
            />
            {lesson.title || question}
          </div>
          <div className="ml-auto font-mono text-[11px] text-muted-foreground">
            {index + 1} / {sceneCount}
          </div>
        </div>

        <div
          className="relative h-[calc(100%-46px)] overflow-hidden"
          role="img"
          aria-label={`${scene.title}. ${scene.transcript || scene.narration}`}
          style={{
            transform: `scale(${cam.zoom}) translate(${cam.panX}%, ${cam.panY}%)`,
            transformOrigin: "center",
            transition: "transform 0.6s ease-out",
          }}
        >
          {/* Scene image layer */}
          {hasImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <SceneObjectView
                key={`img-${scene.id}`}
                obj={{
                  id: `scene-img-${scene.id}`,
                  type: "image",
                  position: { x: 50, y: 50 },
                  width: 90,
                  height: 85,
                  color: "foreground",
                  imageUrl: scene.image?.url,
                  imageSvg: undefined,
                  animation: { type: "fadeIn", start: 0, duration: 0.8 },
                }}
              />
            </div>
          )}

          {/* Whiteboard objects layer */}
          <div className={`absolute inset-0 ${hasImage ? "pointer-events-none" : ""}`}>
            {sortedObjects.map((obj) => (
              <SceneObjectView key={obj.id} obj={obj} />
            ))}
          </div>

          {/* Annotations layer */}
          {annotations && annotations.length > 0 && (
            <div className="absolute inset-0">
              {annotations.map((ann) => (
                <SceneObjectView
                  key={ann.id}
                  obj={{
                    id: ann.id,
                    type: "annotation",
                    position: ann.position,
                    targetPosition: ann.targetPosition,
                    text: ann.text,
                    color: ann.color,
                    animation: ann.animation,
                  }}
                />
              ))}
            </div>
          )}
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
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {scene.narration}
      </p>
    </div>
  );
}

export const LessonEngine = memo(
  LessonEngineView,
  (previous, next) =>
    previous.lesson === next.lesson &&
    previous.question === next.question &&
    previous.onContinue === next.onContinue &&
    previous.playback.scene === next.playback.scene &&
    previous.playback.index === next.playback.index &&
    previous.playback.sceneCount === next.playback.sceneCount &&
    previous.playback.isSpeaking === next.playback.isSpeaking &&
    previous.playback.awaitingUser === next.playback.awaitingUser &&
    previous.playback.finished === next.playback.finished,
);
