"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [targetExam, setTargetExam] = useState("SSC CGL 2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { name, email, password, targetExam }
            : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      const user = data.user;
      if (user?.role === "admin") {
        localStorage.setItem("isAdmin", "true");
        localStorage.removeItem("adminToken");
        router.replace("/admin");
      } else {
        localStorage.setItem("isAdmin", "false");
        localStorage.removeItem("adminToken");
        router.replace(next || "/dashboard");
      }
    } catch {
      setError("Network error — is the server running?");
      setBusy(false);
    }
  }

  const inputCls =
    "w-full bg-black border border-zinc-800 focus:border-white/40 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-zinc-500";

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-6 block">
        ← Back to Study Planner
      </Link>

      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold">S</div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-xs text-zinc-400">Study Planner · SSC 2026</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${mode === "login" ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${mode === "signup" ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} required />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className={inputCls}
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputCls}
            required
            minLength={mode === "signup" ? 6 : undefined}
          />
          {mode === "signup" && (
            <input
              type="text"
              value={targetExam}
              onChange={(e) => setTargetExam(e.target.value)}
              placeholder="Target exam (e.g. SSC CGL 2026)"
              className={inputCls}
            />
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-800">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">Demo accounts</p>
          <div className="space-y-1 text-xs text-zinc-400">
            <p>
              Student → <span className="text-zinc-200">student@studyplanner.app</span> / <span className="text-zinc-200">student123</span>
            </p>
            <p>
              Admin → <span className="text-zinc-200">admin@studyplanner.app</span> (your admin password)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}