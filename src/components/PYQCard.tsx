"use client";

import { useState } from "react";
import NotesButton from "@/components/NotesButton";
import { showToast } from "@/lib/toast";
import type { PYQ } from "@/lib/pyqs";

const SUBJECT_COLOR: Record<string, string> = {
  "Quantitative Aptitude": "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  Reasoning: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
  "English Comprehension": "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  "General Awareness": "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
};

export default function PYQCard({ pyq }: { pyq: PYQ }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [askingDoubt, setAskingDoubt] = useState(false);
  const [doubtAnswer, setDoubtAnswer] = useState("");
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [doubtError, setDoubtError] = useState("");
  const [doubtController, setDoubtController] = useState<AbortController | null>(null);

  const subjectColor = SUBJECT_COLOR[pyq.subject] || "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";

  function selectOption(index: number) {
    if (selected !== null) return;
    setSelected(index);
  }

  async function askDoubt() {
    if (askingDoubt || doubtLoading) return;
    setAskingDoubt(true);
    setDoubtError("");
    setDoubtAnswer("");
    const controller = new AbortController();
    setDoubtController(controller);
    setDoubtLoading(true);

    const message = `Explain this SSC CGL ${pyq.year} (${pyq.tier}) question with a shortcut:\n\n${pyq.question}\n\nOptions: ${pyq.options
      .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
      .join(" | ")}\n\n(answer: ${String.fromCharCode(65 + pyq.answerIndex)}). Give the trick/formula and step-by-step reasoning.`;

    try {
      const res = await fetch("/api/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          videoTitle: `${pyq.subject}: ${pyq.topic} (SSC CGL PYQ)`,
          subject: pyq.subject,
          topicSummary: `SSC CGL ${pyq.year} ${pyq.tier} previous year question on ${pyq.topic}.`,
          history: [],
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.type === "delta" && typeof payload.text === "string") {
              full += payload.text;
              setDoubtAnswer(full);
            } else if (payload.type === "done" && typeof payload.text === "string") {
              full = payload.text;
              setDoubtAnswer(full);
            } else if (payload.type === "error") {
              const status = typeof payload.status === "string" ? payload.status : "";
              const message = typeof payload.message === "string" ? payload.message : "Doubt solver error";
              throw new Error(status ? `Error ${status}: ${message}` : message);
            }
          } catch {
            // ignore malformed frames
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setDoubtError(err instanceof Error ? err.message : "Failed to get answer");
      if (!doubtAnswer) {
        setDoubtAnswer("AI could not answer right now. Please try again in a moment.");
      }
    } finally {
      setDoubtLoading(false);
      setDoubtController(null);
    }
  }

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${subjectColor}`}>{pyq.subject}</span>
        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">{pyq.topic}</span>
        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">SSC CGL {pyq.year}</span>
        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">{pyq.tier}</span>
        <div className="ml-auto flex items-center gap-1">
          <NotesButton
            subject={pyq.subject}
            topic={pyq.topic}
            videoId={`pyq-${pyq.id}`}
            contentType="quiz"
            content={`[${pyq.subject}] SSC CGL ${pyq.year} ${pyq.tier} — ${pyq.topic}\n\nQ. ${pyq.question}\n${pyq.options
              .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
              .join("\n")}\nCorrect Answer: ${String.fromCharCode(65 + pyq.answerIndex)}. ${pyq.options[pyq.answerIndex]}\nExplanation: ${pyq.explanation}`}
            title="Save to Notes"
          />
        </div>
      </div>

      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{pyq.question}</p>

      <div className="space-y-2">
        {pyq.options.map((opt, i) => {
          const isSelected = selected === i;
          let optClass = "border-zinc-200 dark:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-500";
          if (selected !== null && i === pyq.answerIndex) optClass = "border-green-500 bg-green-50 dark:bg-green-950";
          else if (selected !== null && isSelected) optClass = "border-red-500 bg-red-50 dark:bg-red-950";
          else if (isSelected) optClass = "border-purple-500 bg-purple-50 dark:bg-purple-950";
          return (
            <button
              key={i}
              onClick={() => selectOption(i)}
              disabled={selected !== null}
              className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${optClass} ${selected === null ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className="font-medium text-zinc-500 mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
              {selected !== null && i === pyq.answerIndex && <span className="ml-2 text-green-600">✓</span>}
              {selected !== null && isSelected && i !== pyq.answerIndex && <span className="ml-2 text-red-600">✗</span>}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          onClick={() => setShowSolution((v) => !v)}
          className="self-start flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSolution ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
          </svg>
          {showSolution ? "Hide" : "View"} Solution & Short Trick
        </button>
      )}

      {selected !== null && showSolution && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
            Correct Answer: {String.fromCharCode(65 + pyq.answerIndex)}. {pyq.options[pyq.answerIndex]}
          </p>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{pyq.explanation}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={askDoubt}
          disabled={doubtLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {doubtLoading ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Asking AI…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Ask AI Doubt
            </>
          )}
        </button>
        {askingDoubt && !doubtLoading && doubtAnswer && (
          <button onClick={() => { setAskingDoubt(false); setDoubtAnswer(""); setDoubtError(""); }} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            Close
          </button>
        )}
      </div>

      {doubtError && !doubtAnswer && (
        <div className="text-xs text-red-500 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950">{doubtError}</div>
      )}

      {doubtAnswer && (
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">AI Doubt Assistance</p>
            <div className="flex items-center gap-1">
              <NotesButton
                subject={pyq.subject}
                topic={pyq.topic}
                videoId={`pyq-${pyq.id}`}
                contentType="doubt"
                content={`[AI Doubt] SSC CGL ${pyq.year} — ${pyq.topic}\n\nQ. ${pyq.question}\n\n${doubtAnswer}`}
                title="Add to Notes"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{doubtAnswer}</p>
        </div>
      )}
    </div>
  );
}