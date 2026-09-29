"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import {
  QUALIFICATIONS,
  STUDY_SLOTS,
  TARGET_EXAMS,
  type StudentProfile,
} from "@/lib/student-options";

export interface DashUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  targetExam: string;
  dailyGoal: number;
  createdAt: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
  videos: { videoId: string; title: string; studyPlan: { estimatedStudyTime?: string } | null }[];
}

interface Note {
  id: string;
  subject?: string;
  topic?: string;
  videoId?: string;
  contentType?: string;
  content?: string;
  createdAt?: string;
  title?: string;
}

interface Doubt {
  id: string;
  videoId: string;
  author: string;
  text: string;
  timestamp: string;
}

interface QuizAttempt {
  topic?: string;
  subject?: string;
  score: number;
  total: number;
  date: string;
}

interface Pyq {
  id: string;
  subject?: string;
  topic?: string;
  question?: string;
  year?: string;
  tier?: string;
}

function parseMinutes(est?: string): number {
  if (!est) return 30;
  const h = est.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = est.match(/(\d+(?:\.\d+)?)\s*m/);
  return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseFloat(m[1]) : 0)) || 30;
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(days: { date: string; tasks: { done: boolean }[]; closed: boolean }[]): number {
  const pass = new Set(days.filter((d) => d.tasks.some((t) => t.done)).map((d) => d.date));
  let streak = 0;
  const d = new Date();
  if (pass.has(toDateKey(d))) {
    d.setDate(d.getDate() - 1);
    while (pass.has(toDateKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }
  return streak;
}

type Tab = "notes" | "pyqs" | "doubts" | "quizzes";

const GUEST_USER: DashUser = {
  id: "guest",
  name: "Guest Student",
  email: "",
  role: "student",
  targetExam: "",
  dailyGoal: 0,
  createdAt: "",
};

export default function DashboardClient({ user }: { user?: DashUser }) {
  const guest = user || GUEST_USER;
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [pyqs, setPyqs] = useState<Pyq[]>([]);
  const [quizzes, setQuizzes] = useState<QuizAttempt[]>([]);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [roster, setRoster] = useState<{ date: string; tasks: { done: boolean }[]; closed: boolean }[]>([]);
  const [tab, setTab] = useState<Tab>("notes");
  const [editingGoal, setEditingGoal] = useState(false);
  const [dailyGoal, setDailyGoal] = useState("0");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    college: "",
    qualification: "",
    yearOfPassing: "",
    targetExam: "",
    examDate: "",
    studyTime: "",
    goals: "",
  });

  function startEdit() {
    const base = profile;
    setEditingProfile(true);
    setSavedMsg("");
    setForm({
      name: base?.name || "",
      email: base?.email || "",
      phone: base?.phone || "",
      city: base?.city || "",
      college: base?.college || "",
      qualification: base?.qualification || "",
      yearOfPassing: base?.yearOfPassing || "",
      targetExam: base?.targetExam || "",
      examDate: base?.examDate || "",
      studyTime: base?.studyTime || "",
      goals: base?.goals || "",
    });
    setDailyGoal(String(base?.dailyGoal || 0));
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dailyGoal: Number(dailyGoal) || 0 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      const updated = data?.profile;
      if (updated) {
        setProfile(updated);
        setDailyGoal(String(updated.dailyGoal || 0));
        localStorage.setItem("yt-study-daily-goal", String(updated.dailyGoal || 0));
      }
      setEditingProfile(false);
      setSavedMsg("Profile saved ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (err) {
      setSavedMsg(err instanceof Error ? `Save failed: ${err.message}` : "Save failed");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSavingProfile(false);
    }
  }

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then((data) => {
        const p = data?.profile;
        if (p) {
          setProfile(p as StudentProfile);
          setDailyGoal(String(p.dailyGoal || 0));
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSubjects(data as Subject[]);
      })
      .catch(() => {});
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => setNotes(Array.isArray(data?.notes) ? data.notes : []))
      .catch(() => {});
    fetch("/api/discussions")
      .then((res) => res.json())
      .then((data) => setDoubts(Array.isArray(data?.comments) ? data.comments : []))
      .catch(() => {});
    fetch("/api/pyq")
      .then((res) => res.json())
      .then((data) => setPyqs(Array.isArray(data) ? data : Array.isArray(data?.pyqs) ? data.pyqs : []))
      .catch(() => {});
    try {
      const done = JSON.parse(localStorage.getItem("yt-study-done") || "{}");
      if (done && typeof done === "object") setDoneMap(done as Record<string, boolean>);
    } catch {}
    try {
      const r = JSON.parse(localStorage.getItem("study-roster") || "[]");
      if (Array.isArray(r)) setRoster(r);
    } catch {}
    try {
      const q = JSON.parse(localStorage.getItem("yt-study-quiz-history") || "[]");
      if (Array.isArray(q)) setQuizzes(q as QuizAttempt[]);
    } catch {}
  }, []);

  const allVideos = subjects.flatMap((s) => s.videos.map((v) => ({ ...v, subject: s.name })));
  const totalVideos = allVideos.length;
  const doneVideos = allVideos.filter((v) => doneMap[v.videoId]).length;
  const syllabusPct = totalVideos > 0 ? Math.round((doneVideos / totalVideos) * 100) : 0;
  const watchMins = allVideos.reduce((acc, v) => acc + parseMinutes(v.studyPlan?.estimatedStudyTime), 0);
  const streak = computeStreak(roster);
  const avgScore = quizzes.length
    ? Math.round((quizzes.reduce((a, q) => a + q.score, 0) / quizzes.reduce((a, q) => a + Math.max(q.total, 1), 0)) * 100)
    : 0;

  const metricCards = [
    { label: "Syllabus complete", value: `${syllabusPct}%`, sub: `${doneVideos} / ${totalVideos} lectures done`, accent: "text-white" },
    { label: "Study time logged", value: fmtMinutes(watchMins), sub: "across all planned lectures", accent: "text-white" },
    { label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, sub: streak > 0 ? "keep it alive 🔥" : "start today on /roster", accent: "text-white" },
    { label: "Avg quiz score", value: quizzes.length ? `${avgScore}%` : "—", sub: quizzes.length ? `${quizzes.length} attempts` : "take a test on /mock-test", accent: "text-white" },
  ];

  async function saveGoal() {
    const v = Number(dailyGoal);
    if (!Number.isFinite(v) || v < 0) return;
    localStorage.setItem("yt-study-daily-goal", String(Math.round(v)));
    if (profile) {
      try {
        const res = await fetch("/api/students", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            city: profile.city,
            college: profile.college,
            qualification: profile.qualification,
            yearOfPassing: profile.yearOfPassing,
            targetExam: profile.targetExam,
            examDate: profile.examDate,
            studyTime: profile.studyTime,
            goals: profile.goals,
            dailyGoal: Math.round(v),
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.profile) setProfile(data.profile);
      } catch {
        // quiet: localStorage value is already updated
      }
    }
    setEditingGoal(false);
    setSavedMsg("Daily goal updated ✓");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  function handleLogout() {
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminToken");
    window.location.href = "/";
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "notes", label: "Saved Notes", count: notes.length },
    { id: "pyqs", label: "Bookmarked PYQs", count: pyqs.length },
    { id: "doubts", label: "My Doubts", count: doubts.length },
    { id: "quizzes", label: "Quiz History", count: quizzes.length },
  ];

  return (
    <div className="min-h-screen bg-black">
      <AppHeader
        title="Dashboard"
        right={
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-white transition-colors border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg"
          >
            Logout
          </button>
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Profile & Goal header */}
        <h1 className="text-2xl font-bold text-white tracking-tight mb-4">Dashboard</h1>

        <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
          {profileLoading && (
            <p className="text-sm text-zinc-400">Loading your details…</p>
          )}

          {!profileLoading && !editingProfile && (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white text-black text-lg font-bold flex items-center justify-center flex-shrink-0">
                  {initials(profile?.name || guest.name || profile?.email || "S")}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-white">
                      {profile?.name || (profile ? "Your profile" : "Student profile")}
                    </h1>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                      profile?.role === "admin"
                        ? "bg-white text-black"
                        : "bg-zinc-900 border border-zinc-700 text-zinc-300"
                    }`}>
                      {profile?.role || "student"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{profile?.email || "Add your details to personalise the dashboard"}</p>
                  <p className="text-xs text-zinc-300 mt-1.5">
                    Target: <span className="text-white font-medium">{profile?.targetExam || "Not set"}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500">Daily study goal</p>
                  {editingGoal ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={dailyGoal}
                        onChange={(e) => setDailyGoal(e.target.value)}
                        className="w-24 bg-black border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-white/40"
                      />
                      <button onClick={saveGoal} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200">Save</button>
                      <button onClick={() => setEditingGoal(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingGoal(true); setDailyGoal(String(profile?.dailyGoal || 0)); setSavedMsg(""); }}
                      className="text-sm text-white font-semibold hover:underline"
                      title="Edit daily goal"
                    >
                      {(profile?.dailyGoal || 0) > 0 ? `${profile?.dailyGoal} min` : "Let’s set one"}
                    </button>
                  )}
                  {savedMsg && <p className="text-[11px] text-emerald-400">{savedMsg}</p>}
                </div>
              </div>

              {(profile?.name || profile?.phone || profile?.city || profile?.goals) && (
                <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Phone", value: profile?.phone },
                    { label: "City", value: profile?.city },
                    { label: "Exam date", value: profile?.examDate },
                    { label: "Study slot", value: profile?.studyTime },
                    { label: "College", value: profile?.college },
                    { label: "Qualification", value: profile?.qualification },
                    { label: "Passing year", value: profile?.yearOfPassing },
                    { label: "Goals", value: profile?.goals },
                  ]
                    .filter((d) => d.value)
                    .map((d) => (
                      <div key={d.label}>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">{d.label}</p>
                        <p className="text-sm text-zinc-200 mt-0.5 break-words">{d.value}</p>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={startEdit}
                  className="text-xs bg-white text-black px-3.5 py-2 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
                >
                  {profile?.name ? "Edit my details" : "Add your details ↗"}
                </button>
                {!profile?.name && (
                  <p className="text-[11px] text-zinc-500">Tell us your name, target exam, exam date and study time — sab aapke apne hain, kisi aur student ka data yahan nahi dikhega.</p>
                )}
              </div>
            </>
          )}

          {!profileLoading && editingProfile && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">{profile?.name ? "Edit your details" : "Add your details"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Full name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Email</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rahul@example.com" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Phone</span>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98XXX XXXXX" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">City</span>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Jaipur" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">College / School</span>
                  <input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} placeholder="e.g. St. Xavier’s" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Qualification</span>
                  <select value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className="input">
                    <option value="">Select</option>
                    {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Year of passing</span>
                  <input inputMode="numeric" maxLength={4} value={form.yearOfPassing} onChange={(e) => setForm({ ...form, yearOfPassing: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 2025" className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Target exam</span>
                  <select value={form.targetExam} onChange={(e) => setForm({ ...form, targetExam: e.target.value })} className="input">
                    <option value="">Select</option>
                    {TARGET_EXAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Exam date</span>
                  <input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} className="input" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Preferred study time</span>
                  <select value={form.studyTime} onChange={(e) => setForm({ ...form, studyTime: e.target.value })} className="input">
                    <option value="">Select</option>
                    {STUDY_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Daily study goal (in minutes)</span>
                  <input type="number" min={0} max={1440} value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value)} placeholder="e.g. 180" className="input" />
                </div>
                <label className="block sm:col-span-2">
                  <span className="text-[11px] uppercase tracking-widest text-zinc-500">Your goals / notes for exam</span>
                  <textarea rows={3} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} placeholder="e.g. Clear SSC CGL Tier-1 in first attempt, focus on Quant." className="input resize-y" />
                </label>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button onClick={saveProfile} disabled={savingProfile} className="text-xs bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                  {savingProfile ? "Saving…" : "Save details"}
                </button>
                <button onClick={() => { setEditingProfile(false); setSavedMsg(""); }} className="text-xs text-zinc-400 hover:text-white">Cancel</button>
                {savedMsg && <p className="text-[11px] text-emerald-400">{savedMsg}</p>}
              </div>
            </div>
          )}
        </section>

        {/* Progress metrics */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {metricCards.map((m) => (
            <div key={m.label} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-4">
              <p className={`text-xl font-bold ${m.accent}`}>{m.value}</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500 mt-1">{m.label}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{m.sub}</p>
            </div>
          ))}
        </section>

        {/* Quick actions */}
        <section className="flex flex-wrap gap-2 mb-8">
          <Link href="/roster" className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-200 text-xs px-4 py-2 rounded-xl transition-colors">📅 Daily Roster</Link>
          <Link href="/mock-test" className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-200 text-xs px-4 py-2 rounded-xl transition-colors">📝 Mock Tests</Link>
          <Link href="/pyqs" className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-200 text-xs px-4 py-2 rounded-xl transition-colors">📚 PYQ Bank</Link>
          <Link href="/study" className="border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-200 text-xs px-4 py-2 rounded-xl transition-colors">🎬 Continue Studying</Link>
        </section>

        {/* My Library */}
        <section className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-1">My Library</p>
            <h2 className="text-base font-bold text-white">Everything you’ve saved</h2>
          </div>
          <div className="flex border-b border-zinc-800 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 min-w-[110px] py-3 text-xs font-medium transition-colors border-b-2 ${
                  tab === t.id
                    ? "text-white border-white"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-zinc-500">({t.count})</span>
              </button>
            ))}
          </div>

          <div className="p-5 min-h-[160px]">
            {tab === "notes" && (
              notes.length === 0 ? (
                <EmptyState text="No saved notes yet — open any lecture and hit Save Notes." href="/study" cta="Browse lectures" />
              ) : (
                <div className="space-y-2">
                  {notes.slice(0, 20).map((n) => (
                    <div key={n.id} className="border border-zinc-800 rounded-xl p-3.5 bg-black/40">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-zinc-100">{n.topic || n.title || n.subject || "Note"}</p>
                        <span className="text-[10px] text-zinc-500">{n.subject}</span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {String(n.content || "").slice(0, 220) || String(n.contentType || "")}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] text-zinc-500">{n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN") : ""}</span>
                        {n.videoId && <Link href={`/?vid=${n.videoId}`} className="text-[11px] text-zinc-300 hover:text-white">Open video →</Link>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "pyqs" && (
              pyqs.length === 0 ? (
                <EmptyState text="No bookmarked PYQs yet. Generate some from the PYQ bank." href="/pyqs" cta="Go to PYQ Bank" />
              ) : (
                <div className="space-y-2">
                  {pyqs.slice(0, 20).map((p) => (
                    <div key={p.id} className="border border-zinc-800 rounded-xl p-3.5 bg-black/40">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.subject ? "border-zinc-700 text-zinc-300" : "border-zinc-800 text-zinc-500"}`}>{p.subject || "Mixed"}</span>
                        {p.topic && <span className="text-[10px] text-zinc-400">{p.topic}</span>}
                        {p.year && <span className="text-[10px] text-zinc-600">{p.year}</span>}
                      </div>
                      <p className="text-sm text-zinc-200">{p.question}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "doubts" && (
              doubts.length === 0 ? (
                <EmptyState text="No doubts asked yet. Ask one from any lecture’s discussion tab." href="/study" cta="Open a lecture" />
              ) : (
                <div className="space-y-2">
                  {doubts.slice(0, 20).map((d) => (
                    <div key={d.id} className="border border-zinc-800 rounded-xl p-3.5 bg-black/40">
                      <p className="text-sm text-zinc-200 mb-1">{d.text}</p>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500">
                        <span>asked by {d.author || "you"}</span>
                        <span>{d.timestamp ? new Date(d.timestamp).toLocaleDateString("en-IN") : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "quizzes" && (
              quizzes.length === 0 ? (
                <EmptyState text="No quiz attempts yet. Complete a lecture quiz and it lands here." href="/mock-test" cta="Take a mock test" />
              ) : (
                <div className="space-y-2">
                  {quizzes.slice().reverse().map((q, i) => {
                    const pct = q.total > 0 ? Math.round((q.score / q.total) * 100) : 0;
                    return (
                      <div key={i} className="border border-zinc-800 rounded-xl p-3.5 bg-black/40">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium text-zinc-100">{q.topic || q.subject || "Quiz"}</p>
                          <span className={`text-xs font-bold ${pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-300" : "text-red-400"}`}>{pct}%</span>
                        </div>
                        <p className="text-xs text-zinc-400">{q.score} correct · {q.total} qs{q.date ? ` · ${new Date(q.date).toLocaleDateString("en-IN")}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyState({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-sm text-zinc-500 mb-4">{text}</p>
      <Link href={href} className="inline-block bg-white text-black px-4 py-2 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors">
        {cta}
      </Link>
    </div>
  );
}