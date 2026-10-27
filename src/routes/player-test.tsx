import { createFileRoute } from "@tanstack/react-router";
import { LessonPlayer, type Lesson } from "@/components/lesson/LessonPlayer";
import parabolaLesson from "@/fixtures/parabola-lesson.json";

const lesson: Lesson = {
  ...parabolaLesson,
  scenes: parabolaLesson.scenes.map((scene): Lesson["scenes"][number] => ({
    ...scene,
    view: {
      ...scene.view,
      xRange: [scene.view.xRange[0], scene.view.xRange[1]],
      yRange: [scene.view.yRange[0], scene.view.yRange[1]],
    },
  })),
};

export const Route = createFileRoute("/player-test")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-sky-300">Player preview</div>
            <h1 className="mt-2 text-3xl font-bold">{lesson.title}</h1>
          </div>
        </div>

        <LessonPlayer lesson={lesson} />
      </div>
    </div>
  );
}
