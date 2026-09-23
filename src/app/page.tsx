"use client";

import { useState } from "react";

interface Chapter {
  title: string;
  timestamp: string;
  startSeconds: number;
}

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  description: string;
  chapters: Chapter[];
}

interface StudyChapter {
  title: string;
  timestamp: string;
  keyConcepts: string[];
  notes: string;
}

interface StudyPlan {
  summary: string;
  keyTopics: string[];
  chapters: StudyChapter[];
  revisionPoints: string[];
  difficulty: string;
  estimatedStudyTime: string;
}

interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

interface PlaylistInfo {
  playlistId: string;
  title: string;
  videos: PlaylistVideo[];
}

interface ScheduleEntry {
  chapterIndex: number;
  chapterTitle: string;
  date: string;
  time: string;
  completed: boolean;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setVideoInfo(null);
    setStudyPlan(null);
    setPlaylist(null);
    setSelectedVideo(null);
    setSchedule([]);
    setShowSchedule(false);

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate study plan");
      }

      if (data.type === "playlist") {
        setPlaylist(data.playlist);
      } else {
        setVideoInfo(data.videoInfo);
        setStudyPlan(data.studyPlan);
        initSchedule(data.studyPlan);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVideoSelect(videoId: string) {
    if (!playlist) return;

    setLoading(true);
    setError("");
    setSelectedVideo(videoId);
    setSchedule([]);
    setShowSchedule(false);

    try {
      const res = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), videoId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate study plan");
      }

      setVideoInfo(data.videoInfo);
      setStudyPlan(data.studyPlan);
      initSchedule(data.studyPlan);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function initSchedule(plan: StudyPlan) {
    const today = new Date();
    const entries: ScheduleEntry[] = plan.chapters.map((ch, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      return {
        chapterIndex: i,
        chapterTitle: ch.title,
        date: date.toISOString().split("T")[0],
        time: "09:00",
        completed: false,
      };
    });
    setSchedule(entries);
  }

  function handleBackToPlaylist() {
    setVideoInfo(null);
    setStudyPlan(null);
    setSelectedVideo(null);
    setSchedule([]);
    setShowSchedule(false);
    setError("");
  }

  function updateScheduleDate(index: number, date: string) {
    setSchedule((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, date } : entry))
    );
  }

  function updateScheduleTime(index: number, time: string) {
    setSchedule((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, time } : entry))
    );
  }

  function toggleCompleted(index: number) {
    setSchedule((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, completed: !entry.completed } : entry
      )
    );
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black font-sans">
      <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            YouTube Study Planner
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <form onSubmit={handleSubmit} className="mb-8">
          <label
            htmlFor="youtube-url"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Paste a YouTube video or playlist URL
          </label>
          <div className="flex gap-3">
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or playlist URL"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-red-600 px-6 py-3 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Study Plan"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-4 py-3 mb-6 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {playlist && !videoInfo && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {playlist.title}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                {playlist.videos.length} videos — select one to generate a study plan
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlist.videos.map((video) => (
                <button
                  key={video.videoId}
                  onClick={() => handleVideoSelect(video.videoId)}
                  disabled={loading && selectedVideo === video.videoId}
                  className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all disabled:opacity-60"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2">
                      {video.title}
                    </h3>
                    {loading && selectedVideo === video.videoId && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Generating study plan...
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {videoInfo && studyPlan && (
          <div className="space-y-8">
            {playlist && (
              <button
                onClick={handleBackToPlaylist}
                className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                ← Back to playlist ({playlist.title})
              </button>
            )}

            <section className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${videoInfo.videoId}?start=${activeChapter !== null && studyPlan.chapters[activeChapter] ? getChapterSeconds(studyPlan.chapters[activeChapter].timestamp) : 0}`}
                  title={videoInfo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <div className="bg-white dark:bg-zinc-900 px-5 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {videoInfo.title}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    by {videoInfo.author}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-blue-700 dark:text-blue-300 font-medium">
                    {studyPlan.difficulty}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-3 py-1 text-green-700 dark:text-green-300 font-medium">
                    {studyPlan.estimatedStudyTime}
                  </span>
                </div>
              </div>
            </section>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${
                  showSchedule
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {showSchedule ? "Hide Schedule" : "View Study Schedule"}
              </button>
            </div>

            {showSchedule && schedule.length > 0 && (
              <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Study Schedule
                </h3>
                <div className="space-y-3">
                  {schedule.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 p-3 rounded-lg border ${
                        entry.completed
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <button
                        onClick={() => toggleCompleted(i)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          entry.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-zinc-300 dark:border-zinc-600 hover:border-green-400"
                        }`}
                      >
                        {entry.completed && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          entry.completed
                            ? "text-green-700 dark:text-green-300 line-through"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}>
                          {entry.chapterTitle}
                        </p>
                      </div>
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateScheduleDate(i, e.target.value)}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      />
                      <input
                        type="time"
                        value={entry.time}
                        onChange={(e) => updateScheduleTime(i, e.target.value)}
                        className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Progress: {schedule.filter((s) => s.completed).length} / {schedule.length} chapters completed
                  </p>
                  <div className="mt-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(schedule.filter((s) => s.completed).length / schedule.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Summary
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {studyPlan.summary}
              </p>
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Key Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {studyPlan.keyTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Study Chapters
              </h3>
              <div className="space-y-4">
                {studyPlan.chapters.map((chapter, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border cursor-pointer transition-all ${
                      activeChapter === i
                        ? "border-red-400 dark:border-red-600 shadow-md"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    } bg-white dark:bg-zinc-900 p-5`}
                    onClick={() => setActiveChapter(activeChapter === i ? null : i)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded">
                        {chapter.timestamp}
                      </span>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 flex-1">
                        {chapter.title}
                      </h4>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {activeChapter === i ? "Click to stop" : "Click to play"}
                      </span>
                    </div>
                    <div className="ml-11">
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {chapter.keyConcepts.map((concept, j) => (
                          <span
                            key={j}
                            className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                        {chapter.notes}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Revision Points
              </h3>
              <ul className="space-y-2">
                {studyPlan.revisionPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">&#10003;</span>
                    <span className="text-zinc-600 dark:text-zinc-400 text-sm">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-4">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Powered by YouTube Data API &amp; Google Gemini AI
        </p>
      </footer>
    </div>
  );
}

function getChapterSeconds(timestamp: string): number {
  const parts = timestamp.split(":").reverse();
  let seconds = 0;
  if (parts[0]) seconds += parseInt(parts[0]);
  if (parts[1]) seconds += parseInt(parts[1]) * 60;
  if (parts[2]) seconds += parseInt(parts[2]) * 3600;
  return seconds;
}
