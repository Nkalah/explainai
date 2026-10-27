import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Download,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PLAYBACK_SPEEDS, type LessonPlayback, type PlaybackSpeed } from "./useLessonPlayback";

export function LessonControls({
  playback,
  isFullscreen,
  onToggleFullscreen,
  onDownload,
}: {
  playback: LessonPlayback;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onDownload?: () => void;
}) {
  const {
    isPlaying,
    isMuted,
    speed,
    canGoPrev,
    canGoNext,
    bookmarks,
    index,
    togglePlay,
    goPrev,
    goNext,
    restart,
    toggleMute,
    setSpeed,
    toggleBookmark,
  } = playback;

  const [visible, setVisible] = useState(true);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide while playing and idle; always show while paused or hovered.
  useEffect(() => {
    function resetIdle() {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (isPlaying) {
        hideTimer.current = setTimeout(() => setVisible(false), 2500);
      }
    }
    resetIdle();
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    return () => {
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isPlaying]);

  const isBookmarked = bookmarks.has(index);

  return (
    <div
      className={
        "pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-all duration-300 " +
        (visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")
      }
      onMouseEnter={() => setVisible(true)}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-card/80 px-2 py-1.5 shadow-[0_8px_30px_-8px_rgba(15,15,30,0.35)] backdrop-blur-xl">
        <ControlButton label="Restart lesson" onClick={restart}>
          <RotateCcw size={16} />
        </ControlButton>

        <ControlButton label="Previous step" onClick={goPrev} disabled={!canGoPrev}>
          <SkipBack size={16} />
        </ControlButton>

        <ControlButton
          label={isPlaying ? "Pause" : "Play"}
          onClick={togglePlay}
          primary
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </ControlButton>

        <ControlButton label="Next step" onClick={goNext} disabled={!canGoNext}>
          <SkipForward size={16} />
        </ControlButton>

        <ControlButton label={isMuted ? "Unmute (M)" : "Mute (M)"} onClick={toggleMute}>
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </ControlButton>

        <div className="relative">
          <ControlButton
            label="Playback speed"
            onClick={() => setSpeedMenuOpen((o) => !o)}
            textLabel={`${speed}x`}
          />
          {speedMenuOpen && (
            <div
              className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xl border bg-card p-1 shadow-lg"
              onMouseLeave={() => setSpeedMenuOpen(false)}
            >
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s as PlaybackSpeed);
                    setSpeedMenuOpen(false);
                  }}
                  className={
                    "block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors " +
                    (s === speed ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-secondary")
                  }
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        <ControlButton
          label={isBookmarked ? "Remove bookmark" : "Bookmark this step"}
          onClick={() => toggleBookmark()}
        >
          {isBookmarked ? <BookmarkCheck size={16} className="text-brand" /> : <Bookmark size={16} />}
        </ControlButton>

        <ControlButton label={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"} onClick={onToggleFullscreen}>
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </ControlButton>

        <ControlButton label="Download lesson (coming soon)" onClick={onDownload} disabled={!onDownload}>
          <Download size={16} />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  disabled,
  primary,
  textLabel,
}: {
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  primary?: boolean;
  textLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        "flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30 " +
        (primary
          ? "bg-foreground text-background hover:scale-105"
          : "text-foreground hover:bg-secondary")
      }
    >
      {children}
      {textLabel}
    </button>
  );
}