import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, MessageCircle, StickyNote, X } from "lucide-react";
import type { EngineLesson } from "@/lib/engineTypes";
import { LessonEngine } from "./LessonEngine";
import { LessonControls } from "./LessonControls";
import { Timeline } from "./Timeline";
import { TranscriptPanel } from "./TranscriptPanel";
import { NotesPanel } from "./NotesPanel";
import { ExplainFurtherPanel, type ChatMessage } from "./ExplainFurtherPanel";
import { QuizPanel, type QuizQuestion } from "./QuizPanel";
import { PracticePanel, type PracticeProblem, type PracticeDifficulty } from "./PracticePanel";
import { useLessonPlayback } from "./useLessonPlayback";

type PanelTab = "explain" | "quiz" | "practice" | "transcript" | "notes" | null;

export interface LessonPlayerProps {
  lesson: EngineLesson;
  question: string;
  onSendMessage?: (message: string, history: ChatMessage[], lesson: EngineLesson) => Promise<string>;
  onGenerateQuiz?: (lesson: EngineLesson) => Promise<QuizQuestion[]>;
  onGeneratePractice?: (lesson: EngineLesson, difficulty: PracticeDifficulty) => Promise<PracticeProblem[]>;
  onDownload?: () => void;
}

export function LessonPlayer({
  lesson,
  question,
  onSendMessage,
  onGenerateQuiz,
  onGeneratePractice,
  onDownload,
}: LessonPlayerProps) {
  const playback = useLessonPlayback(lesson);
  const [panel, setPanel] = useState<PanelTab>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcuts — ignored while typing in an input/textarea (e.g.
  // Notes, or the Explain Further chat box) so "m" doesn't hijack typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (isTyping) {
        if (e.key === "Escape") target?.blur();
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          playback.togglePlay();
          break;
        case "ArrowLeft":
          playback.goPrev();
          break;
        case "ArrowRight":
          playback.goNext();
          break;
        case "m":
        case "M":
          playback.toggleMute();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement) document.exitFullscreen?.();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playback, toggleFullscreen]);

  const tabs: { id: Exclude<PanelTab, null>; label: string; icon: React.ReactNode }[] = [
    { id: "explain", label: "Explain Further", icon: <MessageCircle size={14} /> },
    { id: "transcript", label: "Transcript", icon: <FileText size={14} /> },
    { id: "notes", label: "Notes", icon: <StickyNote size={14} /> },
  ];

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col gap-3 bg-background lg:flex-row lg:gap-4"
    >
      {/* Whiteboard + controls + timeline */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="relative min-h-0 flex-1">
          <LessonEngine lesson={lesson} question={question} playback={playback} onContinue={playback.goNext} />
          <LessonControls
            playback={playback}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onDownload={onDownload}
          />
        </div>

        <Timeline lesson={lesson} playback={playback} />

        {playback.finished && !panel && (
          <button
            onClick={() => setPanel("explain")}
            className="mx-auto flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm transition-transform hover:scale-105"
          >
            <MessageCircle size={15} className="text-brand" />
            Explain Further
          </button>
        )}

        {playback.finished && (
          <div className="flex flex-wrap justify-center gap-2 pb-1">
            <button
              onClick={() => setPanel("quiz")}
              className="rounded-full border px-3.5 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Quiz Me
            </button>
            <button
              onClick={() => setPanel("practice")}
              className="rounded-full border px-3.5 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Practice Problems
            </button>
          </div>
        )}
      </div>

      {/* Side / bottom panel — desktop: docked side panel. Tablet: stacked
          below. Mobile: fullscreen collapsible sheet. */}
      {panel && (
        <div className="fixed inset-0 z-40 flex flex-col bg-card lg:static lg:z-auto lg:w-[380px] lg:flex-shrink-0 lg:rounded-2xl lg:border lg:shadow-[0_1px_0_rgba(0,0,0,0.03),0_20px_60px_-30px_rgba(15,15,30,0.25)]">
          <div className="flex flex-shrink-0 items-center gap-1 border-b p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setPanel(t.id)}
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                  (panel === t.id ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-secondary")
                }
              >
                {t.icon}
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setPanel(null)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X size={15} />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            {panel === "explain" && (
              <ExplainFurtherPanel lesson={lesson} question={question} onSendMessage={onSendMessage} />
            )}
            {panel === "quiz" && <QuizPanel lesson={lesson} onGenerateQuiz={onGenerateQuiz} />}
            {panel === "practice" && <PracticePanel lesson={lesson} onGeneratePractice={onGeneratePractice} />}
            {panel === "transcript" && <TranscriptPanel lesson={lesson} playback={playback} />}
            {panel === "notes" && <NotesPanel lessonKey={playback.lessonKey} />}
          </div>
        </div>
      )}

      {/* Persistent panel launcher, visible even before the lesson finishes */}
      {!panel && (
        <div className="hidden flex-shrink-0 flex-col gap-2 lg:flex">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setPanel(t.id)}
              title={t.label}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}