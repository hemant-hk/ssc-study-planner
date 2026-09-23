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

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setVideoInfo(null);
    setStudyPlan(null);

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

      setVideoInfo(data.videoInfo);
      setStudyPlan(data.studyPlan);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
            Paste a YouTube video URL
          </label>
          <div className="flex gap-3">
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
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

        {videoInfo && studyPlan && (
          <div className="space-y-8">
            <section className="flex gap-5 items-start">
              <img
                src={videoInfo.thumbnailUrl}
                alt={videoInfo.title}
                className="w-64 rounded-lg shadow-md"
              />
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
                  {videoInfo.title}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mb-3">
                  by {videoInfo.author}
                </p>
                <div className="flex gap-3 text-sm">
                  <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-blue-700 dark:text-blue-300 font-medium">
                    {studyPlan.difficulty}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-3 py-1 text-green-700 dark:text-green-300 font-medium">
                    {studyPlan.estimatedStudyTime}
                  </span>
                </div>
              </div>
            </section>

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
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded">
                        {chapter.timestamp}
                      </span>
                      <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {chapter.title}
                      </h4>
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
