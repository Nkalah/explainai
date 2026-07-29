import { useRef, useState } from "react";

export type AttachmentKind = "image" | "video" | "audio" | "file" | "folder" | "screenshot";

export type Attachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  previewUrl?: string;
  file: File;
};

function kindFromMime(type: string): AttachmentKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

function toAttachment(file: File, kind: AttachmentKind): Attachment {
  const previewable = kind === "image" || kind === "screenshot";
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    kind,
    size: file.size,
    previewUrl: previewable ? URL.createObjectURL(file) : undefined,
    file,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachMenuProps = {
  onAdd: (attachments: Attachment[]) => void;
};

export function AttachMenu({ onAdd }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [screenshotting, setScreenshotting] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null, forcedKind?: AttachmentKind) {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList).map((f) => toAttachment(f, forcedKind ?? kindFromMime(f.type)));
    onAdd(next);
    setOpen(false);
  }

  async function handleScreenshot() {
    setScreenshotError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setScreenshotError("Screenshot capture isn't supported in this browser.");
      return;
    }

    setScreenshotting(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];

      // ImageCapture is not yet in all TS DOM lib versions.
      const capture = new ImageCapture(track);
      const bitmap: ImageBitmap = await capture.grabFrame();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
        onAdd([toAttachment(file, "screenshot")]);
      }
    } catch (err) {
      console.error(err);
      setScreenshotError("Screenshot was cancelled or blocked.");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setScreenshotting(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Add attachment"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 left-0 z-20 w-60 overflow-hidden rounded-2xl border bg-card p-1.5 text-left shadow-[0_20px_60px_-30px_rgba(15,15,30,0.35)]">
            <MenuItem label="Photos & videos" hint="jpg, png, mp4…" icon={<ImageIcon />} onClick={() => mediaInputRef.current?.click()} />
            <MenuItem label="Audio" hint="mp3, wav, m4a…" icon={<AudioIcon />} onClick={() => audioInputRef.current?.click()} />
            <MenuItem label="Files" hint="pdf, docx, csv…" icon={<FileIcon />} onClick={() => fileInputRef.current?.click()} />
            <MenuItem label="Add a folder" hint="upload everything inside" icon={<FolderIcon />} onClick={() => folderInputRef.current?.click()} />
            <MenuItem
              label={screenshotting ? "Capturing…" : "Take screenshot"}
              hint="capture your screen"
              icon={<ScreenshotIcon />}
              onClick={handleScreenshot}
              disabled={screenshotting}
            />
          </div>
        </>
      )}

      {screenshotError && (
        <div className="absolute bottom-12 left-0 z-20 w-60 rounded-xl border bg-background px-3 py-2 text-xs text-red-500">
          {screenshotError}
        </div>
      )}

      {/* hidden native inputs — kept out of layout, triggered programmatically */}
      <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input ref={audioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, "audio")} />
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, "file")} />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error non-standard directory-upload attributes (Chrome/Edge/Firefox)
        webkitdirectory=""
        directory=""
        onChange={(e) => handleFiles(e.target.files, "folder")}
      />
    </div>
  );
}

function MenuItem({
  label,
  hint,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/* ---------- Attachment chips (render above the input) ---------- */

export function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mx-auto mb-3 flex max-w-xl flex-wrap justify-center gap-2">
      {attachments.map((a) => (
        <div key={a.id} className="group relative flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-xs">
          {a.previewUrl ? (
            <img src={a.previewUrl} alt={a.name} className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              {a.kind === "audio" ? <AudioIcon /> : a.kind === "folder" ? <FolderIcon /> : a.kind === "video" ? <ImageIcon /> : <FileIcon />}
            </span>
          )}
          <span className="max-w-[9rem] truncate text-foreground">{a.name}</span>
          <span className="text-muted-foreground">{formatBytes(a.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            aria-label={`Remove ${a.name}`}
            className="ml-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- inline icons (no external icon dependency) ---------- */

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AudioIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ScreenshotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 3H5a2 2 0 00-2 2v4M15 3h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4M15 21h4a2 2 0 002-2v-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}