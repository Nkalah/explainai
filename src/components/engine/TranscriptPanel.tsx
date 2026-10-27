import { useEffect, useRef } from "react";
import type { EngineLesson } from "@/lib/engineTypes";
import type { LessonPlayback } from "./useLessonPlayback";

export function TranscriptPanel({
  lesson,
  playback,
}: {
  lesson: EngineLesson;
  playback: LessonPlayback;
}) {
  const { index, goToStep } = playback;
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [index]);

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      {lesson.scenes.map((scene, i) => {
        const isCurrent = i === index;
        return (
          <button
            key={scene.id}
            ref={isCurrent ? activeRef : undefined}
            onClick={() => goToStep(i)}
            className={
              "rounded-xl px-3 py-2.5 text-left text-sm leading-relaxed transition-colors " +
              (isCurrent
                ? "bg-brand/10 text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground")
            }
          >
            <span className="mr-2 font-mono text-[10px] text-muted-foreground">{i + 1}</span>
            {scene.transcript || scene.narration}
          </button>
        );
      })}
    </div>
  );
}
