import { useMemo } from "react";
import { Bookmark } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";
import type { LessonPlayback } from "./useLessonPlayback";
import { formatTime } from "./useLessonPlayback";

export function Timeline({ lesson, playback }: { lesson: EngineLesson; playback: LessonPlayback }) {
  const { index, bookmarks, goToStep, elapsedTime, totalElapsedTime } = playback;
  const { totalDuration, sceneStarts } = useMemo(() => {
    let total = 0;
    const starts = lesson.scenes.map((scene) => {
      const start = total;
      total += scene.duration;
      return start;
    });
    return { totalDuration: total, sceneStarts: starts };
  }, [lesson.scenes]);
  const currentTime = totalElapsedTime + elapsedTime;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex w-full flex-col gap-1.5 px-1 py-2">
      <div
        className="relative h-1.5 w-full rounded-full bg-hairline"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(progress, 100)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(totalDuration)}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div
          className="absolute inset-y-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-sm transition-all duration-300"
          style={{ left: `${Math.min(progress, 100)}%`, top: "50%" }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0 overflow-x-auto">
          {lesson.scenes.map((scene, i) => {
            const status = i < index ? "done" : i === index ? "current" : "upcoming";
            const isLast = i === lesson.scenes.length - 1;
            const sceneStart = sceneStarts[i];

            return (
              <div key={scene.id} className="flex flex-shrink-0 items-center">
                <button
                  onClick={() => goToStep(i)}
                  title={`${scene.title} (${formatTime(sceneStart)})`}
                  aria-label={`Go to ${scene.title}, ${formatTime(sceneStart)}`}
                  aria-current={i === index ? "step" : undefined}
                  className="group flex flex-col items-center gap-1 px-1.5"
                >
                  <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                    <span
                      className={
                        "block h-2.5 w-2.5 rounded-full border-2 transition-all group-hover:scale-125 " +
                        (status === "current"
                          ? "border-brand bg-brand scale-125"
                          : status === "done"
                            ? "border-brand bg-brand/40"
                            : "border-hairline bg-transparent")
                      }
                    />
                    {bookmarks.has(i) && (
                      <Bookmark size={9} className="absolute -top-2.5 fill-brand text-brand" />
                    )}
                  </span>
                  <span
                    className={
                      "max-w-[72px] truncate text-[10px] font-medium transition-colors " +
                      (status === "current" ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {scene.title}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className={
                      "h-px w-6 flex-shrink-0 sm:w-10 " +
                      (i < index ? "bg-brand/40" : "bg-hairline")
                    }
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
        <span className="flex-shrink-0 font-mono text-[11px] text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
