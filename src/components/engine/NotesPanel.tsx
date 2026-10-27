import { useEffect, useRef, useState } from "react";
import { notesStore } from "./lessonStorage";

export function NotesPanel({ lessonKey }: { lessonKey: string }) {
  const [text, setText] = useState(() => notesStore.get(lessonKey));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(notesStore.get(lessonKey));
  }, [lessonKey]);

  function handleChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      notesStore.set(lessonKey, value);
      setSavedAt(Date.now());
    }, 500);
  }

  return (
    <div className="flex h-full flex-col p-3">
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down anything worth remembering — your notes save automatically."
        className="h-full w-full flex-1 resize-none rounded-xl border bg-background/60 p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/50"
      />
      <div className="pt-2 text-right text-[10px] text-muted-foreground">
        {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "\u00A0"}
      </div>
    </div>
  );
}
