"use client";

import { useState, useEffect, useRef } from "react";
import DiscussionThread from "@/components/DiscussionThread";
import NotesButton from "@/components/NotesButton";
import { getCachedPlan, getCachedPlans, setCachedPlan, deleteCachedPlan } from "@/lib/study-cache";
import { SSC_NOTICES } from "@/lib/ssc-notices";

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  description: string;
  chapters: { title: string; timestamp: string; startSeconds: number }[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  year?: string;
  exam?: string;
}

interface ImportantNote {
  topic: string;
  frequency: string;
  notes: string;
  exams: string[];
}

interface PredictedTopic {
  topic: string;
  probability: string;
  reason: string;
  preparationTip: string;
}

interface StudyPlan {
  summary: string;
  keyTopics: string[];
  chapters: { title: string; timestamp: string; keyConcepts: string[]; notes: string }[];
  revisionPoints: string[];
  difficulty: string;
  estimatedStudyTime: string;
  quiz: QuizQuestion[];
  lastYearNotes: ImportantNote[];
  predictedTopics: PredictedTopic[];
  fullNotes?: string;
}

interface SubjectVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  studyPlan: StudyPlan | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
  videos: SubjectVideo[];
  schedule: { day: string; startTime: string; endTime: string }[];
  createdAt: string;
}

const COLORS = [
  "bg-indigo-400", "bg-sky-400", "bg-emerald-400", "bg-amber-400",
  "bg-rose-400", "bg-violet-400", "bg-teal-400", "bg-zinc-400",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAILY_QUOTES = [
  "The competition doesn't care about your excuses. Discipline is choosing between what you want now and what you want most.",
  "One more revision. One more mock test. Every rep your rivals skip is a mark you keep.",
  "You don't rise to your goals; you fall to your systems. Build them sharp.",
  "SSC is a marathon of consistency, not a sprint of intensity. Show up every single day.",
  "Two years of discipline buys you a lifetime of options. It's a fair trade.",
  "While others procrastinate on their phones, you quietly out-work them. That's the edge.",
  "The exam doesn't care about your talent. It only counts the answers you practised.",
  "Motivation gets you started; habit keeps you unbeatable. Make revision a habit.",
  "Every mock test is a trophy waiting for your mistakes to be found before the real day.",
  "You can't outsource this. No one else's discipline pays your salary.",
  "Exposure, repetition, recall. Do your three rounds today, without negotiation.",
  "The seat in the merit list belongs to whoever refuses to be average at 2 AM.",
];

export default function Home() {
  // Hydrate synchronously from the localStorage cache so the sidebar subjects
  // render instantly on first click; the /api/subjects fetch refines in
  // background (this is critical when the cloud is slow/unreachable).
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("yt-study-subjects");
      return saved ? (JSON.parse(saved) as Subject[]) : [];
    } catch {
      return [];
    }
  });
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [addingToSubject, setAddingToSubject] = useState<string | null>(null);
  const [playlistProgress, setPlaylistProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  // Guard against duplicate/rapid study-plan requests for the same video.
  const inFlightPlans = useRef<Set<string>>(new Set());
  // Active tab on the lecture detail panel.
  const [activeTab, setActiveTab] = useState<"notes" | "chapters" | "discussion" | "quiz">("notes");
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizFilter, setQuizFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [videoFilter, setVideoFilter] = useState<"all" | "pending" | "completed">("all");
  const [completedVideos, setCompletedVideos] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("yt-study-done") || "{}");
    } catch {
      return {};
    }
  });
  const [revCheck, setRevCheck] = useState<Record<string, number[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("yt-study-revision") || "{}");
    } catch {
      return {};
    }
  });
  // "checking" | "cloud" | "file" | "off" — which storage syncs your data across
  // devices. cloud = Supabase reachable, file = this server's own store,
  // off = only this browser (neither cloud nor server store available).
  const [syncStatus, setSyncStatus] = useState<"checking" | "cloud" | "file" | "off">("checking");

  useEffect(() => {
    // Probe which store answers, so the UI can show whether data syncs across
    // devices and what backs it (Supabase cloud vs this server's file).
    fetch("/api/cache?probe=1")
      .then((res) => (res.ok ? res.json() : { store: "off" }))
      .then((body: { store?: string }) => {
        const store = body?.store;
        setSyncStatus(store === "cloud" ? "cloud" : store === "file" ? "file" : "off");
      })
      .catch(() => setSyncStatus("off"));

    fetch("/api/subjects")
      .then((res) => res.json())
      .then(async (data) => {
        if (Array.isArray(data)) {
          const localPlans = await getCachedPlans();
          setSubjects(
            (data as Subject[]).map((s) => ({
              ...s,
              videos: s.videos.map((v) =>
                v.studyPlan ? v : { ...v, studyPlan: localPlans[v.videoId] || null }
              ),
            }))
          );
        }
      })
      .catch(() => {
        const saved = localStorage.getItem("yt-study-subjects");
        if (saved) setSubjects(JSON.parse(saved));
      });

    const adminStatus = localStorage.getItem("isAdmin");
    if (adminStatus === "true") setIsAdmin(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("yt-study-subjects", JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem("yt-study-done", JSON.stringify(completedVideos));
  }, [completedVideos]);

  useEffect(() => {
    localStorage.setItem("yt-study-revision", JSON.stringify(revCheck));
  }, [revCheck]);

  useEffect(() => {
    if (subjects.length === 0 || activeVideoId) return;
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("vid");
    if (!vid) return;
    for (const s of subjects) {
      const v = s.videos.find((x) => x.videoId === vid);
      if (v) {
        setActiveSubjectId(s.id);
        setActiveVideoId(vid);
        break;
      }
    }
  }, [subjects, activeVideoId]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateString = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const dailyQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setShowLogin(false);
        setLoginPassword("");
        localStorage.setItem("isAdmin", "true");
        localStorage.setItem("adminToken", loginPassword);
      } else {
        setLoginError("Invalid password");
      }
    } catch {
      setLoginError("Login failed");
    }
  }

  function handleLogout() {
    setIsAdmin(false);
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminToken");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePasswordError("");
    setChangePasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setChangePasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setChangePasswordError("New password must be at least 4 characters");
      return;
    }
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setChangePasswordSuccess("Password updated successfully");
        localStorage.setItem("adminToken", newPassword);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setShowChangePassword(false), 1200);
      } else {
        setChangePasswordError(data?.error || "Failed to change password");
      }
    } catch {
      setChangePasswordError("Failed to change password");
    }
  }

  function getAdminToken() {
    return localStorage.getItem("adminToken") || "";
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || null;
  const activeVideo = activeSubject?.videos.find((v) => v.videoId === activeVideoId) || null;

  const doneCount = activeSubject ? activeSubject.videos.filter((v) => completedVideos[v.videoId]).length : 0;
  const donePct = activeSubject && activeSubject.videos.length > 0 ? Math.round((doneCount / activeSubject.videos.length) * 100) : 0;
  const visibleVideos = activeSubject
    ? activeSubject.videos.filter((v) => {
        if (videoFilter === "pending" && completedVideos[v.videoId]) return false;
        if (videoFilter === "completed" && !completedVideos[v.videoId]) return false;
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const hay = `${v.title} ${parseVideoTitle(v.title).topic}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
: [];

  function toggleVideoDone(videoId: string) {
    setCompletedVideos((prev) => ({ ...prev, [videoId]: !prev[videoId] }));
  }

  function toggleRevision(index: number) {
    if (!activeVideo) return;
    const key = activeVideo.videoId;
    setRevCheck((prev) => {
      const list = prev[key] || [];
      const next = list.includes(index) ? list.filter((x) => x !== index) : [...list, index];
      return { ...prev, [key]: next };
    });
  }

  function createSubject() {
    if (!newSubjectName.trim()) return;
    const newSubject: Subject = {
      id: Date.now().toString(),
      name: newSubjectName.trim(),
      color: COLORS[subjects.length % COLORS.length],
      videos: [],
      schedule: DAYS.map((day) => ({ day, startTime: "", endTime: "" })),
      createdAt: new Date().toISOString(),
    };
    setSubjects((prev) => [...prev, newSubject]);
    setActiveSubjectId(newSubject.id);
    setNewSubjectName("");
    setShowNewSubject(false);
    if (isAdmin) {
      fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify(newSubject),
      });
    }
  }

  function deleteSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
      setActiveVideoId(null);
    }
    if (isAdmin) {
      fetch("/api/subjects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ id }),
      });
    }
  }

  function updateSubjectSchedule(subjectId: string, dayIndex: number, field: "startTime" | "endTime", value: string) {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const newSchedule = [...s.schedule];
        newSchedule[dayIndex] = { ...newSchedule[dayIndex], [field]: value };
        return { ...s, schedule: newSchedule };
      })
    );
  }

  async function addVideoToSubject(subjectId: string) {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setAddingToSubject(subjectId);
    setPlaylistProgress(null);

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process URL");

      if (data.type === "playlist") {
        const videos = data.playlist.videos;
        setPlaylistProgress({ current: 0, total: videos.length, title: data.playlist.title });
        const existingIds = new Set(subjects.find((s) => s.id === subjectId)?.videos.map((v) => v.videoId) || []);
        const newVideos: SubjectVideo[] = [];
        for (let i = 0; i < videos.length; i++) {
          if (!existingIds.has(videos[i].videoId)) {
            newVideos.push({ videoId: videos[i].videoId, title: videos[i].title, thumbnailUrl: videos[i].thumbnailUrl, studyPlan: null });
          }
          setPlaylistProgress({ current: i + 1, total: videos.length, title: data.playlist.title });
        }
        if (newVideos.length > 0) {
          setSubjects((prev) => {
            const updated = prev.map((s) => (s.id === subjectId ? { ...s, videos: [...s.videos, ...newVideos] } : s));
            syncToApi(updated.find((s) => s.id === subjectId));
            return updated;
          });
        }
        setPlaylistProgress(null);
        setUrl("");
      } else {
        await setCachedPlan(data.videoInfo.videoId, data.studyPlan);
        const newVideo: SubjectVideo = {
          videoId: data.videoInfo.videoId,
          title: data.videoInfo.title,
          thumbnailUrl: data.videoInfo.thumbnailUrl,
          studyPlan: data.studyPlan,
        };
        setSubjects((prev) => {
          const updated = prev.map((s) => (s.id === subjectId ? { ...s, videos: [...s.videos, newVideo] } : s));
          syncToApi(updated.find((s) => s.id === subjectId));
          return updated;
        });
        setActiveVideoId(newVideo.videoId);
        setUrl("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPlaylistProgress(null);
    } finally {
      setLoading(false);
      setAddingToSubject(null);
    }
  }

  function syncToApi(subject: Subject | undefined) {
    if (!isAdmin || !subject) return;
    fetch("/api/subjects", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify(subject),
    });
  }

  async function generateStudyPlanForVideo(subjectId: string, videoId: string) {
    if (inFlightPlans.current.has(videoId)) return;
    inFlightPlans.current.add(videoId);
    setGeneratingPlan(videoId);
    setError("");
    try {
      const cachedPlan = await getCachedPlan(videoId);
      if (cachedPlan) {
        applyPlanToVideo(subjectId, videoId, cachedPlan);
        return;
      }
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://youtube.com/watch?v=${videoId}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate study plan");
      await setCachedPlan(videoId, data.studyPlan);
      applyPlanToVideo(subjectId, videoId, data.studyPlan);
    } catch (err: unknown) {
      inFlightPlans.current.delete(videoId);
      setError(err instanceof Error ? err.message : "Failed to generate study plan");
    } finally {
      inFlightPlans.current.delete(videoId);
      setGeneratingPlan(null);
    }
  }

  function applyPlanToVideo(subjectId: string, videoId: string, plan: StudyPlan) {
    setSubjects((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== subjectId) return s;
        return { ...s, videos: s.videos.map((v) => (v.videoId === videoId ? { ...v, studyPlan: plan } : v)) };
      });
      syncToApi(updated.find((s) => s.id === subjectId));
      return updated;
    });
    setActiveVideoId(videoId);
    setActiveTab("notes");
  }

  async function generateQuizForVideo(subjectId: string, videoId: string) {
    if (inFlightPlans.current.has(videoId)) return;
    inFlightPlans.current.add(videoId);
    setGeneratingQuiz(true);
    setError("");
    try {
      const cachedPlan = await getCachedPlan(videoId);
      if (cachedPlan?.quiz && cachedPlan.quiz.length > 0) {
        applyPlanToVideo(subjectId, videoId, cachedPlan);
        return;
      }
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://youtube.com/watch?v=${videoId}`,
          style: "quiz",
          ...(cachedPlan ? { plan: cachedPlan } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz");
      await setCachedPlan(videoId, data.studyPlan);
      applyPlanToVideo(subjectId, videoId, data.studyPlan);
    } catch (err: unknown) {
      inFlightPlans.current.delete(videoId);
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      inFlightPlans.current.delete(videoId);
      setGeneratingQuiz(false);
    }
  }

  async function generateFullNotesForVideo(subjectId: string, videoId: string) {
    if (inFlightPlans.current.has(videoId)) return;
    inFlightPlans.current.add(videoId);
    setGeneratingNotes(true);
    setError("");
    try {
      const cachedPlan = await getCachedPlan(videoId);
      if (cachedPlan?.fullNotes && cachedPlan.fullNotes.trim().length > 0) {
        applyPlanToVideo(subjectId, videoId, cachedPlan);
        return;
      }
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://youtube.com/watch?v=${videoId}`,
          style: "notes",
          ...(cachedPlan ? { plan: cachedPlan } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate notes");
      await setCachedPlan(videoId, data.studyPlan);
      applyPlanToVideo(subjectId, videoId, data.studyPlan);
    } catch (err: unknown) {
      inFlightPlans.current.delete(videoId);
      setError(err instanceof Error ? err.message : "Failed to generate notes");
    } finally {
      inFlightPlans.current.delete(videoId);
      setGeneratingNotes(false);
    }
  }

  function removeVideo(subjectId: string, videoId: string) {
    setSubjects((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== subjectId) return s;
        return { ...s, videos: s.videos.filter((v) => v.videoId !== videoId) };
      });
      syncToApi(updated.find((s) => s.id === subjectId));
      return updated;
    });
    deleteCachedPlan(videoId);
    if (activeVideoId === videoId) setActiveVideoId(null);
  }

  function handleVideoClick(subjectId: string, video: SubjectVideo) {
    if (video.studyPlan) {
      setActiveVideoId(video.videoId);
      setActiveTab("notes");
    } else {
      generateStudyPlanForVideo(subjectId, video.videoId);
    }
  }

  const videoMeta = activeVideo ? parseVideoTitle(activeVideo.title) : null;

  return (
    <div className="flex flex-col flex-1 bg-black font-sans">
      <header className="w-full border-b border-white/10 bg-black sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <svg className="w-6 h-6 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
            </svg>
            <h1 className="text-xl font-semibold tracking-tight text-white">Study Planner</h1>
            {syncStatus !== "checking" && (
              <span className={`hidden md:inline-flex text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap ${
                syncStatus === "cloud"
                  ? "bg-white/5 border-white/10 text-zinc-300"
                  : syncStatus === "file"
                  ? "bg-white/5 border-white/10 text-zinc-400"
                  : "bg-white/5 border-white/10 text-zinc-400"
              }`} title={syncStatus === "cloud" ? "Data saves to the Supabase cloud and syncs across every device" : syncStatus === "file" ? "Data is saved on this server and syncs across devices using it, plus a copy on this browser" : "Data is saved only in this browser"}>
                {syncStatus === "cloud" ? "Cloud sync" : syncStatus === "file" ? "Server sync" : "Local only"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <a href="/pyqs" className="text-sm bg-zinc-900 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                PYQ Bank
              </a>
              <a href="/notes" className="text-sm bg-zinc-900 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                My Notes
              </a>
              <a href="/mock-test" className="text-sm bg-zinc-900 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                Mock Tests
              </a>
              <a href="/notice" className="text-sm bg-zinc-900 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                Notices
              </a>
              <a href="/roster" className="text-sm bg-zinc-900 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                Roster
              </a>
              <span className="text-xs bg-white/5 border border-white/10 text-zinc-400 px-2.5 py-1 rounded-full whitespace-nowrap">
                {subjects.length} subjects · {subjects.reduce((a, s) => a + s.videos.length, 0)} videos
              </span>
            </div>
            {isAdmin ? (
              <div className="relative flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-white/10 text-white text-xs font-medium flex items-center justify-center border border-white/10" title="Admin">
                  A
                </span>
                <button onClick={() => { setShowChangePassword(true); setChangePasswordError(""); setChangePasswordSuccess(""); }} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Change Password</button>
                <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-white transition-colors">Logout</button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="p-2 rounded-full hover:bg-white/5 transition-colors" title="Admin login" aria-label="Admin login">
                <svg className="w-6 h-6 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full overflow-hidden">
        {showSidebar && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setShowSidebar(false)} />
            <aside className="fixed lg:static inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-black flex flex-col flex-shrink-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Subjects</h2>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <button onClick={() => setShowNewSubject(true)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    )}
                    <button onClick={() => setShowSidebar(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors lg:hidden">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            {showNewSubject && (
              <div className="mb-4 p-3 rounded-xl border border-white/10 bg-[#0f0f11]">
                <input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Subject name..." className="w-full text-sm border border-white/10 rounded-lg px-3 py-2 bg-black mb-2 outline-none focus:border-white/30" onKeyDown={(e) => e.key === "Enter" && createSubject()} autoFocus />
                <div className="flex gap-2">
                  <button onClick={createSubject} className="flex-1 text-xs bg-white text-black py-1.5 rounded-lg hover:bg-zinc-200">Create</button>
                  <button onClick={() => setShowNewSubject(false)} className="flex-1 text-xs bg-white/5 border border-white/10 text-zinc-300 py-1.5 rounded-lg hover:bg-white/10">Cancel</button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 px-4 pb-4">
              {subjects.map((subject) => (
                <div key={subject.id} onClick={() => { setActiveSubjectId(subject.id); setActiveVideoId(null); setActiveTab("notes"); setShowSidebar(false); }}
                  className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${activeSubjectId === subject.id ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <div className={`w-3 h-3 rounded-full ${subject.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{subject.name}</p>
                    <p className="text-[10px] text-zinc-400">{subject.videos.length} videos</p>
                  </div>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); deleteSubject(subject.id); }} className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-zinc-400 transition-opacity">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 pb-6 pt-4 border-t border-white/10">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Library</h3>
              <div className="space-y-1">
                <a href="/pyqs" onClick={() => setShowSidebar(false)} className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  PYQ Bank
                </a>
                <a href="/notes" onClick={() => setShowSidebar(false)} className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  My Notes
                </a>
                <a href="/mock-test" onClick={() => setShowSidebar(false)} className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Mock Tests
                </a>
                <a href="/roster" onClick={() => setShowSidebar(false)} className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Roster
                </a>
                <a href="/notice" onClick={() => setShowSidebar(false)} className="flex items-center gap-2.5 p-2.5 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  Notices
                </a>
              </div>
            </div>
            </div>
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-3 p-2 rounded-xl border border-zinc-800 bg-[#0f0f11]">
                <span className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">A</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">Aspirant</p>
                  <span className="inline-block text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">SSC CGL 2026 Aspirant</span>
                </div>
                <button className="p-1.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-200 transition-colors" title="Settings" aria-label="Settings">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
            </div>
        </aside>
        </>
        )}

        <main className="flex-1 overflow-y-auto">
          {!activeSubject ? (
            <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto w-full">
              {error && <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/40 px-4 py-3 text-red-300 text-sm">{error}</div>}

              <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
                <div>
                  <p className="font-mono text-3xl md:text-4xl font-semibold tracking-tight text-white tabular-nums">{timeString}</p>
                  <p className="text-sm text-zinc-400 tracking-wide mt-1.5">{dateString}</p>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded-full text-zinc-300 whitespace-nowrap">
                  Target: SSC Examination
                </span>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden mb-8">
                <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-2">Daily Focus</p>
                <blockquote className="text-base md:text-lg font-medium text-zinc-200 italic leading-relaxed">“{dailyQuote}”</blockquote>
                <p className="text-xs text-zinc-400 mt-3">— SSC Mindset</p>
              </div>

              <section>
                <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-1">Official Notices</p>
                      <h3 className="text-base font-semibold text-white">SSC Exam Calendar & Application Dates</h3>
                    </div>
                    <a href="/notice" className="inline-block border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs px-3 py-1.5 rounded-lg transition-colors">
                      View Notices →
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SSC_NOTICES.map((n) => {
                      const keyDate = n.dates.find((d) => d.important)?.value || n.dates[0]?.value || "";
                      const live = n.status === "Active Now";
                      return (
                        <div key={n.exam} className="inline-flex items-center gap-2.5 bg-[#0f0f11] border border-zinc-800 rounded-xl pl-3 pr-2 py-1.5">
                          <div className="flex flex-col leading-tight">
                            <span className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">{n.exam}</span>
                            <span className="text-[10px] text-zinc-400 whitespace-nowrap">{keyDate}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${live ? "bg-emerald-950/60 border border-emerald-800 text-emerald-400" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
                            {live ? "Application Open" : "Upcoming"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          ) : !activeVideoId ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${activeSubject.color}`} />
                  <h2 className="text-lg font-bold text-zinc-50">{activeSubject.name}</h2>
                  <span className="text-xs bg-white/5 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full">
                    {activeSubject.videos.length} lectures
                  </span>
                </div>
                {isAdmin && (
                  <button onClick={() => setShowNewSubject(true)} className="text-xs bg-zinc-900 text-zinc-300 border border-white/10 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                    + Add Subject
                  </button>
                )}
              </div>

              <div className="bg-[#0f0f11] border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs text-zinc-400">{doneCount}/{activeSubject.videos.length} Completed ({donePct}%)</span>
                  <span className="text-xs text-zinc-500">{donePct === 100 ? "Subject done — beast mode 💪" : donePct >= 50 ? "Halfway there, keep pushing" : ""}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${donePct >= 50 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${donePct}%` }} />
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste YouTube video or playlist URL..." className="flex-1 rounded-xl border border-white/10 bg-[#0f0f11] px-4 py-3 text-sm outline-none focus:border-white/30" onKeyDown={(e) => e.key === "Enter" && addVideoToSubject(activeSubject.id)} />
                  <div className="flex gap-3">
                    <button onClick={() => addVideoToSubject(activeSubject.id)} disabled={loading || !url.trim()} className="rounded-xl bg-white text-black px-5 py-3 text-sm font-medium hover:bg-zinc-200 disabled:opacity-40 transition-colors">
                      {loading && addingToSubject === activeSubject.id ? "Adding..." : "Add Lecture"}
                    </button>
                    <button onClick={() => setShowSchedule(!showSchedule)} className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${showSchedule ? "bg-white/10 border-white/20 text-white" : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800"}`}>
                      Schedule
                    </button>
                  </div>
                </div>
              )}

              {playlistProgress && (
                <div className="rounded-xl border border-white/10 bg-[#0f0f11] px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-300">Importing: {playlistProgress.title}</span>
                    <span className="text-xs text-zinc-400">{playlistProgress.current}/{playlistProgress.total}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5"><div className="bg-zinc-100 h-1.5 rounded-full transition-all" style={{ width: `${(playlistProgress.current / playlistProgress.total) * 100}%` }} /></div>
                </div>
              )}

              {error && <div className="rounded-xl border border-red-900/40 bg-red-950/40 px-4 py-3 text-red-300 text-sm">{error}</div>}

              {showSchedule && (
                <div className="rounded-xl border border-white/10 bg-[#0f0f11] p-5">
                  <h3 className="text-sm font-semibold text-zinc-50 mb-4">Weekly Schedule for {activeSubject.name}</h3>
                  <div className="space-y-2">
                    {activeSubject.schedule.map((entry, i) => (
                      <div key={entry.day} className="flex items-center gap-4">
                        <span className="w-24 text-sm font-medium text-zinc-300">{entry.day}</span>
                        <input type="time" value={entry.startTime} onChange={(e) => updateSubjectSchedule(activeSubject.id, i, "startTime", e.target.value)} className="text-sm border border-white/10 rounded-lg px-2 py-1.5 bg-black text-zinc-200 outline-none focus:border-white/30" />
                        <span className="text-zinc-400">to</span>
                        <input type="time" value={entry.endTime} onChange={(e) => updateSubjectSchedule(activeSubject.id, i, "endTime", e.target.value)} className="text-sm border border-white/10 rounded-lg px-2 py-1.5 bg-black text-zinc-200 outline-none focus:border-white/30" />
                        {entry.startTime && entry.endTime && <span className="text-xs text-zinc-400 font-medium">{getTimeDiff(entry.startTime, entry.endTime)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search topic..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-zinc-500 placeholder-zinc-600" />
                <div className="flex gap-1.5">
                  {([["all", "All"], ["pending", "Pending"], ["completed", "Completed"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setVideoFilter(key)}
                      className={`flex-1 sm:flex-none text-xs px-3 py-2 rounded-xl border transition-colors ${videoFilter === key ? "bg-white text-black border-white font-semibold" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeSubject.videos.length > 0 ? (
                visibleVideos.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p className="text-sm">No lectures match your search / filter.</p>
                  </div>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {visibleVideos.map((video, idx) => {
                    const meta = parseVideoTitle(video.title);
                    const isDone = !!completedVideos[video.videoId];
                    return (
                      <div key={video.videoId} onClick={() => handleVideoClick(activeSubject.id, video)}
                        className={`group flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all min-h-[92px] ${isDone ? "border-emerald-800/40 bg-zinc-950" : "border-zinc-800/80 bg-[#0f0f11] hover:border-white/30 hover:bg-white/[0.03]"}`}>
                        <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 group-hover:bg-zinc-800 group-hover:border-white/20 transition-colors">
                          <span className="text-base font-bold text-white leading-none">{pad2(idx + 1)}</span>
                          <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium text-sm truncate ${isDone ? "line-through text-zinc-500" : "text-zinc-50"}`}>{meta.topic}</h3>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{meta.subtitle}</p>
                          {generatingPlan === video.videoId ? (
                            <div className="flex items-center gap-2 mt-2">
                              <svg className="animate-spin h-3 w-3 text-zinc-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              <span className="text-xs text-zinc-400">Generating study plan...</span>
                            </div>
                          ) : video.studyPlan ? (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <span className="text-[11px] bg-zinc-900 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{video.studyPlan.difficulty}</span>
                              <span className="text-[11px] bg-zinc-900 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{video.studyPlan.estimatedStudyTime}</span>
                              <span className="text-[11px] text-zinc-400">{video.studyPlan.quiz?.length || 0} quiz questions</span>
                            </div>
                          ) : null}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleVideoDone(video.videoId); }}
                          title={isDone ? "Mark as pending" : "Mark as done"}
                          className={`w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${isDone ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 hover:border-emerald-500 hover:text-emerald-400"}`}>
                          {isDone && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        <svg className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); removeVideo(activeSubject.id, video.videoId); }} className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 transition-opacity flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                )
              ) : (
                <div className="text-center py-12 text-zinc-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <p className="text-sm">{isAdmin ? "No lectures yet. Paste a YouTube URL above." : "No lectures yet. Admin hasn't added any content."}</p>
                </div>
              )}
            </div>
          ) : activeVideo?.studyPlan ? (
            <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
              <button onClick={() => { setActiveVideoId(null); setActiveTab("notes"); setActiveChapter(null); }} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to {activeSubject.name}
              </button>

              <div>
                <span className="inline-flex items-center text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full uppercase tracking-wide">
                  {titleCase(activeSubject.name)}{textToSeries(activeVideo.title) ? ` • ${textToSeries(activeVideo.title)}` : ""}
                </span>
                <h2 className="text-xl font-bold text-white mt-2">{videoMeta?.topic || activeVideo.title}</h2>
                {videoMeta?.subtitle ? <p className="text-sm text-zinc-400 mt-1">{videoMeta.subtitle}</p> : null}
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-zinc-900 border border-white/10 text-zinc-400 px-2.5 py-1 rounded-full">{activeVideo.studyPlan.difficulty}</span>
                  <span className="text-xs bg-zinc-900 border border-white/10 text-zinc-400 px-2.5 py-1 rounded-full">{activeVideo.studyPlan.estimatedStudyTime}</span>
                  <span className="text-xs bg-zinc-900 border border-white/10 text-zinc-400 px-2.5 py-1 rounded-full">{activeVideo.studyPlan.quiz?.length || 0} quiz questions</span>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                <div className="aspect-video w-full">
                  <iframe src={`https://www.youtube.com/embed/${activeVideo.videoId}?start=${activeChapter !== null ? getChapterSeconds(activeVideo.studyPlan.chapters[activeChapter].timestamp) : 0}`} title={activeVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
                </div>
              </div>

              <div className="border-b border-white/10">
                <nav className="flex overflow-x-auto gap-1">
                  {([
                    ["notes", "Notes"],
                    ["chapters", "Chapters"],
                    ["discussion", "Doubts"],
                    ["quiz", "Quiz"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex-1 text-center px-2 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                        activeTab === key
                          ? "border-white text-zinc-50"
                          : "border-transparent text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {activeTab === "notes" && (
                <div className="space-y-6">
                  <article className="rounded-2xl border border-zinc-800/80 bg-[#0f0f11] p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Notes &amp; Summary</p>
                      <button onClick={() => setActiveTab("discussion")}
                        className="inline-flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        Ask a Doubt
                      </button>
                    </div>

                    <p className="text-sm text-zinc-300 leading-relaxed">{activeVideo.studyPlan.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeVideo.studyPlan.keyTopics.map((t, i) => <span key={i} className="text-xs bg-zinc-900 border border-white/10 text-zinc-300 px-3 py-1 rounded-full">{t}</span>)}
                    </div>

                    <div className="border-t border-zinc-800/80 mt-5 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-zinc-50">Detailed Notes</h3>
                        {activeVideo.studyPlan.fullNotes && activeVideo.studyPlan.fullNotes.trim().length > 0 && (
                          <NotesButton subject={activeSubject.name} topic={videoMeta?.topic || activeVideo.title} videoId={activeVideo.videoId} contentType="custom" content={activeVideo.studyPlan.fullNotes} title="Save full notes" />
                        )}
                      </div>
                      {activeVideo.studyPlan.fullNotes && activeVideo.studyPlan.fullNotes.trim().length > 0 ? (
                        <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-4 [&_h2]:mb-1 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-zinc-100 [&_h1]:mt-5 [&_h1]:mb-2 [&_strong]:text-zinc-50 [&_li]:ml-4 [&_ul]:list-disc [&_ol]:list-decimal">
                          {activeVideo.studyPlan.fullNotes}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-6">
                          <p className="text-sm text-zinc-400 text-center max-w-sm">Generate complete, detailed study notes covering everything in this topic.</p>
                          <button onClick={() => generateFullNotesForVideo(activeSubject.id, activeVideo.videoId)} disabled={generatingNotes}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {generatingNotes && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                            {generatingNotes ? "Generating full notes..." : "Generate Full Notes"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>

                  {activeVideo.studyPlan.revisionPoints && activeVideo.studyPlan.revisionPoints.length > 0 && (
                    <section className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
                      <div className="flex items-baseline gap-2 mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Revision Points</h3>
                        <span className="text-[11px] text-zinc-400">{activeVideo.studyPlan.revisionPoints.length}</span>
                      </div>
                      <ul className="divide-y divide-zinc-800/60">
                        {activeVideo.studyPlan.revisionPoints.map((p, i) => {
                          const isDone = (revCheck[activeVideo.videoId] || []).includes(i);
                          return (
                            <li key={i} onClick={() => toggleRevision(i)}
                              className={`flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0 cursor-pointer select-none group/rev transition-colors ${isDone ? "text-zinc-500" : "text-zinc-300 hover:text-zinc-100"}`}>
                              <button onClick={(e) => { e.stopPropagation(); toggleRevision(i); }} aria-label={isDone ? "Mark as pending" : "Mark as done"}
                                className={`mt-0.5 w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${isDone ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 hover:border-emerald-500"}`}>
                                {isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                              <span className={`flex-1 leading-relaxed ${isDone ? "line-through" : ""}`}>{p}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {activeVideo.studyPlan.lastYearNotes && activeVideo.studyPlan.lastYearNotes.length > 0 && (
                    <section className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
                      <div className="flex items-baseline gap-2 mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Important PYQs</h3>
                        <span className="text-[11px] text-zinc-400">{activeVideo.studyPlan.lastYearNotes.length}</span>
                      </div>
                      <ul className="divide-y divide-zinc-800/60">
                        {activeVideo.studyPlan.lastYearNotes.map((note, i) => (
                          <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-zinc-100 flex-1 truncate">{note.topic}</p>
                              <span className="text-[10px] text-zinc-400 whitespace-nowrap">{note.frequency}</span>
                              <NotesButton subject={activeSubject.name} topic={videoMeta?.topic || activeVideo.title} videoId={activeVideo.videoId} contentType="revision" content={`${note.topic}: ${note.notes}`} title="Save note" />
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{note.notes}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">{note.exams.map((exam, j) => <span key={j} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{exam}</span>)}</div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {activeVideo.studyPlan.predictedTopics && activeVideo.studyPlan.predictedTopics.length > 0 && (
                    <section className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
                      <div className="flex items-baseline gap-2 mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Predicted Topics</h3>
                        <span className="text-[11px] text-zinc-400">{activeVideo.studyPlan.predictedTopics.length}</span>
                      </div>
                      <ul className="divide-y divide-zinc-800/60">
                        {activeVideo.studyPlan.predictedTopics.map((topic, i) => {
                          const probClass = topic.probability === "High" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : topic.probability === "Medium" ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-zinc-900 border-zinc-800 text-zinc-400";
                          return (
                            <li key={i} title={`Why: ${topic.reason} · Tip: ${topic.preparationTip}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${probClass}`}>{topic.probability}</span>
                              <span className="text-sm font-medium text-zinc-200 flex-1 truncate">{topic.topic}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              {activeTab === "chapters" && (
                <div className="space-y-2">
                  {activeVideo.studyPlan.chapters.map((ch, i) => (
                    <div key={i} onClick={() => setActiveChapter(activeChapter === i ? null : i)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${activeChapter === i ? "border-white/25 bg-white/5" : "border-white/10 bg-[#0f0f11] hover:border-white/20"}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center">{pad2(i + 1)}</span>
                        <span className="text-xs font-mono bg-zinc-900 border border-white/10 text-zinc-400 px-2 py-0.5 rounded">{ch.timestamp}</span>
                        <span className="font-medium text-sm text-zinc-100 flex-1">{ch.title}</span>
                        <span className="text-[10px] text-zinc-400">{activeChapter === i ? "Playing" : "Watch"}</span>
                      </div>
                      {activeChapter === i && (
                        <div className="mt-3 ml-10">
                          <div className="flex flex-wrap gap-1 mb-2">{ch.keyConcepts.map((c, j) => <span key={j} className="text-[10px] bg-zinc-900 border border-white/10 text-zinc-400 px-1.5 py-0.5 rounded">{c}</span>)}</div>
                          <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{ch.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "discussion" && (
                <DiscussionThread videoId={activeVideo.videoId} />
              )}

              {activeTab === "quiz" && activeVideo.studyPlan?.quiz && activeVideo.studyPlan.quiz.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0f0f11] p-6 text-center">
                  <p className="text-sm text-zinc-400 mb-4">Generate 10 SSC previous-year questions for this topic.</p>
                  <button onClick={() => generateQuizForVideo(activeSubject.id, activeVideo.videoId)} disabled={generatingQuiz}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {generatingQuiz && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                    {generatingQuiz ? "Generating quiz..." : "Generate Quiz"}
                  </button>
                </div>
              )}

              {activeTab === "quiz" && activeVideo.studyPlan?.quiz && activeVideo.studyPlan.quiz.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0f0f11] p-5">
                  <div className="flex gap-2 mb-4">
                    {(["all", "easy", "medium", "hard"] as const).map((f) => (
                      <button key={f} onClick={() => { setQuizFilter(f); setQuizAnswers({}); setQuizSubmitted(false); }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${quizFilter === f ? "bg-white text-black border-white" : "bg-zinc-900 border-white/10 text-zinc-400 hover:bg-zinc-800"}`}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>

                  {quizSubmitted && (
                    <div className={`mb-4 p-4 rounded-lg ${getQuizScore(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter) >= 70 ? "bg-white/5 border border-white/10" : "bg-white/5 border border-white/10"}`}>
                      <p className="font-semibold text-lg text-zinc-50">Score: {getQuizScore(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter)}%</p>
                      <p className="text-sm text-zinc-400">{getQuizCorrect(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter)} / {getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length} correct</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {getFilteredQuiz(activeVideo.studyPlan?.quiz || [], quizFilter).map((q, i) => {
                      const globalIdx = (activeVideo.studyPlan?.quiz || []).indexOf(q);
                      const selected = quizAnswers[globalIdx];
                      return (
                        <div key={globalIdx} className="p-4 rounded-xl border border-white/10 bg-black">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="w-6 h-6 rounded-full bg-white/10 text-zinc-200 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1"><span className="text-[10px] bg-zinc-900 border border-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{q.difficulty}</span>{q.year && <span className="text-[10px] text-zinc-400">{q.exam || 'SSC'} {q.year}</span>}</div>
                              <p className="text-sm font-medium text-zinc-50">{q.question}</p>
                            </div>
                            <NotesButton
                              subject={activeSubject.name}
                              topic={videoMeta?.topic || activeVideo.title}
                              videoId={activeVideo.videoId}
                              contentType="quiz"
                              content={`Q. ${q.question}\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}) ${o}`).join("\n")}\nCorrect Answer: ${String.fromCharCode(65 + q.correctAnswer)}. ${q.options[q.correctAnswer]}${q.explanation ? `\nExplanation: ${q.explanation}` : ""}`}
                            />
                          </div>
                          <div className="ml-9 space-y-2">
                            {q.options.map((opt, j) => {
                              const isSelected = selected === j;
                              let optClass = "border-white/10 hover:border-white/20";
                              if (quizSubmitted && j === q.correctAnswer) optClass = "border-white/40 bg-white/10";
                              else if (quizSubmitted && isSelected && j !== q.correctAnswer) optClass = "border-red-500/50 bg-red-950/30";
                              else if (isSelected) optClass = "border-white/40 bg-white/5";
                              return (
                                <button key={j} onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [globalIdx]: j })} disabled={quizSubmitted}
                                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${optClass} ${quizSubmitted ? "cursor-default" : "cursor-pointer"}`}>
                                  <span className="font-medium text-zinc-400 mr-2">{String.fromCharCode(65 + j)}.</span>
                                  <span className="text-zinc-300">{opt}</span>
                                  {quizSubmitted && j === q.correctAnswer && <span className="ml-2 text-zinc-100">✓</span>}
                                  {quizSubmitted && isSelected && j !== q.correctAnswer && <span className="ml-2 text-red-400">✗</span>}
                                </button>
                              );
                            })}
                            {quizSubmitted && <div className="mt-2 p-3 rounded-lg bg-zinc-900"><p className="text-xs text-zinc-400"><strong>Explanation:</strong> {q.explanation}</p></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-3">
                    {!quizSubmitted ? (
                      <button onClick={() => setQuizSubmitted(true)} disabled={Object.keys(quizAnswers).length < getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length}
                        className="px-6 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Submit ({Object.keys(quizAnswers).length}/{getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length})
                      </button>
                    ) : (
                      <button onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }} className="px-6 py-2.5 bg-zinc-900 border border-white/10 text-zinc-300 rounded-xl font-medium hover:bg-zinc-800 transition-colors">
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Admin Login</h3>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm mb-3"
                autoFocus
              />
              {loginError && <p className="text-xs text-red-500 mb-3">{loginError}</p>}
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-white text-black py-2.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors">
                  Login
                </button>
                <button type="button" onClick={() => { setShowLogin(false); setLoginPassword(""); setLoginError(""); }} className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword}>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm mb-3"
                autoFocus
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 4 characters)"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm mb-3"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm mb-3"
              />
              {changePasswordError && <p className="text-xs text-red-500 mb-3">{changePasswordError}</p>}
              {changePasswordSuccess && <p className="text-xs text-green-500 mb-3">{changePasswordSuccess}</p>}
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-white text-black py-2.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors">
                  Update
                </button>
                <button type="button" onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setChangePasswordError(""); setChangePasswordSuccess(""); }} className="flex-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-3">
        <p className="text-center text-xs text-zinc-400">Powered by AI · Built for SSC Aspirants</p>
      </footer>
    </div>
  );
}

function getChapterSeconds(timestamp: string): number {
  const parts = timestamp.split(":").reverse();
  let s = 0;
  if (parts[0]) s += parseInt(parts[0]);
  if (parts[1]) s += parseInt(parts[1]) * 60;
  if (parts[2]) s += parseInt(parts[2]) * 3600;
  return s;
}

// Parse repetitive title boilerplate into a clean topic + subtitle. Examples:
//   "GK FOR SSC EXAMS 2025 | FRB 2.0 | GEOGRAPHY | SOLAR SYSTEM"
//     -> topic "Solar System", subtitle "Parmar SSC • 30 mins"
//   "GEOGRAPHY FOR SSC EXAMS 2025 | EARTH INTERIOR | FRB 2.0"
//     -> topic "Earth Interior"
//   "HISTORY FOR SSC EXAMS 2025 | ADVENT OF EUROPEANS | FRB 2.0 BY PARMAR SSC"
//     -> topic "Advent of Europeans"
function parseVideoTitle(title: string): { topic: string; author: string; subtitle: string } {
  const parts = title
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const isBoilerplate = (s: string) =>
    /EXAMS|SSC|COURSE|BATCH|CLASS|MAINS|2025|2026|FRB|PARMAR|PRE+G|LIVE|FOR SSC|BY /i.test(s);

  let topic = "";
  if (parts.length >= 2) {
    const meaningful = parts.filter((p) => !isBoilerplate(p));
    topic = meaningful.length ? meaningful[meaningful.length - 1] : parts[parts.length - 1];
  } else {
    topic = title.trim();
  }
  // "LECTURE 2 (LATITUDE LONGITUDE ...)" -> prefer the parenthesized portion
  const lectureMatch = topic.match(/^LECTURE\s*\d+\s*(?:\(([^)]+)\))?/i);
  if (lectureMatch && lectureMatch[1]) topic = lectureMatch[1];

  const author = /PARMAR/i.test(title)
    ? "Parmar SSC"
    : title.match(/BY\s+(.+)$/i)?.[1]?.trim() || "";
  const subtitle = `${author || "SSC GK Series"} • 30 mins`;
  return { topic: titleCase(topic), author, subtitle };
}

function textToSeries(title: string): string {
  if (/FRB\s*2/i.test(title)) return "FRB 2.0";
  if (/FRB/i.test(title)) return "FRB";
  return "";
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function getTimeDiff(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getFilteredQuiz(quiz: QuizQuestion[], filter: string): QuizQuestion[] {
  if (filter === "all") return quiz;
  return quiz.filter((q) => q.difficulty === filter);
}

function getQuizCorrect(quiz: QuizQuestion[], answers: Record<number, number>, filter: string): number {
  return getFilteredQuiz(quiz, filter).filter((q) => answers[quiz.indexOf(q)] === q.correctAnswer).length;
}

function getQuizScore(quiz: QuizQuestion[], answers: Record<number, number>, filter: string): number {
  const filtered = getFilteredQuiz(quiz, filter);
  if (filtered.length === 0) return 0;
  return Math.round((getQuizCorrect(quiz, answers, filter) / filtered.length) * 100);
}
