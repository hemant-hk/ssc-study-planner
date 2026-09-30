"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!passcode || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error || "Login failed. Please try again.");
          setSubmitting(false);
          return;
        }
        // Only navigate to an internal path (never to an external redirect).
        const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
        router.replace(destination);
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
        setSubmitting(false);
      }
    },
    [passcode, submitting, next, router]
  );

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8 shadow-2xl shadow-black/60">
          <div className="flex flex-col items-center text-center">
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-white">Study Planner</h1>
            <p className="mt-1 text-sm text-zinc-400">Enter the passcode to open your planner</p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-zinc-500">Passcode</span>
              <input
                ref={inputRef}
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={submitting}
                className="input mt-1.5"
              />
            </label>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!passcode || submitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors"
            >
              {submitting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : null}
              {submitting ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          Single-user access. Your data stays on this app.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}