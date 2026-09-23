"use client";

import { useState, useRef, useEffect } from "react";

interface DoubtDrawerProps {
  videoTitle: string;
  subject: string;
  topicSummary: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function DoubtDrawer({ videoTitle, subject, topicSummary }: DoubtDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    const userMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", text: "" }]);

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);

    let full = "";
    try {
      const res = await fetch("/api/doubt-solver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          videoTitle,
          subject,
          topicSummary,
          history: history.slice(-10),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.type === "delta" && typeof payload.text === "string") {
              full += payload.text;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { role: "assistant", text: full };
                }
                return next;
              });
            } else if (payload.type === "done" && typeof payload.text === "string") {
              full = payload.text;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { role: "assistant", text: full };
                }
                return next;
              });
            } else if (payload.type === "error") {
              throw new Error(payload.message || "Doubt solver error");
            }
          } catch {
            // ignore malformed event frames
          }
        }
      }
      if (!full) {
        setError("No response received. Please try again.");
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to get answer");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium hover:opacity-90 transition-opacity"
          title="Ask a doubt"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask a Doubt
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-hidden max-h-[420px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">Gemini Doubt Solver</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[160px]">
            {messages.length === 0 && !error && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-6">
                Ask any doubt about this video. Get SSC CGL-style shortcuts, formulas & historical context.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-purple-600 text-white rounded-br-none"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-bl-none"
                  }`}
                >
                  {m.text || (loading && i === messages.length - 1 ? "Thinking…" : "")}
                </div>
              </div>
            ))}
            {error && (
              <div className="text-xs text-red-500 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2 p-2 border-t border-zinc-200 dark:border-zinc-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type your doubt…"
              disabled={loading}
              className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 outline-none focus:border-purple-500 disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 transition-colors"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}