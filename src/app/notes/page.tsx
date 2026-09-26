"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Note } from "@/lib/notes-types";
import { showToast } from "@/lib/toast";

const CONTENT_TYPE_LABEL: Record<Note["contentType"], string> = {
  revision: "Revision",
  quiz: "Quiz",
  doubt: "Doubt",
  custom: "Custom",
};

const CONTENT_TYPE_COLOR: Record<Note["contentType"], string> = {
  revision: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  quiz: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
  doubt: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
  custom: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load notes");
      setNotes(data?.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function deleteNote(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete note");
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast("Note deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete note", "error");
    } finally {
      setDeleting(null);
    }
  }

  function exportMarkdown() {
    if (notes.length === 0) {
      showToast("No notes to export", "error");
      return;
    }
    const lines: string[] = [];
    lines.push("# My Notes");
    lines.push("");
    lines.push(`_Generated on ${new Date().toLocaleDateString()}_`);
    lines.push("");

    const bySubject = groupBySubject(notes);
    for (const subject of Object.keys(bySubject).sort()) {
      lines.push(`## ${subject}`);
      lines.push("");
      const byTopic = bySubject[subject];
      for (const topic of Object.keys(byTopic).sort()) {
        lines.push(`### ${topic || "General"}`);
        lines.push("");
        for (const note of byTopic[topic]) {
          lines.push(`- **${CONTENT_TYPE_LABEL[note.contentType]}** — ${fmtDate(note.createdAt)}`);
          lines.push("");
          lines.push(`  ${note.content.replace(/\n/g, "\n  ")}`);
          lines.push("");
        }
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-notes.md";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Notes exported as Markdown");
  }

  function printNotes() {
    if (notes.length === 0) {
      showToast("No notes to print", "error");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) return;
    const body = renderMarkdownHtml();
    win.document.write(`<!DOCTYPE html><html><head><title>My Notes</title><style>
      body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}
      h1{font-size:28px}h2{font-size:22px;border-bottom:2px solid #eee;padding-bottom:4px;margin-top:36px}
      h3{font-size:17px;margin-top:24px}blockquote{border-left:3px solid #ddd;margin:8px 0;padding-left:12px;color:#333;white-space:pre-wrap}
      .meta{font-size:12px;color:#888;margin:2px 0}
      @media print{body{margin:0.5in auto}}
    </style></head><body>${body}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  function groupBySubject(all: Note[]) {
    const map: Record<string, Record<string, Note[]>> = {};
    for (const note of all) {
      const subject = note.subject || "Misc";
      const topic = note.topic || "General";
      if (!map[subject]) map[subject] = {};
      if (!map[subject][topic]) map[subject][topic] = [];
      map[subject][topic].push(note);
    }
    return map;
  }

  function renderMarkdownHtml() {
    const bySubject = groupBySubject(notes);
    return `<h1>My Notes</h1><p class="meta">Generated on ${new Date().toLocaleDateString()}</p>
      ${Object.keys(bySubject)
        .sort()
        .map(
          (subject) => `<h2>${subject}</h2>
          ${Object.keys(bySubject[subject])
            .sort()
            .map(
              (topic) => `<h3>${topic || "General"}</h3>
              ${bySubject[subject][topic]
                .map(
                  (note) =>
                    `<p class="meta">${CONTENT_TYPE_LABEL[note.contentType]} · ${fmtDate(note.createdAt)}</p><blockquote>${note.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</blockquote>`
                )
                .join("")}`
            )
            .join("")}`
        )
        .join("")}`;
  }

  const bySubject = groupBySubject(notes);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
              </svg>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Study Planner</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Home
            </Link>
            <a href="/mock-test" className="text-sm bg-zinc-900 dark:bg-zinc-800 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Mock Tests
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">My Notes</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {notes.length} saved snippet{notes.length === 1 ? "" : "s"} for offline revision
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportMarkdown}
              disabled={notes.length === 0}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Export as Markdown
            </button>
            <button
              onClick={printNotes}
              disabled={notes.length === 0}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              Print
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-zinc-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
            <button onClick={loadNotes} className="ml-3 underline">Retry</button>
          </div>
        )}

        {!loading && !error && notes.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400">No notes saved yet.</p>
            <p className="text-sm text-zinc-400 mt-1">
              Use the bookmark icon on study points, quiz questions, or doubt answers.
            </p>
          </div>
        )}

        {!loading && !error && notes.length > 0 && (
          <div className="space-y-10">
            {Object.keys(bySubject)
              .sort()
              .map((subject) => (
                <section key={subject}>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
                    {subject}
                    <span className="text-xs text-zinc-400 font-normal">
                      {Object.values(bySubject[subject]).reduce((a, arr) => a + arr.length, 0)} note(s)
                    </span>
                  </h3>
                  {Object.keys(bySubject[subject])
                    .sort()
                    .map((topic) => (
                      <div key={topic} className="mb-5">
                        <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">{topic || "General"}</h4>
                        <div className="space-y-2">
                          {bySubject[subject][topic].map((note) => (
                            <div
                              key={note.id}
                              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CONTENT_TYPE_COLOR[note.contentType]}`}>
                                    {CONTENT_TYPE_LABEL[note.contentType]}
                                  </span>
                                  {note.videoId && (
                                    <a
                                      href={`/?vid=${encodeURIComponent(note.videoId)}`}
                                      className="text-[10px] text-zinc-400 hover:text-white transition-colors"
                                    >
                                      view video
                                    </a>
                                  )}
                                  <span className="text-[10px] text-zinc-400 ml-auto">{fmtDate(note.createdAt)}</span>
                                </div>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                              </div>
                              <button
                                onClick={() => deleteNote(note.id)}
                                disabled={deleting === note.id}
                                title="Delete note"
                                className="w-7 h-7 flex items-center justify-center shrink-0 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                {deleting === note.id ? (
                                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </section>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}