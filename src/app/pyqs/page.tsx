"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PYQCard from "@/components/PYQCard";
import { showToast } from "@/lib/toast";
import type { PYQ } from "@/lib/pyqs";

const SUBJECTS = [
  "Quantitative Aptitude",
  "Reasoning",
  "English Comprehension",
  "General Awareness",
];

const TOPICS_BY_SUBJECT: Record<string, string[]> = {
  "Quantitative Aptitude": [
    "Percentage",
    "Profit & Loss",
    "Simple & Compound Interest",
    "Time & Work",
    "Ratio & Proportion",
    "Algebra",
    "Mensuration",
    "Number System",
    "Time Speed Distance",
    "Average",
  ],
  Reasoning: [
    "Syllogism",
    "Analogy",
    "Coding-Decoding",
    "Blood Relations",
    "Number Series",
    "Direction Sense",
    "Venn Diagram",
    "Coding-Decoding",
    "Mirror Image",
    "Paper Folding",
  ],
  "English Comprehension": [
    "Error Spotting",
    "Synonyms",
    "Antonyms",
    "Idioms & Phrases",
    "Fill in the Blanks",
    "Sentence Improvement",
    "One Word Substitution",
    "Spelling Error",
    "Cloze Test",
    "Active Passive",
  ],
  "General Awareness": [
    "Indian Polity",
    "Modern History",
    "Geography",
    "Economics",
    "Science & Technology",
    "Ancient History",
    "Static GK",
    "Art & Culture",
    "Sports",
    "Awards & Honours",
  ],
};

const YEAR_RANGES = [
  { value: "all", label: "All 20 Years" },
  { value: "recent", label: "2018–2024" },
  { value: "old", label: "2010–2017" },
];

const TIERS = ["All Tiers", "Tier 1", "Tier 2"];

export default function PYQsPage() {
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [yearRange, setYearRange] = useState("all");
  const [tier, setTier] = useState("All Tiers");
  const [pyqs, setPYQs] = useState<PYQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  const topics = useMemo(() => {
    const all = TOPICS_BY_SUBJECT[subject] || [];
    const q = topicSearch.trim().toLowerCase();
    return q ? all.filter((t) => t.toLowerCase().includes(q)) : all;
  }, [subject, topicSearch]);

  const loadPYQs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("subject", subject);
      if (topic) params.set("topic", topic);
      if (yearRange !== "all") params.set("yearRange", yearRange);
      if (tier !== "All Tiers") params.set("tier", tier);
      const res = await fetch(`/api/pyq?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load PYQs");
      setPYQs(data?.pyqs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PYQs");
    } finally {
      setLoading(false);
    }
  }, [subject, topic, yearRange, tier]);

  useEffect(() => {
    loadPYQs();
  }, [loadPYQs]);

  useEffect(() => {
    setTopic("");
    setTopicSearch("");
  }, [subject]);

  async function generateMore() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/pyq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topic: topic || "General",
          year: yearRange === "old" ? 2014 : 2022,
          tier: tier !== "All Tiers" ? tier : "Tier 1",
          count: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      if (data?.added === 0) {
        showToast("All generated questions already exist in the bank", "error");
      } else {
        showToast(`Generated & saved ${data.added} new PYQs`);
        loadPYQs();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate PYQs", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
              </svg>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Study Planner</h1>
            </Link>
            <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">·</span>
            <span className="hidden sm:inline text-sm text-zinc-300 dark:text-zinc-300 font-medium">20Y PYQ Bank</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/notes" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              My Notes
            </Link>
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Home
            </Link>
            <Link href="/mock-test" className="text-sm bg-zinc-900 dark:bg-zinc-800 text-zinc-300 border border-white/10 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
              Mock Tests
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">20 Years PYQ Bank</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real SSC CGL previous-year questions grouped by subject & topic. New questions can be AI-generated on demand.
          </p>
        </div>

        {/* Subject tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                subject === s
                  ? "bg-white text-black border border-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-white/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div className="relative">
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Topic</label>
            <input
              type="text"
              value={topicSearch}
              onChange={(e) => { setTopicSearch(e.target.value); setShowTopicDropdown(true); }}
              onFocus={() => setShowTopicDropdown(true)}
              onBlur={() => setTimeout(() => setShowTopicDropdown(false), 150)}
              placeholder="Search / select topic…"
              className="w-56 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-400 outline-none focus:border-white/50"
            />
            {showTopicDropdown && topics.length > 0 && (
              <div className="absolute z-20 mt-1 w-56 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                {topic === "" && (
                  <button
                    onMouseDown={() => { setTopic(""); setTopicSearch(""); setShowTopicDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    All topics
                  </button>
                )}
                {topics.map((t) => (
                  <button
                    key={t}
                    onMouseDown={() => { setTopic(t); setTopicSearch(t); setShowTopicDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      topic === t ? "text-zinc-900 dark:text-zinc-50 font-medium" : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Year Range</label>
            <div className="flex gap-1">
              {YEAR_RANGES.map((y) => (
                <button
                  key={y.value}
                  onClick={() => setYearRange(y.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    yearRange === y.value
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                  }`}
                >
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Tier</label>
            <div className="flex gap-1">
              {TIERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    tier === t
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateMore}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors self-end"
          >
            {generating ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {generating ? "Generating PYQs…" : "Generate More PYQs"}
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
            <button onClick={loadPYQs} className="ml-3 underline">Retry</button>
          </div>
        )}

        <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading questions…
            </span>
          ) : (
            <span>
              {pyqs.length} question{pyqs.length === 1 ? "" : "s"}
              {topic && <> for <strong className="text-zinc-700 dark:text-zinc-200">{topic}</strong></>}
              {yearRange !== "all" && <> · {YEAR_RANGES.find((y) => y.value === yearRange)?.label}</>}
              {tier !== "All Tiers" && <> · {tier}</>}
            </span>
          )}
        </div>

        {!loading && !error && pyqs.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">No questions found for these filters.</p>
            <p className="text-sm text-zinc-400 mb-4">Generate fresh SSC CGL PYQs for this topic on the fly.</p>
            <button
              onClick={generateMore}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating…" : `Generate PYQs for ${topic || subject}`}
            </button>
          </div>
        )}

        {!loading && !error && pyqs.length > 0 && (
          <div className="space-y-3">
            {pyqs.map((pyq) => (
              <PYQCard key={pyq.id} pyq={pyq} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}