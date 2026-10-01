import AppHeader from "@/components/AppHeader";
import { loadExamShifts, EXAM_SECTIONS } from "@/lib/exam-shifts-store";
import { analyze } from "@/lib/exam-analysis";
import { findCoreConcepts, findPredictionGaps } from "@/lib/shift-trends";
import ShiftEditor from "./ShiftEditor";

export const dynamic = "force-dynamic";

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  hard: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const SECTION_ACCENT: Record<string, string> = {
  "General Intelligence": "text-sky-300",
  "General Awareness": "text-violet-300",
  "Quantitative Aptitude": "text-amber-300",
  "English Comprehension": "text-emerald-300",
};

export default async function ExamAnalysisPage() {
  const data = await loadExamShifts();
  const analysis = analyze(data);
  const hasData = data.shifts.some((s) => s.questions.length > 0);
  const coreConcepts = hasData ? findCoreConcepts(data.shifts) : [];
  const predictionGaps = hasData ? findPredictionGaps(data.shifts) : [];
  const updatedLabel = analysis.updatedAt
    ? new Date(analysis.updatedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const stats = [
    { label: "Shifts Reported", value: String(analysis.shiftCount) },
    { label: "Questions Reported", value: String(analysis.reportedCount) },
    { label: "Unique Questions", value: String(analysis.distinctCount) },
    { label: "Repeated Across Shifts", value: String(analysis.repeatedCount) },
  ];

  const maxTopic = analysis.topics[0]?.total || 1;

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Shift Analysis" />
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-1">
              Live Exam Analysis
            </p>
            <h1 className="text-2xl font-bold text-white tracking-tight">{analysis.exam}</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Question-by-question comparison across every shift of the exam.
            </p>
          </div>
          <span className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded-full text-zinc-300">
            {updatedLabel ? `Updated ${updatedLabel}` : "No data yet"}
          </span>
        </div>

        {!hasData && (
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl px-5 py-8 text-center">
            <h2 className="text-sm font-semibold text-zinc-100">No shift questions recorded yet</h2>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              Add the questions reported from each shift in the admin panel below. As soon as a second
              shift is added, repeats and the topic breakdown appear here automatically.
            </p>
          </div>
        )}

        {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-4">
              <p className="text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-white tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
        )}

        {hasData && (
        <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Questions Repeated Across Shifts</h2>
              <span className="text-[10px] text-zinc-500">
                {analysis.exactRepeated} identical · {analysis.similarRepeated} reworded
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Matched by word overlap, so a question reworded between shifts is still caught. Treat these
              as high-probability for the next tier.
            </p>
          </div>
          {analysis.repeated.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">
              No repeats found yet. Repeats show up once the same question appears in two or more shifts.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {analysis.repeated.map((r) => (
                <li key={r.question} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      Seen in {r.timesSeen} shifts
                    </span>
                    <span
                      className={`text-[10px] border px-2 py-0.5 rounded-full ${
                        r.matchKind === "exact"
                          ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                          : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {r.matchKind === "exact" ? "identical" : `${r.similarity}% match`}
                    </span>
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                      {r.topic}
                    </span>
                    <span className={`text-[10px] border px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[r.difficulty] || DIFFICULTY_STYLE.medium}`}>
                      {r.difficulty}
                    </span>
                    <span className={`text-[10px] ${SECTION_ACCENT[r.section] || "text-zinc-400"}`}>{r.section}</span>
                  </div>
                  <p className="text-sm text-zinc-100 leading-relaxed">{r.question}</p>
                  {r.variants.length > 1 && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <p className="text-[10px] text-amber-300/80 mb-1">Also worded as</p>
                      <ul className="space-y-1">
                        {r.variants
                          .filter((v) => v !== r.question)
                          .map((v) => (
                            <li key={v} className="text-xs text-zinc-300 leading-relaxed">
                              {v}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {r.options && r.options.length > 0 && (
                    <ul className="mt-2 grid sm:grid-cols-2 gap-1">
                      {r.options.map((o, i) => (
                        <li
                          key={i}
                          className={`text-xs px-2 py-1 rounded border ${
                            i === r.correctAnswer
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-zinc-800 bg-white/[0.02] text-zinc-400"
                          }`}
                        >
                          {o}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.explanation && <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{r.explanation}</p>}
                  <p className="mt-2 text-[10px] text-zinc-500">Shifts: {r.shifts.join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        {hasData && (
        <>
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-100">Topic Frequency</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">Revise the heaviest topics first.</p>
            </div>
            {analysis.topics.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">No topics reported yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {analysis.topics.map((t) => (
                  <li key={`${t.section}-${t.topic}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm text-zinc-200 truncate">{t.topic}</span>
                      <span className="text-[11px] text-zinc-400 shrink-0">
                        {t.total} {t.total === 1 ? "question" : "questions"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/70 rounded-full"
                        style={{ width: `${Math.max(6, Math.round((t.total / maxTopic) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">{t.section}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-6">
            <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-100">Difficulty Split</h2>
              </div>
              <ul className="divide-y divide-zinc-800/60">
                {analysis.difficulty.map((d) => (
                  <li key={d.label} className="px-5 py-3 flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${DIFFICULTY_STYLE[d.label] || DIFFICULTY_STYLE.medium}`}
                    >
                      {d.label}
                    </span>
                    <span className="text-sm text-zinc-200">
                      {d.count}{" "}
                      <span className="text-[11px] text-zinc-500">({d.percent}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-100">Section Coverage</h2>
              </div>
              <ul className="divide-y divide-zinc-800/60">
                {EXAM_SECTIONS.map((s) => {
                  const count = analysis.sections.find((x) => x.section === s)?.count || 0;
                  return (
                    <li key={s} className="px-5 py-3 flex items-center justify-between">
                      <span className={`text-sm ${SECTION_ACCENT[s] || "text-zinc-300"}`}>{s}</span>
                      <span className="text-sm text-zinc-200">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-100">Repeated Core Concepts</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Concepts the exam has circled in more than one shift. Grouped on word overlap, so a
                reworded repeat counts.
              </p>
            </div>
            {coreConcepts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">
                No concept has repeated yet. This fills in once the same question appears in two shifts.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {coreConcepts.map((c) => (
                  <li key={c.label} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm text-zinc-200 leading-snug">{c.label}</span>
                      <span className="text-[11px] text-zinc-400 shrink-0">
                        {c.shifts.length} shifts
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        {c.topic}
                      </span>
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        {c.reworded ? `${Math.round(c.score * 100)}% overlap` : "identical wording"}
                      </span>
                      <span className="text-[10px] text-zinc-500">{c.shifts.join(" · ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-100">Next Shift Prediction Gaps</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Standard CGL topics with no question recorded in any shift yet. Weighted by how many
                questions they usually take.
              </p>
            </div>
            {predictionGaps.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">
                Every syllabus topic on record has appeared at least once.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {predictionGaps.map((g) => (
                  <li key={g.topic} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm text-zinc-200">{g.topic}</span>
                      <span className={`text-[10px] ml-2 ${SECTION_ACCENT[g.section] || "text-zinc-500"}`}>
                        {g.section}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0 flex gap-0.5" title={`Weight ${g.weight} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`w-1.5 h-1.5 rounded-full ${n <= g.weight ? "bg-amber-400" : "bg-zinc-800"}`}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-100">Shift-wise Papers</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">Everything reported, shift by shift.</p>
          </div>
          {data.shifts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">No shifts reported yet.</p>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {data.shifts.map((shift) => (
                <details key={shift.id} className="group">
                  <summary className="px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <span className="flex items-center gap-2.5">
                      <svg
                        className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-sm font-medium text-zinc-100">{shift.name}</span>
                      <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        {shift.questions.length} questions
                      </span>
                    </span>
                    {shift.examDate && <span className="text-[11px] text-zinc-500">{shift.examDate}</span>}
                  </summary>
                  <ul className="px-5 pb-4 space-y-2">
                    {shift.questions.map((q, i) => (
                      <li key={q.id} className="rounded-lg border border-zinc-800 bg-white/[0.02] p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-zinc-500">Q{i + 1}</span>
                          <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                            {q.topic}
                          </span>
                          <span
                            className={`text-[10px] border px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[q.difficulty] || DIFFICULTY_STYLE.medium}`}
                          >
                            {q.difficulty}
                          </span>
                          <span className={`text-[10px] ${SECTION_ACCENT[q.section] || "text-zinc-400"}`}>{q.section}</span>
                        </div>
                        <p className="text-sm text-zinc-200 leading-relaxed">{q.question}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
        </>
        )}

        <ShiftEditor />
      </div>
    </div>
  );
}
