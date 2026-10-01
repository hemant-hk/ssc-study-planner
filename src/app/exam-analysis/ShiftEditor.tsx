"use client";

import { useEffect, useState } from "react";
import { EXAM_SECTIONS, type ExamShiftData, type ShiftDifficulty } from "@/lib/exam-shifts-store";

// Admin-only panel for feeding the live paper in. Hidden entirely for everyone
// else, so the section stays read-only for aspirants.
export default function ShiftEditor() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState("");
  const [data, setData] = useState<ExamShiftData | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    question: "",
    topic: "",
    section: EXAM_SECTIONS[0] as string,
    difficulty: "medium" as ShiftDifficulty,
  });

  useEffect(() => {
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
  }, []);

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

  if (!isAdmin) return null;

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
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="block text-[11px] text-zinc-400 mb-1">Admin password</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Required to save"
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
