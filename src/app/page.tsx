"use client";

import { useState, useEffect } from "react";

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
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-yellow-500",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizFilter, setQuizFilter] = useState<"all" | "easy" | "medium" | "hard">("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("yt-study-subjects");
      if (saved) setSubjects(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("yt-study-subjects", JSON.stringify(subjects));
    } catch {}
  }, [subjects]);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) || null;
  const activeVideo = activeSubject?.videos.find((v) => v.videoId === activeVideoId) || null;

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
  }

  function deleteSubject(id: string) {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
      setActiveVideoId(null);
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

        const existingIds = new Set(
          subjects.find((s) => s.id === subjectId)?.videos.map((v) => v.videoId) || []
        );

        const newVideos: SubjectVideo[] = [];
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (!existingIds.has(video.videoId)) {
            newVideos.push({
              videoId: video.videoId,
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              studyPlan: null,
            });
          }
          setPlaylistProgress({ current: i + 1, total: videos.length, title: data.playlist.title });
        }

        if (newVideos.length > 0) {
          setSubjects((prev) =>
            prev.map((s) => (s.id === subjectId ? { ...s, videos: [...s.videos, ...newVideos] } : s))
          );
        }

        setPlaylistProgress(null);
        setUrl("");
      } else {
        const newVideo: SubjectVideo = {
          videoId: data.videoInfo.videoId,
          title: data.videoInfo.title,
          thumbnailUrl: data.videoInfo.thumbnailUrl,
          studyPlan: data.studyPlan,
        };
        setSubjects((prev) =>
          prev.map((s) => (s.id === subjectId ? { ...s, videos: [...s.videos, newVideo] } : s))
        );
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

  async function generateStudyPlanForVideo(subjectId: string, videoId: string) {
    setGeneratingPlan(videoId);
    setError("");

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://youtube.com/watch?v=${videoId}` }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate study plan");

      setSubjects((prev) =>
        prev.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            videos: s.videos.map((v) =>
              v.videoId === videoId
                ? { ...v, studyPlan: data.studyPlan }
                : v
            ),
          };
        })
      );
      setActiveVideoId(videoId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate study plan");
    } finally {
      setGeneratingPlan(null);
    }
  }

  function removeVideo(subjectId: string, videoId: string) {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        return { ...s, videos: s.videos.filter((v) => v.videoId !== videoId) };
      })
    );
    if (activeVideoId === videoId) setActiveVideoId(null);
  }

  function handleVideoClick(subjectId: string, video: SubjectVideo) {
    if (video.studyPlan) {
      setActiveVideoId(video.videoId);
    } else {
      generateStudyPlanForVideo(subjectId, video.videoId);
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black font-sans">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
            </svg>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">YouTube Study Planner</h1>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {subjects.length} subjects · {subjects.reduce((a, s) => a + s.videos.length, 0)} videos
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full overflow-hidden">
        <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Subjects</h2>
              <button
                onClick={() => setShowNewSubject(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {showNewSubject && (
              <div className="mb-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Subject name..."
                  className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-zinc-800 mb-2"
                  onKeyDown={(e) => e.key === "Enter" && createSubject()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={createSubject} className="flex-1 text-xs bg-red-600 text-white py-1.5 rounded hover:bg-red-700">Create</button>
                  <button onClick={() => setShowNewSubject(false)} className="flex-1 text-xs bg-zinc-200 dark:bg-zinc-700 py-1.5 rounded">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  onClick={() => { setActiveSubjectId(subject.id); setActiveVideoId(null); }}
                  className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    activeSubjectId === subject.id
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${subject.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{subject.name}</p>
                    <p className="text-[10px] text-zinc-400">{subject.videos.length} videos</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSubject(subject.id); }}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!activeSubject ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Create a Subject</h2>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                Click the <span className="text-red-600 font-medium">+</span> button above to create a subject, then add YouTube videos or playlists.
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${activeSubject.color}`} />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{activeSubject.name}</h2>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube video or playlist URL..."
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addVideoToSubject(activeSubject.id)}
                />
                <button
                  onClick={() => addVideoToSubject(activeSubject.id)}
                  disabled={loading || !url.trim()}
                  className="rounded-lg bg-red-600 px-5 py-3 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading && addingToSubject === activeSubject.id ? "Adding..." : "Add"}
                </button>
                <button
                  onClick={() => setShowSchedule(!showSchedule)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    showSchedule ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  Schedule
                </button>
              </div>

              {playlistProgress && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Importing: {playlistProgress.title}
                    </span>
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {playlistProgress.current}/{playlistProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(playlistProgress.current / playlistProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 text-red-700 dark:text-red-300 text-sm">{error}</div>
              )}

              {showSchedule && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Weekly Schedule for {activeSubject.name}
                  </h3>
                  <div className="space-y-2">
                    {activeSubject.schedule.map((entry, i) => (
                      <div key={entry.day} className="flex items-center gap-4">
                        <span className="w-24 text-sm font-medium text-zinc-700 dark:text-zinc-300">{entry.day}</span>
                        <input
                          type="time"
                          value={entry.startTime}
                          onChange={(e) => updateSubjectSchedule(activeSubject.id, i, "startTime", e.target.value)}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800"
                        />
                        <span className="text-zinc-400">to</span>
                        <input
                          type="time"
                          value={entry.endTime}
                          onChange={(e) => updateSubjectSchedule(activeSubject.id, i, "endTime", e.target.value)}
                          className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800"
                        />
                        {entry.startTime && entry.endTime && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {getTimeDiff(entry.startTime, entry.endTime)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeVideo && activeVideo.studyPlan && (
                <div className="space-y-6">
                  <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <div className="aspect-video w-full">
                      <iframe
                        src={`https://www.youtube.com/embed/${activeVideo.videoId}?start=${activeChapter !== null ? getChapterSeconds(activeVideo.studyPlan.chapters[activeChapter].timestamp) : 0}`}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                    <div className="bg-white dark:bg-zinc-900 px-5 py-3 flex items-center justify-between">
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-50">{activeVideo.title}</h3>
                      <div className="flex gap-2">
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">{activeVideo.studyPlan.difficulty}</span>
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">{activeVideo.studyPlan.estimatedStudyTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Summary</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{activeVideo.studyPlan.summary}</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Key Topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {activeVideo.studyPlan.keyTopics.map((t, i) => (
                        <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Chapters</h3>
                    <div className="space-y-3">
                      {activeVideo.studyPlan.chapters.map((ch, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveChapter(activeChapter === i ? null : i)}
                          className={`rounded-xl border cursor-pointer transition-all p-4 ${
                            activeChapter === i ? "border-red-400 dark:border-red-600 shadow-md" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                          } bg-white dark:bg-zinc-900`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{ch.timestamp}</span>
                            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-50 flex-1">{ch.title}</span>
                            <span className="text-[10px] text-zinc-400">{activeChapter === i ? "Playing" : "Play"}</span>
                          </div>
                          <div className="ml-10">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {ch.keyConcepts.map((c, j) => (
                                <span key={j} className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">{c}</span>
                              ))}
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{ch.notes}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Revision Points</h3>
                    <ul className="space-y-1.5">
                      {activeVideo.studyPlan.revisionPoints.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span className="text-green-500 mt-0.5">✓</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {activeVideo.studyPlan?.lastYearNotes && activeVideo.studyPlan.lastYearNotes.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 p-5">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Last Year Important Notes (SSC Exams2020-2025)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeVideo.studyPlan.lastYearNotes.map((note, i) => (
                          <div key={i} className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-50">{note.topic}</h4>
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{note.frequency}</span>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">{note.notes}</p>
                            <div className="flex flex-wrap gap-1">
                              {note.exams.map((exam, j) => (
                                <span key={j} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">{exam}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeVideo.studyPlan?.predictedTopics && activeVideo.studyPlan.predictedTopics.length > 0 && (
                    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-5">
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Predicted Important Topics for2025-2026SSC Exams
                      </h3>
                      <div className="space-y-3">
                        {activeVideo.studyPlan.predictedTopics.map((topic, i) => {
                          const probColor = topic.probability === "High" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : topic.probability === "Medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
                          return (
                            <div key={i} className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-50 flex-1">{topic.topic}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${probColor}`}>{topic.probability}</span>
                              </div>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1 ml-9"><strong>Why:</strong> {topic.reason}</p>
                              <p className="text-xs text-purple-600 dark:text-purple-400 ml-9"><strong>Tip:</strong> {topic.preparationTip}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeVideo.studyPlan?.quiz && activeVideo.studyPlan?.quiz.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          SSC CGL Quiz ({activeVideo.studyPlan?.quiz.length} questions)
                        </h3>
                        <div className="flex gap-2">
                          {(["all", "easy", "medium", "hard"] as const).map((f) => (
                            <button
                              key={f}
                              onClick={() => { setQuizFilter(f); setQuizAnswers({}); setQuizSubmitted(false); }}
                              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                quizFilter === f
                                  ? f === "easy" ? "bg-green-500 text-white" : f === "medium" ? "bg-yellow-500 text-white" : f === "hard" ? "bg-red-500 text-white" : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {quizSubmitted && (
                        <div className={`mb-4 p-4 rounded-lg ${
                          getQuizScore(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter) >= 70
                            ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                            : "bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800"
                        }`}>
                          <p className="font-semibold text-lg">
                            Score: {getQuizScore(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter)}%
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {getQuizCorrect(activeVideo.studyPlan?.quiz, quizAnswers, quizFilter)} / {getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length} correct
                          </p>
                        </div>
                      )}

                      <div className="space-y-4">
                        {getFilteredQuiz(activeVideo.studyPlan?.quiz || [], quizFilter).map((q, i) => {
                          const globalIdx = (activeVideo.studyPlan?.quiz || []).indexOf(q);
                          const selected = quizAnswers[globalIdx];
                          const isCorrect = selected === q.correctAnswer;
                          const diffColor = q.difficulty === "easy" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : q.difficulty === "medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300" : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";

                          return (
                            <div key={globalIdx} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                              <div className="flex items-start gap-3 mb-3">
                                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${diffColor}`}>{q.difficulty}</span>
                                    {q.year && <span className="text-[10px] text-zinc-400">{q.exam || 'SSC'} {q.year}</span>}
                                  </div>
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{q.question}</p>
                                </div>
                              </div>
                              <div className="ml-9 space-y-2">
                                {q.options.map((opt, j) => {
                                  const isSelected = selected === j;
                                  const showResult = quizSubmitted;
                                  let optClass = "border-zinc-200 dark:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-500";
                                  if (showResult && j === q.correctAnswer) optClass = "border-green-500 bg-green-50 dark:bg-green-950";
                                  else if (showResult && isSelected && j !== q.correctAnswer) optClass = "border-red-500 bg-red-50 dark:bg-red-950";
                                  else if (isSelected) optClass = "border-purple-500 bg-purple-50 dark:bg-purple-950";

                                  return (
                                    <button
                                      key={j}
                                      onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [globalIdx]: j })}
                                      disabled={quizSubmitted}
                                      className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${optClass} ${quizSubmitted ? "cursor-default" : "cursor-pointer"}`}
                                    >
                                      <span className="font-medium text-zinc-500 mr-2">{String.fromCharCode(65 + j)}.</span>
                                      {opt}
                                      {showResult && j === q.correctAnswer && <span className="ml-2 text-green-600">✓</span>}
                                      {showResult && isSelected && j !== q.correctAnswer && <span className="ml-2 text-red-600">✗</span>}
                                    </button>
                                  );
                                })}
                                {quizSubmitted && (
                                  <div className="mt-2 p-3 rounded bg-zinc-100 dark:bg-zinc-700">
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400"><strong>Explanation:</strong> {q.explanation}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex gap-3">
                        {!quizSubmitted ? (
                          <button
                            onClick={() => setQuizSubmitted(true)}
                            disabled={Object.keys(quizAnswers).length < getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length}
                            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Submit Quiz ({Object.keys(quizAnswers).length}/{getFilteredQuiz(activeVideo.studyPlan?.quiz, quizFilter).length} answered)
                          </button>
                        ) : (
                          <button
                            onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }}
                            className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                          >
                            Retry Quiz
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSubject.videos.length > 0 && !activeVideoId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSubject.videos.map((video) => (
                    <div
                      key={video.videoId}
                      className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                    >
                      <div onClick={() => handleVideoClick(activeSubject.id, video)}>
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full aspect-video object-cover" />
                        <div className="p-3">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2">{video.title}</h3>
                          {generatingPlan === video.videoId ? (
                            <div className="flex items-center gap-2 mt-2">
                              <svg className="animate-spin h-3 w-3 text-red-500" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              <span className="text-[10px] text-red-500">Generating study plan...</span>
                            </div>
                          ) : video.studyPlan ? (
                            <div className="flex gap-2 mt-2">
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{video.studyPlan.difficulty}</span>
                              <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">{video.studyPlan.estimatedStudyTime}</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-zinc-400 mt-1">Click to generate study plan</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeVideo(activeSubject.id, video.videoId); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeSubject.videos.length === 0 && (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No videos yet. Paste a YouTube URL or playlist above.</p>
                </div>
              )}

              {activeVideoId && (
                <button
                  onClick={() => { setActiveVideoId(null); setActiveChapter(null); }}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  ← Back to all videos
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-3">
        <p className="text-center text-xs text-zinc-400">Powered by YouTube Data API & Groq AI</p>
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
  const filtered = getFilteredQuiz(quiz, filter);
  return filtered.filter((q, i) => {
    const globalIdx = quiz.indexOf(q);
    return answers[globalIdx] === q.correctAnswer;
  }).length;
}

function getQuizScore(quiz: QuizQuestion[], answers: Record<number, number>, filter: string): number {
  const filtered = getFilteredQuiz(quiz, filter);
  if (filtered.length === 0) return 0;
  const correct = getQuizCorrect(quiz, answers, filter);
  return Math.round((correct / filtered.length) * 100);
}
