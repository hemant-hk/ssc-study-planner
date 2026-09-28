import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-black p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-red-950/50 border border-red-900/70 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Not authorized</h1>
        <p className="text-sm text-zinc-400 mb-6">
          This area is for admins only. Your account doesn’t have permission to view it.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">
            Go to Dashboard
          </Link>
          <Link href="/" className="flex-1 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors">
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}