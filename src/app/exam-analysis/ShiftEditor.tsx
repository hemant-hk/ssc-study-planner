"use client";

import { useEffect, useState } from "react";
import {
  EXAM_SECTIONS,
  type BatchExtraction,
  type ExamShiftData,
  type PageBatch,
  type ShiftDifficulty,
} from "@/lib/exam-shifts-types";

// Admin-only panel for feeding the live paper in. Hidden entirely for everyone
// else, so the section stays read-only for aspirants.
export default function ShiftEditor() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [data, setData] = useState<ExamShiftData | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    question: "",
    topic: "",
    section: EXAM_SECTIONS[0] as string,
    difficulty: "medium" as ShiftDifficulty,
  });

  useEffect(() => {
    const flag = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(flag);
    // The password was captured at login time on the study page. Reuse it so an
    // admin is not asked to retype it, and so the upload does not fail with a
    // bare 403 while looking like it should just work.
    const stored = localStorage.getItem("adminToken");
    if (flag && stored) setToken(stored);
  }, []);

  // Verify the password against the admin login endpoint rather than trusting the
  // localStorage flag alone: that flag is client-side and trivially forgeable, so
  // treating it as proof of access is what let this panel look broken to a real
  // admin arriving without a prior study-page login.
  async function unlock() {
    if (!password) {
      setStatus("Enter the admin password");
      return;
    }
    setChecking(true);
    setStatus("Checking…");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setStatus(body.error || "Invalid password");
        return;
      }
      localStorage.setItem("isAdmin", "true");
      localStorage.setItem("adminToken", password);
      setToken(password);
      setPassword("");
      setIsAdmin(true);
      setStatus("Unlocked");
    } catch {
      setStatus("Login failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/exam-shifts")
      .then((r) => r.json())
      .then((body: { data?: ExamShiftData }) => {
        if (body?.data) {
          setData(body.data);
          setShiftId(body.data.shifts[0]?.id || "");
        }
      })
      .catch(() => setStatus("Could not load shifts"));
  }, [isAdmin]);

  async function save(next: ExamShiftData) {
    setSaving(true);
    setStatus("Saving…");
    try {
      const res = await fetch("/api/exam-shifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus(body.error || "Save failed");
        return;
      }
      setData(body.data);
      setStatus("Saved. Reload the page to see the updated analysis.");
    } catch {
      setStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addQuestion() {
    if (!data) return;
    const question = draft.question.trim();
    if (!question) {
      setStatus("Question text is required");
      return;
    }
    const shifts = data.shifts.map((s) => {
      if (s.id !== shiftId) return s;
      const used = new Set(s.questions.map((q) => q.id));
      let n = s.questions.length + 1;
      while (used.has(`q${n}`)) n++;
      return {
        ...s,
        questions: [
          ...s.questions,
          {
            id: `q${n}`,
            question,
            topic: draft.topic.trim() || "General",
            section: draft.section,
            difficulty: draft.difficulty,
          },
        ],
      };
    });
    setData({ ...data, shifts });
    setDraft({ ...draft, question: "", topic: "" });
    void save({ ...data, shifts });
  }

  async function uploadPdf() {
    if (!file) {
      setStatus("Choose a PDF first");
      return;
    }
    if (!token.trim()) {
      setStatus("Admin password is required to upload");
      return;
    }
    setUploading(true);
    setProgress(null);
    setStatus("Reading the paper…");
    try {
      // Ask the server how it plans to split this paper. The loop itself runs
      // here rather than on the server because one request that OCRs a whole
      // paper outlives the platform's per-request execution ceiling — that was
      // the 504. One batch per request keeps every call short and lets a single
      // failed batch be retried without redoing the rest.
      const initBody = new FormData();
      initBody.append("file", file);
      const initRes = await fetch("/api/admin/shift-pdf/init", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: initBody,
      });
      const plan = await initRes.json();
      if (!initRes.ok) {
        setStatus(plan.error || "Could not read that PDF");
        return;
      }

      const batches: BatchExtraction[] = [];
      const failed: string[] = [];

      for (const batch of plan.batches as PageBatch[]) {
        setProgress({ done: batch.index, total: plan.batchCount });
        setStatus(
          `Processing batch ${batch.index + 1} of ${plan.batchCount} (pages ${batch.pages[0]}–${batch.pages[batch.pages.length - 1]})…`
        );
        const body = new FormData();
        body.append("file", file);
        body.append("batch", String(batch.index));
        body.append("pages", batch.pages.join(","));
        body.append("isFirst", String(batch.index === 0));
        const res = await fetch("/api/admin/shift-pdf/process-chunk", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        const result = await res.json();
        if (res.ok && result.extraction) {
          batches.push(result.extraction as BatchExtraction);
        } else {
          // Keep going: the batches that did come through are still worth
          // saving, and the report below names which pages are missing.
          failed.push(`pages ${batch.pages.join(",")}: ${result.error || "failed"}`);
        }
        // Pace the batches. These are back-to-back multi-megabyte model calls,
        // and firing them with no gap is what trips the provider's per-minute
        // ceiling — which is also what this loop replaced.
        if (batch.index < plan.batchCount - 1) await new Promise((r) => setTimeout(r, 2000));
      }

      if (batches.length === 0) {
        setStatus(failed[0] || "No batch of that paper could be read");
        return;
      }

      setStatus(`Saving ${batches.length} of ${plan.batchCount} batches…`);
      const commitRes = await fetch("/api/admin/shift-pdf/commit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fallbackName: file.name.replace(/\.pdf$/i, ""), batches }),
      });
      const result = await commitRes.json();
      if (!commitRes.ok) {
        setStatus(result.error || "Could not save the shift");
        return;
      }
      if (result.data) {
        setData(result.data);
        setShiftId(result.shift?.id || "");
      }
      setFile(null);
      setProgress({ done: plan.batchCount, total: plan.batchCount });
      const count = result.shift?.questions?.length ?? 0;
      const parts = [`Read ${count} question${count === 1 ? "" : "s"} from "${result.shift?.name}"`];
      if (failed.length > 0) {
        // Some batches hit the rate limit, so the paper was only partly read.
        // Say which pages are missing rather than implying a complete paper.
        parts.push(
          `${failed.length} of ${plan.batchCount} batches hit the AI rate limit (${failed.join("; ")}) — re-upload to fill the gaps`
        );
      }
      setStatus(`${parts.join(". ")}.`);
    } catch {
      setStatus("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addShift() {
    if (!data) return;
    let n = data.shifts.length + 1;
    const used = new Set(data.shifts.map((s) => s.id));
    while (used.has(`shift-${n}`)) n++;
    const id = `shift-${n}`;
    const shifts = [...data.shifts, { id, name: `Shift ${n}`, examDate: "", questions: [] }];
    setData({ ...data, shifts });
    setShiftId(id);
  }

  // The panel is always rendered but stays inert until the admin password is
  // verified here. Returning null outright left a real admin staring at a page
  // with no upload control at all, with nothing to click and nothing explaining
  // why — the localStorage flag is only ever set by logging in on /study.
  if (!isAdmin) {
    return (
      <section className="bg-[#0a0a0c] border border-indigo-500/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Admin: Shift Ingest</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Upload a shift paper or type questions in. Admin password required.
            </p>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            Locked
          </span>
        </div>
        <div className="p-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="block text-[11px] text-zinc-400 mb-1">Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void unlock();
              }}
              placeholder="Required"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40"
            />
          </label>
          <button
            onClick={unlock}
            disabled={checking}
            className="text-sm bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
          {status && <span className="text-xs text-zinc-400">{status}</span>}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#0a0a0c] border border-indigo-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Admin: Add Shift Questions</h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Enter what aspirants report. Repeats across shifts are detected automatically.
          </p>
        </div>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
          Admin
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-zinc-100">Upload Shift PDF</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Drops the paper straight into RAM, reads it with Gemini, and appends the shift to the board.
              Nothing is written to disk. Re-uploading the same shift name replaces it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex-1 min-w-[220px]">
              <span className="block text-[11px] text-zinc-400 mb-1">
                Shift paper (PDF)
                {file && <span className="text-zinc-300"> · {file.name}</span>}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={uploading}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStatus("");
                }}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-zinc-200 file:text-xs file:font-medium hover:file:bg-zinc-700 disabled:opacity-50"
              />
            </label>
            {/* Never disabled on `!file`: a greyed-out button with no hint is
                what made this look broken. Only the in-flight state disables it,
                and clicking without a file explains what is missing. */}
            <button
              type="button"
              onClick={uploadPdf}
              disabled={uploading}
              className="text-sm bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-wait text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {uploading ? "Parsing…" : "Parse & add shift"}
            </button>
          </div>

          {/* The parse runs one request per batch from the browser, so the wait
              is now visible instead of a single opaque "Parsing…". Without this
              a 28-page paper looks identical whether it is 20% or 90% done. */}
          {uploading && progress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  Batch {Math.min(progress.done + 1, progress.total)} of {progress.total}
                </span>
                <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress.done / progress.total) * 100)}
              >
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="block text-[11px] text-zinc-400 mb-1">
              Admin password
              <span className="text-zinc-600"> (kept from login, only needed if you changed it)</span>
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Auto-filled after unlock"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40"
            />
          </label>
          <label className="min-w-[150px]">
            <span className="block text-[11px] text-zinc-400 mb-1">Shift</span>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/40"
            >
              {(data?.shifts || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={addShift}
            className="text-xs border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-3 py-2 rounded-lg transition-colors"
          >
            + Add shift
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <label>
            <span className="block text-[11px] text-zinc-400 mb-1">Section</span>
            <select
              value={draft.section}
              onChange={(e) => setDraft({ ...draft, section: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/40"
            >
              {EXAM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-[11px] text-zinc-400 mb-1">Topic</span>
            <input
              value={draft.topic}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              placeholder="e.g. Indian Polity"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40"
            />
          </label>
          <label>
            <span className="block text-[11px] text-zinc-400 mb-1">Difficulty</span>
            <select
              value={draft.difficulty}
              onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as ShiftDifficulty })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500/40"
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-[11px] text-zinc-400 mb-1">Question</span>
          <textarea
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            rows={3}
            placeholder="Paste the question as reported…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 resize-y"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={addQuestion}
            disabled={saving}
            className="text-sm bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Add question"}
          </button>
          {status && <span className="text-xs text-zinc-400">{status}</span>}
        </div>
      </div>
    </section>
  );
}
