"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RosterTask {
  id: string;
  text: string;
  done: boolean;
}

interface RosterDay {
  date: string;
  tasks: RosterTask[];
  closed: boolean;
  punishment: string | null;
  punishmentDone: boolean;
}

const PUNISHMENTS = [
  "Wake up 60 minutes earlier tomorrow and burn 20 extra MCQs before breakfast.",
  "No phone or entertainment until tomorrow's entire plan is finished — plan pehle.",
  "Rewrite all missed topics three times each in your notebook tonight.",
  "Complete 25 extra PYQs tonight — one correction for every task you skipped.",
  "Tomorrow starts with today's pending tasks. No new topic until they are done.",
  "Give yourself a penalty mock test: 15 hard questions before you sleep.",
  "Next day ka plan pehle topic-by-topic likho, phir hi rest. Zero excuses this time.",
];

const RATINGS = [
  { min: 0, stars: 1, label: "Failure", tone: "text-red-400", note: "Puniishment Hukumat ke order se — kal poora jukho." },
  { min: 25, stars: 2, label: "Slack", tone: "text-orange-400", note: "50% tak bhi nahi. Punishment active hai." },
  { min: 50, stars: 3, label: "On Track", tone: "text-amber-300", note: "Theek hai, par aaram nahi. Kal 90%+ maaro." },
  { min: 80, stars: 4, label: "Strong", tone: "text-lime-300", note: "Solid day. Bas yehi grip rakhni hai." },
  { min: 95, stars: 5, label: "Outstanding", tone: "text-emerald-400", note: "Beast mode. Rivals pichhe reh gaye." },
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayOfYear(dateStr: string): number {
  const parts = dateStr.split("-").map(Number);
  const start = new Date(parts[0], 0, 1);
  const cur = new Date(parts[0], parts[1] - 1, parts[2]);
  return Math.floor((cur.getTime() - start.getTime()) / 86_400_000);
}

function percentage(day: RosterDay): number {
  if (!day.tasks.length) return 0;
  return Math.round((day.tasks.filter((t) => t.done).length / day.tasks.length) * 100);
}

function evaluate(day: RosterDay, pct: number) {
  if (day.tasks.length === 0) {
    return { stars: 0, label: "No Plan", tone: "text-zinc-500", note: "Bina plan ke din khaali. Kal task add karo." };
  }
  let r = RATINGS[0];
  for (const rating of RATINGS) {
    if (pct >= rating.min) r = rating;
  }
  return r;
}

const ROSTER_KEY = "study-roster";
const RANGE = 14;

export default function Roster() {
  const [days, setDays] = useState<RosterDay[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]") as RosterDay[];
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState(() => toDateKey(new Date()));
  const [taskText, setTaskText] = useState("");

  const dates: string[] = [];
  for (let i = -7; i < RANGE - 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(toDateKey(d));
  }

  const day = days.find((d) => d.date === selected) || { date: selected, tasks: [], closed: false, punishment: null, punishmentDone: false };
  const pct = percentage(day);
  const rating = evaluate(day, pct);
  const isPast = selected < toDateKey(new Date());
  const isToday = selected === toDateKey(new Date());

  useEffect(() => {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(days));
  }, [days]);

  function upsertDay(updater: (day: RosterDay) => RosterDay) {
    const base = days.find((d) => d.date === selected) || { date: selected, tasks: [], closed: false, punishment: null, punishmentDone: false };
    const updated = updater({ ...base, date: selected });
    const rest = days.filter((d) => d.date !== selected);
    setDays([...rest, updated]);
  }

  function addTask() {
    const text = taskText.trim();
    if (!text) return;
    upsertDay((d) => ({ ...d, tasks: [...d.tasks, { id: Date.now().toString(), text, done: false }] }));
    setTaskText("");
  }

  function toggleTask(id: string) {
    if (day.closed) return;
    upsertDay((d) => ((d.tasks = d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))), d));
  }

  function removeTask(id: string) {
    if (day.closed) return;
    upsertDay((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id), closed: false }));
  }

  function closeDay() {
    if (day.tasks.length === 0) return;
    const now = percentage(day);
    const punishment = now < 50 ? PUNISHMENTS[dayOfYear(selected) % PUNISHMENTS.length] : null;
    upsertDay((d) => ({ ...d, closed: true, punishment, punishmentDone: false }));
  }

  function reopenDay() {
    upsertDay((d) => ({ ...d, closed: false }));
  }

  function togglePunishment() {
    upsertDay((d) => ({ ...d, punishmentDone: !d.punishmentDone }));
  }

  const prev7 = days.filter((d) => {
    const key = d.date;
    const t = toDateKey(new Date());
    return key <= t && d.tasks.length > 0;
  });
  const recent = prev7.slice(-7);
  const avgLast7 = recent.length ? Math.round(recent.reduce((a, d) => a + percentage(d), 0) / recent.length) : 0;

  let streak = 0;
  const passDays = days.filter((d) => d.date <= toDateKey(new Date()) && d.tasks.length > 0 && percentage(d) >= 50);
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (passDays.some((p) => p.date === toDateKey(d))) streak++;
    else break;
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-6 block">← Back to Study Planner</Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-1">Daily Discipline System</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Study Roster</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded-full text-zinc-300">🔥 {streak} day streak</span>
            <span className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded-full text-zinc-300">7-day avg {avgLast7}%</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
          {dates.map((key) => {
            const d = days.find((x) => x.date === key);
            const p = d ? percentage(d) : -1;
            const active = key === selected;
            const dateObj = new Date(key + "T00:00:00");
            const label = key === toDateKey(new Date()) ? "Today" : dateObj.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
            return (
              <button key={key} onClick={() => setSelected(key)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                  active ? "bg-white text-black border-white" : "bg-[#0f0f11] border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}>
                <span className="text-[11px] font-medium">{label}</span>
                <span className={`text-[10px] font-semibold ${p >= 50 ? "text-emerald-400" : p >= 0 ? "text-amber-400" : "text-zinc-500"} ${active ? "text-black" : ""}`}>
                  {p >= 0 ? `${p}%` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">{day.tasks.length} task{day.tasks.length === 1 ? "" : "s"} · {pct}% done</p>
            </div>
            {!day.closed && day.tasks.length > 0 && (isToday || isPast) && (
              <button onClick={closeDay} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-semibold hover:bg-zinc-200 transition-colors">
                Close Day & Review
              </button>
            )}
            {day.closed && (
              <button onClick={reopenDay} className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                Reopen
              </button>
            )}
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct >= 50 ? "bg-emerald-500" : pct >= 25 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-bold text-white tabular-nums w-12 text-right">{pct}%</span>
            </div>

            {day.tasks.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">Koi task nahi. Niche plan banao — aaj ka ya aane wale din ka.</p>
            ) : (
              <div className="space-y-2 mb-5">
                {day.tasks.map((task) => (
                  <div key={task.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${task.done ? "border-zinc-800/60 bg-zinc-900/40" : "border-zinc-800 bg-black"}`}>
                    <button onClick={() => toggleTask(task.id)} disabled={day.closed}
                      className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.done ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 hover:border-zinc-400"
                      } ${day.closed ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {task.done && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <span className={`flex-1 text-sm min-w-0 ${task.done ? "line-through text-zinc-500" : "text-zinc-200"}`}>{task.text}</span>
                    <button onClick={() => removeTask(task.id)} disabled={day.closed} className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-zinc-800 bg-black p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Plan for this day</span>
                <span className="text-[10px] text-zinc-500">{isToday ? "Aaj" : isPast ? "Us din ka plan" : "Aage ka plan"}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="e.g. History — Mughal Empire (2 revisions), 30 GK MCQs…"
                  className="flex-1 min-w-0 text-sm rounded-xl border border-zinc-700 bg-black px-3 py-2.5 text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
                <button onClick={addTask} className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
                  + Add
                </button>
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${rating.stars >= 4 ? "border-emerald-500/30 bg-emerald-500/5" : rating.stars >= 1 ? "border-zinc-800 bg-zinc-950" : "border-zinc-800/60 bg-zinc-950"}`}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className={`text-lg font-bold ${rating.tone}`}>{rating.label}</span>
                <span className={`text-base tracking-wider ${rating.tone}`}>
                  {rating.stars > 0 ? "★".repeat(rating.stars) + "☆".repeat(5 - rating.stars) : "· · ·"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{rating.note}</p>

              {day.closed && day.punishment && (
                <div className={`mt-4 rounded-xl border p-4 ${day.punishmentDone ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="text-xs font-bold text-red-300 uppercase tracking-wider">Punishment Slip</span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{day.punishment}</p>
                  <button onClick={togglePunishment} className={`mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${day.punishmentDone ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${day.punishmentDone ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600"}`}>
                      {day.punishmentDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    {day.punishmentDone ? "Punishment Completed ✓" : "Mark punishment completed"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {days.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Recent Days</h3>
            <div className="space-y-2">
              {[...days]
                .filter((d) => d.date <= toDateKey(new Date()) && d.tasks.length > 0)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((d) => {
                  const p = percentage(d);
                  const r = evaluate(d, p);
                  return (
                    <button key={d.date} onClick={() => setSelected(d.date)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-[#0f0f11] hover:border-zinc-600 transition-colors text-left">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p >= 50 ? "bg-emerald-500" : p >= 25 ? "bg-amber-500" : "bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                        </p>
                        <p className={`text-[11px] ${r.tone}`}>{r.label}{d.punishment && !d.punishmentDone ? " · punishment pending" : ""}</p>
                      </div>
                      <span className="text-xs font-semibold text-zinc-300 tabular-nums">{p}%</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}