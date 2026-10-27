import { Bookmark } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";
import type { LessonPlayback } from "./useLessonPlayback";

export function Timeline({ lesson, playback }: { lesson: EngineLesson; playback: LessonPlayback }) {
  const { index, bookmarks, goToStep } = playback;

  return (
    <div className="flex w-full items-center gap-0 overflow-x-auto px-1 py-2">
      {lesson.scenes.map((scene, i) => {
        const status = i < index ? "done" : i === index ? "current" : "upcoming";
        const isLast = i === lesson.scenes.length - 1;

        return (
          <div key={scene.id} className="flex flex-shrink-0 items-center">
            <button
              onClick={() => goToStep(i)}
              title={scene.title}
              className="group flex flex-col items-center gap-1.5 px-1.5"
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
                className={"h-px w-6 flex-shrink-0 sm:w-10 " + (i < index ? "bg-brand/40" : "bg-hairline")}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}