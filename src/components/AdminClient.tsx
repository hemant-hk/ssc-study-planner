"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export interface AdminUser {
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
  videos: { videoId: string; title: string; studyPlan?: unknown }[];
}

interface StudyPlanShape {
  summary?: string;
  estimatedStudyTime?: string;
  chapters?: { title?: string }[];
  difficulty?: string;
  quiz?: unknown[];
}

interface Notice {
  exam: string;
  title: string;
  issuedOn: string;
  status: string;
  summary: string;
  dates: { label: string; value: string; important?: boolean }[];
  examLink: string;
  applyLink?: string;
}

interface Doubt {
  id: string;
  videoId: string;
  author: string;
  text: string;
  timestamp: string;
  upvotes: number;
}

const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-pink-500",
];

type SectionId = "overview" | "content" | "ai" | "notices" | "doubts";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Content Manager" },
  { id: "ai", label: "AI Content Engine" },
  { id: "notices", label: "Notice & Calendar" },
  { id: "doubts", label: "Doubt Resolution" },
];

const inputCls =
  "w-full bg-black border border-zinc-800 focus:border-white/40 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-zinc-500";

export default function AdminClient({ user }: { user: AdminUser }) {
  const [section, setSection] = useState<SectionId>("overview");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [doubts, setDoubts] = useState<Doubt[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[3]);
  const [importUrl, setImportUrl] = useState("");
  const [importTarget, setImportTarget] = useState("");

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  async function loadSubjects() {
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (Array.isArray(data)) setSubjects(data as Subject[]);
    } catch {
      setError("Failed to load subjects");
    }
  }

  async function loadNotices() {
    try {
      const res = await fetch("/api/notices");
      const data = await res.json();
      if (Array.isArray(data?.notices)) setNotices(data.notices as Notice[]);
    } catch {
      /* keep built-ins */
    }
  }

  async function loadDoubts() {
    try {
      const res = await fetch("/api/discussions");
      const data = await res.json();
      if (Array.isArray(data?.comments)) setDoubts(data.comments as Doubt[]);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadSubjects();
    loadNotices();
    loadDoubts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalVideos = subjects.reduce((a, s) => a + s.videos.length, 0);
  const plannedVideos = subjects.reduce(
    (a, s) => a + s.videos.filter((v) => v.studyPlan).length,
    0
  );

  async function addSubject() {
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    const subject: Subject = {
      id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      color: newColor,
      videos: [],
    };
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subject),
    });
    setBusy(false);
    if (res.ok) {
      setSubjects((prev) => [...prev, subject]);
      setNewName("");
    } else setError("Failed to add subject (needs admin session)");
  }

  async function deleteSubject(id: string) {
    if (!confirm("Delete this subject and all its lectures?")) return;
    setBusy(true);
    const res = await fetch("/api/subjects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    if (res.ok) setSubjects((prev) => prev.filter((s) => s.id !== id));
    else setError("Failed to delete subject");
  }

  async function renameSubject(id: string, name: string) {
    const subject = subjects.find((s) => s.id === id);
    if (!subject) return;
    const updated = { ...subject, name };
    setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)));
    await fetch("/api/subjects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  async function removeVideo(subjectId: string, videoId: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    const updated = { ...subject, videos: subject.videos.filter((v) => v.videoId !== videoId) };
    setSubjects((prev) => prev.map((s) => (s.id === subjectId ? updated : s)));
    await fetch("/api/subjects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  }

  async function importPlaylist() {
    if (!importUrl.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");

      let newVideos: Subject["videos"];
      let targetName = importTarget.trim() || "Imported Lectures";
      if (data.type === "playlist" && Array.isArray(data.playlist?.videos)) {
        newVideos = data.playlist.videos.map(
          (v: { videoId: string; title: string }) => ({ videoId: v.videoId, title: v.title.trim() })
        );
        targetName = targetName === "Imported Lectures" && data.playlist?.title ? data.playlist.title : targetName;
      } else if (data.studyPlan && data.videoInfo) {
        newVideos = [{ videoId: data.videoInfo.videoId, title: data.videoInfo.title?.trim() || "", studyPlan: data.studyPlan }];
      } else {
        throw new Error("Unexpected import response");
      }

      const existing = subjects.find((s) => s.name.toLowerCase() === targetName.toLowerCase());
      if (existing) {
        const seen = new Set(existing.videos.map((v) => v.videoId));
        const merged = { ...existing, videos: [...existing.videos, ...newVideos.filter((v) => !seen.has(v.videoId))] };
        setSubjects((prev) => prev.map((s) => (s.id === existing.id ? merged : s)));
        await fetch("/api/subjects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        });
      } else {
        const created: Subject = {
          id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: targetName,
          color: COLORS[subjects.length % COLORS.length],
          videos: newVideos,
        };
        await fetch("/api/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(created),
        });
        setSubjects((prev) => [...prev, created]);
      }
      setImportUrl("");
      setImportTarget("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan(subjectId: string, videoId: string) {
    setGeneratingId(videoId);
    setError("");
    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://youtube.com/watch?v=${videoId}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.studyPlan) throw new Error(data?.error || "Generation failed");

      const subject = subjects.find((s) => s.id === subjectId);
      if (subject) {
        const updated = {
          ...subject,
          videos: subject.videos.map((v) => (v.videoId === videoId ? { ...v, studyPlan: data.studyPlan } : v)),
        };
        setSubjects((prev) => prev.map((s) => (s.id === subjectId ? updated : s)));
        await fetch("/api/subjects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingId(null);
    }
  }

  function updateNotice(idx: number, patch: Partial<Notice>) {
    setNotices((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }

  function addNotice() {
    setNotices((prev) => [
      ...prev,
      {
        exam: "SSC CGL 2026",
        title: "New notification",
        issuedOn: "Today",
        status: "Upcoming",
        summary: "Details go here…",
        dates: [{ label: "Application Start", value: "To be notified" }],
        examLink: "https://ssc.gov.in",
      },
    ]);
  }

  async function saveNotices() {
    setBusy(true);
    const res = await fetch("/api/notices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notices }),
    });
    setBusy(false);
    if (res.ok) setError("");
    else setError("Failed to save notices (needs admin session)");
  }

  async function resolveDoubt(id: string) {
    const res = await fetch("/api/discussions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setDoubts((prev) => prev.filter((d) => d.id !== id));
      setError("");
    } else setError("Failed to resolve doubt");
  }

  async function postReply(doubt: Doubt) {
    if (!replyText.trim()) return;
    const res = await fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: doubt.videoId, author: "Admin", text: replyText.trim() }),
    });
    if (res.ok) {
      setReplyText("");
      setReplyFor(null);
      await loadDoubts();
    } else setError("Failed to post reply");
  }

  const videoTitle = useCallback(
    (videoId: string) => {
      for (const s of subjects) {
        const v = s.videos.find((x) => x.videoId === videoId);
        if (v) return `${s.name} · ${v.title}`;
      }
      return videoId;
    },
    [subjects]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminToken");
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 border-b border-zinc-800 bg-black/90 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center flex-shrink-0">
              {user.role === "admin" ? "A" : user.name?.[0]?.toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">{user.name}</p>
              <p className="text-[10px] text-zinc-400 leading-tight">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs text-zinc-400 hover:text-white transition-colors hidden sm:inline">
              ← Planner
            </Link>
            <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 py-2 min-w-max">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  section === s.id ? "bg-white text-black" : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-900/60 bg-red-950/40 text-xs text-red-300">{error}</div>
        )}

        {section === "overview" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-white">Overview</h1>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Subjects", value: subjects.length },
                { label: "Lectures", value: totalVideos },
                { label: "AI plans ready", value: `${plannedVideos}/${totalVideos}` },
                { label: "Pending doubts", value: doubts.length },
              ].map((m) => (
                <div key={m.label} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5">
                  <p className="text-2xl font-bold text-white">{m.value}</p>
                  <p className="text-[11px] uppercase tracking-widest text-zinc-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Quick actions</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSection("content")} className="text-xs border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-4 py-2 rounded-xl transition-colors">
                  Content Manager
                </button>
                <button onClick={() => setSection("ai")} className="text-xs border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-4 py-2 rounded-xl transition-colors">
                  AI Content Engine
                </button>
                <button onClick={() => setSection("notices")} className="text-xs border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-4 py-2 rounded-xl transition-colors">
                  Notice Manager
                </button>
                <button onClick={() => setSection("doubts")} className="text-xs border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-4 py-2 rounded-xl transition-colors">
                  Doubt Desk
                </button>
              </div>
            </div>
          </div>
        )}

        {section === "content" && (
          <div className="space-y-5">
            <h1 className="text-xl font-bold text-white">Content Manager</h1>

            <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">Add a subject</p>
              <div className="flex flex-wrap gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Subject name" className={`${inputCls} flex-1 min-w-[180px]`} />
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full ${c} ${newColor === c ? "ring-2 ring-white" : "opacity-50"}`} aria-label={c} />
                  ))}
                </div>
                <button onClick={addSubject} disabled={busy} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  Create
                </button>
              </div>
            </div>

            <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">Import YouTube / Playlist</p>
              <div className="flex flex-wrap gap-2">
                <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="Paste a YouTube playlist/video URL" className={`${inputCls} flex-1 min-w-[220px]`} />
                <input value={importTarget} onChange={(e) => setImportTarget(e.target.value)} placeholder="Subject (auto-create if new)" className={`${inputCls} flex-1 min-w-[180px]`} />
                <button onClick={importPlaylist} disabled={busy} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  {busy ? "Importing…" : "Import"}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">Fetches the playlist metadata and adds lectures to the subject.</p>
            </div>

            <div className="space-y-4">
              {subjects.length === 0 ? (
                <p className="text-sm text-zinc-500">No subjects yet — create one or import a playlist above.</p>
              ) : (
                subjects.map((s) => (
                  <div key={s.id} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${s.color}`} />
                      <input
                        defaultValue={s.name}
                        onBlur={(e) => e.target.value.trim() !== s.name && renameSubject(s.id, e.target.value.trim())}
                        className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold text-white outline-none focus:border-b focus:border-zinc-600"
                      />
                      <span className="text-xs text-zinc-500">{s.videos.length} lectures</span>
                      <button onClick={() => deleteSubject(s.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Delete
                      </button>
                    </div>
                    {s.videos.length > 0 && (
                      <div className="px-5 py-3 max-h-60 overflow-y-auto space-y-1.5">
                        {s.videos.map((v) => (
                          <div key={v.videoId} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.studyPlan ? "bg-emerald-400" : "bg-zinc-700"}`} title={v.studyPlan ? "Study plan ready" : "No study plan"} />
                            <span className="flex-1 text-xs text-zinc-300 truncate">{v.title}</span>
                            <button onClick={() => removeVideo(s.id, v.videoId)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors" title="Remove lecture">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {section === "ai" && (
          <div className="space-y-5">
            <h1 className="text-xl font-bold text-white">AI Content Engine</h1>
            <p className="text-xs text-zinc-400">Generate a Groq-powered study plan (chapters, quiz, PYQ topica) per lecture.</p>
            <div className="space-y-4">
              {subjects.length === 0 ? (
                <p className="text-sm text-zinc-500">Add content first via Content Manager.</p>
              ) : (
                subjects.map((s) => (
                  <div key={s.id} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${s.color}`} />
                      <p className="text-sm font-semibold text-white">{s.name}</p>
                      <span className="text-[11px] text-zinc-500 ml-auto">{s.videos.filter((v) => v.studyPlan).length}/{s.videos.length} ready</span>
                    </div>
                    {s.videos.length === 0 ? (
                      <p className="px-5 py-4 text-xs text-zinc-500">No lectures in this subject.</p>
                    ) : (
                      <div className="px-5 py-3 space-y-1.5">
                        {s.videos.map((v) => (
                          <div key={v.videoId} className="flex flex-wrap items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.studyPlan ? "bg-emerald-400" : "bg-zinc-700"}`} />
                            <span className="flex-1 min-w-[140px] text-xs text-zinc-300 truncate">{v.title}</span>
                            {v.studyPlan ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                                Ready · {(v.studyPlan as StudyPlanShape).chapters?.length || 0} chapters
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
                                No plan
                              </span>
                            )}
                            <button
                              onClick={() => generatePlan(s.id, v.videoId)}
                              disabled={generatingId === v.videoId}
                              className="text-[11px] border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                            >
                              {generatingId === v.videoId ? "Generating…" : v.studyPlan ? "Regenerate" : "Generate"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {section === "notices" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-white">Notice & Calendar Manager</h1>
              <div className="flex gap-2">
                <button onClick={addNotice} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-900 transition-colors">＋ Add notice</button>
                <button onClick={saveNotices} disabled={busy} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-400">These notices show on the home screen and /notice board.</p>
            <div className="space-y-4">
              {notices.map((n, idx) => (
                <div key={idx} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <input value={n.exam} onChange={(e) => updateNotice(idx, { exam: e.target.value })} className={`${inputCls} flex-1 min-w-[140px]`} placeholder="Exam" />
                    <select value={n.status} onChange={(e) => updateNotice(idx, { status: e.target.value })} className={`${inputCls} w-36`}>
                      <option>Active Now</option>
                      <option>Upcoming</option>
                      <option>Closed</option>
                    </select>
                  </div>
                  <input value={n.title} onChange={(e) => updateNotice(idx, { title: e.target.value })} className={inputCls} placeholder="Title" />
                  <input value={n.summary} onChange={(e) => updateNotice(idx, { summary: e.target.value })} className={inputCls} placeholder="Summary" />
                  <input value={n.issuedOn} onChange={(e) => updateNotice(idx, { issuedOn: e.target.value })} className={inputCls} placeholder="Issued on" />
                  <input value={n.examLink} onChange={(e) => updateNotice(idx, { examLink: e.target.value })} className={inputCls} placeholder="Official link" />
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">Key dates</p>
                    <div className="space-y-1.5">
                      {n.dates.map((d, j) => (
                        <div key={j} className="flex flex-wrap gap-2">
                          <input value={d.label} onChange={(e) => updateNotice(idx, { dates: n.dates.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} className={`${inputCls} flex-1 min-w-[120px]`} placeholder="Label" />
                          <input value={d.value} onChange={(e) => updateNotice(idx, { dates: n.dates.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })} className={`${inputCls} flex-1 min-w-[140px]`} placeholder="Date" />
                          <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <input type="checkbox" checked={!!d.important} onChange={(e) => updateNotice(idx, { dates: n.dates.map((x, k) => (k === j ? { ...x, important: e.target.checked } : x)) })} />
                            important
                          </span>
                        </div>
                      ))}
                      <button
                        onClick={() => updateNotice(idx, { dates: [...n.dates, { label: "Event", value: "To be notified" }] })}
                        className="text-[11px] text-zinc-400 hover:text-white transition-colors"
                      >
                        ＋ Add date
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setNotices((prev) => prev.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Remove notice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "doubts" && (
          <div className="space-y-5">
            <h1 className="text-xl font-bold text-white">Doubt Resolution Desk</h1>
            <p className="text-xs text-zinc-400">Student doubts from the lecture discussion tabs — reply or mark resolved.</p>
            <div className="space-y-3">
              {doubts.length === 0 ? (
                <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-8 text-center">
                  <p className="text-sm text-zinc-500">No doubts yet. 🎉</p>
                </div>
              ) : (
                doubts.map((d) => (
                  <div key={d.id} className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200">{d.text}</p>
                        <p className="text-[11px] text-zinc-500 mt-1.5">
                          <span className="text-zinc-400">{videoTitle(d.videoId)}</span> · {d.author} ·{" "}
                          {new Date(d.timestamp).toLocaleString("en-IN")} · {d.upvotes}▲
                        </p>
                        {replyFor === d.id && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <input
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write a helpful answer…"
                              className={inputCls}
                              onKeyDown={(e) => e.key === "Enter" && postReply(d)}
                            />
                            <button onClick={() => postReply(d)} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">
                              Post reply
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button onClick={() => setReplyFor(replyFor === d.id ? null : d.id)} className="text-xs border border-zinc-700 hover:bg-zinc-900 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors">
                          Reply
                        </button>
                        <button onClick={() => resolveDoubt(d.id)} className="text-xs border border-emerald-800 text-emerald-400 hover:bg-emerald-950/40 px-3 py-1.5 rounded-lg transition-colors">
                          Resolve ✓
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}