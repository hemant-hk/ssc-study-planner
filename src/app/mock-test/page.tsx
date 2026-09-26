"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
}

interface Section {
  name: string;
  questions: Question[];
}

type TestMode = "menu" | "topic" | "subject" | "full" | "running" | "result";

export default function MockTest() {
  const [mode, setMode] = useState<TestMode>("menu");
  const [testType, setTestType] = useState<"topic" | "subject" | "full">("topic");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testStarted, setTestStarted] = useState(false);

  const subjects = [
    { name: "General Studies", topics: ["History", "Geography", "Polity", "Economics", "Science", "Current Affairs"] },
    { name: "Reasoning", topics: ["Analogy", "Classification", "Series", "Coding-Decoding", "Blood Relations", "Direction Sense", "Syllogism", "Matrix", "Venn Diagram", "Paper Folding"] },
    { name: "Mathematics", topics: ["Number System", "HCF & LCM", "Percentage", "Profit & Loss", "Simple Interest", "Compound Interest", "Ratio & Proportion", "Time & Work", "Time Speed Distance", "Algebra", "Geometry", "Trigonometry", "Mensuration", "Statistics"] },
    { name: "English", topics: ["Reading Comprehension", "Fill in the Blanks", "Synonyms", "Antonyms", "Spelling Error", "Idioms & Phrases", "One Word Substitution", "Sentence Improvement", "Active Passive", "Direct Indirect", "Cloze Test", "Error Spotting"] },
  ];

  const startTest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mock-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: testType, subject, topic, sections: testType === "full" ? ["General Studies", "Reasoning", "Mathematics", "English"] : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate test");

      if (testType === "full") {
        setSections(data.sections || []);
        setCurrentSection(0);
        setCurrentQuestion(0);
        setSectionTimeLeft(15 * 60);
        setTimeLeft(60 * 60);
      } else {
        setQuestions(data.questions || []);
        setCurrentQuestion(0);
        setTimeLeft(15 * 60);
      }
      setAnswers({});
      setTestStarted(true);
      setMode("running");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start test");
    } finally {
      setLoading(false);
    }
  }, [testType, subject, topic]);

  useEffect(() => {
    if (!testStarted || mode !== "running") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { submitTest(); return 0; }
        return prev - 1;
      });
      if (testType === "full") {
        setSectionTimeLeft((prev) => {
          if (prev <= 1) {
            if (currentSection < 3) { nextSection(); return 15 * 60; }
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [testStarted, mode, testType, currentSection]);

  function submitTest() {
    setTestStarted(false);
    setMode("result");
  }

  function nextSection() {
    if (currentSection < 3) {
      setCurrentSection((prev) => prev + 1);
      setCurrentQuestion(0);
      setSectionTimeLeft(15 * 60);
    }
  }

  function selectAnswer(qIndex: number, option: number) {
    const key = testType === "full" ? `${currentSection}-${currentQuestion}` : `${currentQuestion}`;
    setAnswers((prev) => ({ ...prev, [key]: option }));
  }

  function getAnswer(qIndex: number) {
    const key = testType === "full" ? `${currentSection}-${qIndex}` : `${qIndex}`;
    return answers[key];
  }

  function getCurrentQuestions(): Question[] {
    if (testType === "full") return sections[currentSection]?.questions || [];
    return questions;
  }

  function getResults() {
    if (testType === "full") {
      return sections.map((sec, si) => {
        const correct = sec.questions.filter((q, qi) => answers[`${si}-${qi}`] === q.correctAnswer).length;
        return { name: sec.name, total: sec.questions.length, correct, wrong: sec.questions.filter((_, qi) => answers[`${si}-${qi}`] !== undefined && answers[`${si}-${qi}`] !== sec.questions[qi].correctAnswer).length, unanswered: sec.questions.filter((_, qi) => answers[`${si}-${qi}`] === undefined).length };
      });
    }
    const correct = questions.filter((q, i) => answers[`${i}`] === q.correctAnswer).length;
    return [{ name: subject || topic, total: questions.length, correct, wrong: questions.filter((_, i) => answers[`${i}`] !== undefined && answers[`${i}`] !== questions[i].correctAnswer).length, unanswered: questions.filter((_, i) => answers[`${i}`] === undefined).length }];
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (mode === "menu") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-6 block">← Back to Study Planner</Link>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Mock Tests</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">SSC CGL style mock tests with real-time timer</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold mb-4">Topic Test</h2>
              <p className="text-sm text-zinc-500 mb-4">25 questions · 15 minutes</p>
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); }} className="w-full mb-3 p-2 border rounded-lg bg-white dark:bg-zinc-800 text-sm">
                <option value="">Select Subject</option>
                {subjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              {subject && (
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full mb-4 p-2 border rounded-lg bg-white dark:bg-zinc-800 text-sm">
                  <option value="">Select Topic</option>
                  {subjects.find((s) => s.name === subject)?.topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <button onClick={() => { setTestType("topic"); startTest(); }} disabled={!subject || !topic || loading} className="w-full py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50">
                {loading ? "Generating..." : "Start Topic Test"}
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold mb-4">Subject Test</h2>
              <p className="text-sm text-zinc-500 mb-4">25 questions · 15 minutes</p>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full mb-4 p-2 border rounded-lg bg-white dark:bg-zinc-800 text-sm">
                <option value="">Select Subject</option>
                {subjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <button onClick={() => { setTestType("subject"); startTest(); }} disabled={!subject || loading} className="w-full py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50">
                {loading ? "Generating..." : "Start Subject Test"}
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0f0f11] p-6">
              <h2 className="text-lg font-semibold mb-2">Full SSC CGL Mock</h2>
              <p className="text-sm text-zinc-500 mb-2">100 questions · 60 minutes</p>
              <div className="text-xs text-zinc-500 mb-4 space-y-1">
                <p>• General Studies: 25Q · 15min</p>
                <p>• Reasoning: 25Q · 15min</p>
                <p>• Mathematics: 25Q · 15min</p>
                <p>• English: 25Q · 15min</p>
              </div>
              <button onClick={() => { setTestType("full"); startTest(); }} disabled={loading} className="w-full py-2.5 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50">
                {loading ? "Generating..." : "Start Full Mock Test"}
              </button>
            </div>
          </div>

          {error && <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">{error}</div>}
        </div>
      </div>
    );
  }

  if (mode === "running") {
    const qs = getCurrentQuestions();
    const q = qs[currentQuestion];
    if (!q) return <div className="min-h-screen flex items-center justify-center"><p>Loading questions...</p></div>;

    const selected = getAnswer(currentQuestion);
    const totalQ = testType === "full" ? 100 : 25;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-sm">{testType === "full" ? `Section: ${sections[currentSection]?.name}` : `${subject} - ${topic || "Subject Test"}`}</span>
            {testType === "full" && (
              <div className="flex gap-2">
                {sections.map((s, i) => (
                  <button key={i} onClick={() => { setCurrentSection(i); setCurrentQuestion(0); setSectionTimeLeft(15 * 60); }}
                    className={`text-xs px-3 py-1 rounded-full ${i === currentSection ? "bg-white text-black" : i < currentSection ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm"><span className="text-zinc-500">Answered:</span> <span className="font-semibold">{answeredCount}/{totalQ}</span></div>
            {testType === "full" && (
              <div className="text-sm"><span className="text-zinc-500">Section:</span> <span className={`font-semibold ${sectionTimeLeft < 120 ? "text-amber-400" : ""}`}>{formatTime(sectionTimeLeft)}</span></div>
            )}
            <div className={`text-lg font-bold ${timeLeft < 300 ? "text-amber-400" : "text-zinc-900 dark:text-zinc-50"}`}>{formatTime(timeLeft)}</div>
            <button onClick={submitTest} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200">Submit</button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-bold flex items-center justify-center">{currentQuestion + 1}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${q.difficulty === "easy" ? "bg-green-100 dark:bg-green-900 text-green-700" : q.difficulty === "medium" ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700" : "bg-red-100 dark:bg-red-900 text-red-700"}`}>{q.difficulty}</span>
            </div>
            <p className="text-base font-medium text-zinc-900 dark:text-zinc-50 mb-6">{q.question}</p>
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => selectAnswer(currentQuestion, i)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${selected === i ? "border-white/50 bg-white/10" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"}`}>
                  <span className="font-medium text-zinc-500 mr-3">{String.fromCharCode(65 + i)}.</span>{opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))} disabled={currentQuestion === 0}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm disabled:opacity-50">← Previous</button>
            <div className="flex gap-2 flex-wrap justify-center">
              {qs.map((_, i) => (
                <button key={i} onClick={() => setCurrentQuestion(i)}
                  className={`w-8 h-8 rounded text-xs font-medium ${i === currentQuestion ? "bg-white text-black" : getAnswer(i) !== undefined ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => {
              if (currentQuestion < qs.length - 1) setCurrentQuestion((p) => p + 1);
              else if (testType === "full" && currentSection < 3) nextSection();
            }} disabled={currentQuestion >= qs.length - 1 && (testType !== "full" || currentSection >= 3)}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm disabled:opacity-50">Next →</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "result") {
    const results = getResults();
    const totalCorrect = results.reduce((a, r) => a + r.correct, 0);
    const totalWrong = results.reduce((a, r) => a + r.wrong, 0);
    const totalUnanswered = results.reduce((a, r) => a + r.unanswered, 0);
    const totalQ = results.reduce((a, r) => a + r.total, 0);
    const score = totalCorrect * 2 - totalWrong * 0.5;
    const maxScore = totalQ * 2;
    const percentage = Math.round((totalCorrect / totalQ) * 100);

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Test Results</h1>
            <div className={`text-6xl font-bold ${percentage >= 70 ? "text-emerald-400" : percentage >= 50 ? "text-amber-400" : "text-red-400"}`}>{percentage}%</div>
            <p className="text-zinc-500 mt-2">Score: {score}/{maxScore}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 dark:bg-green-950 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-600">{totalCorrect}</p><p className="text-xs text-green-700 dark:text-green-300">Correct</p></div>
            <div className="bg-red-50 dark:bg-red-950 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-600">{totalWrong}</p><p className="text-xs text-red-700 dark:text-red-300">Wrong</p></div>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-zinc-600">{totalUnanswered}</p><p className="text-xs text-zinc-500">Unanswered</p></div>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-600">{totalQ}</p><p className="text-xs text-blue-700 dark:text-blue-300">Total</p></div>
          </div>

          {results.length > 1 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 mb-8">
              <h2 className="font-semibold mb-4">Section-wise Analysis</h2>
              <div className="space-y-3">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-32 text-sm font-medium">{r.name}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-4 overflow-hidden">
                      <div className="bg-emerald-400 h-4 rounded-full" style={{ width: `${(r.correct / r.total) * 100}%` }} />
                    </div>
                    <span className="text-sm text-zinc-500 w-20 text-right">{r.correct}/{r.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 mb-8">
            {results.map((r, si) => (
              <div key={si} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <h3 className="font-semibold mb-4">{r.name} - Detailed Review</h3>
                <div className="space-y-3">
                  {(testType === "full" ? sections[si]?.questions || [] : questions).map((q, qi) => {
                    const userAns = testType === "full" ? answers[`${si}-${qi}`] : answers[`${qi}`];
                    const isCorrect = userAns === q.correctAnswer;
                    return (
                      <div key={qi} className={`p-4 rounded-lg border ${isCorrect ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950" : userAns !== undefined ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950" : "border-zinc-200 dark:border-zinc-800"}`}>
                        <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {q.options.map((opt, oi) => (
                            <span key={oi} className={`text-xs p-2 rounded ${oi === q.correctAnswer ? "bg-green-200 dark:bg-green-800" : oi === userAns && !isCorrect ? "bg-red-200 dark:bg-red-800" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                              {String.fromCharCode(65 + oi)}. {opt}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-500"><strong>Explanation:</strong> {q.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={() => { setMode("menu"); setTestStarted(false); }} className="px-6 py-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg font-medium">Back to Menu</button>
            <button onClick={() => { startTest(); }} className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-zinc-200">Retake Test</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
