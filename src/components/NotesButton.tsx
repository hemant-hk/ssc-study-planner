"use client";

import { useState, useRef } from "react";
import type { Note, NoteContentType } from "@/lib/notes-types";
import { showToast } from "@/lib/toast";

interface NotesButtonProps {
  subject: string;
  topic: string;
  videoId: string;
  contentType: NoteContentType;
  content: string;
  title?: string;
  className?: string;
  size?: "sm" | "md";
}

export default function NotesButton({
  subject,
  topic,
  videoId,
  contentType,
  content,
  title = "Save to Notes",
  className = "",
  size = "sm",
}: NotesButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);

  async function handleSave() {
    if (saving || savedRef.current) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topic,
          videoId,
          contentType,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save note");
      savedRef.current = true;
      setSaved(true);
      showToast("Saved to Notes");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save note", "error");
    } finally {
      setSaving(false);
    }
  }

  const sizeClass = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  return (
    <button
      onClick={handleSave}
      title={saved ? "Saved to Notes" : title}
      disabled={saving || saved}
      className={`inline-flex items-center justify-center rounded-md transition-colors ${
        sizeClass
      } ${
        saved
          ? "text-amber-500 cursor-default"
          : "text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
      } disabled:opacity-80 ${className}`}
    >
      {saving ? (
        <svg className={size === "sm" ? "w-3.5 h-3.5 animate-spin" : "w-4 h-4"} viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg
          className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"}
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      )}
    </button>
  );
}