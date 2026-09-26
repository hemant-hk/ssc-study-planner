import Link from "next/link";
import { SSC_NOTICES, getDaysLeft } from "@/lib/ssc-notices";

export const dynamic = "force-dynamic";

export default function NoticePage() {
  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const chsl = SSC_NOTICES.find((n) => n.exam.includes("CHSL"));
  const chslDays = chsl ? getDaysLeft("7 October 2026") : -1;

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-6 block">← Back to Study Planner</Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-1">Official Notices</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">SSC Exam Notice Board</h1>
          </div>
          <span className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded-full text-zinc-300 whitespace-nowrap">
            Updated {todayLabel}
          </span>
        </div>

        <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <div>
                <p className="text-sm font-semibold text-zinc-100 tracking-tight">Staff Selection Commission</p>
                <p className="text-[11px] text-zinc-400">ssc.gov.in · Current notifications for 2026</p>
              </div>
            </div>
            <a href="https://ssc.gov.in" target="_blank" rel="noopener noreferrer" className="border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Official Portal (ssc.gov.in)
            </a>
          </div>

          <div className="divide-y divide-zinc-800">
            {SSC_NOTICES.map((notice, idx) => {
              const isActive = notice.status === "Active Now";
              return (
                <div key={idx} className="p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-white tracking-tight">{notice.exam}</span>
                    {isActive ? (
                      notice.applyLink ? (
                        <a href={notice.applyLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full hover:bg-emerald-500/20 transition-colors">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          Apply Now · {chslDays >= 0 && chslDays <= 30 ? `${chslDays} days left` : "Active"}
                        </a>
                      ) : (
                        <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full">Active Now</span>
                      )
                    ) : (
                      <span className="text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full">Upcoming</span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-zinc-100 mb-1">{notice.title}</h2>
                  <p className="text-xs text-zinc-400 mb-4">Issued: {notice.issuedOn} · {notice.summary}</p>

                  <div className="space-y-2 mb-5">
                    {notice.dates.map((d, j) => (
                      <div key={j} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${d.important ? "border border-white/20 bg-zinc-900" : "border border-zinc-800/60 bg-black"}`}>
                        <span className="text-xs text-zinc-400">{d.label}</span>
                        <span className={`text-xs text-right ${d.important ? "font-semibold text-white" : "text-zinc-200"}`}>{d.value}</span>
                      </div>
                    ))}
                  </div>

                  <a href={notice.examLink} target="_blank" rel="noopener noreferrer" className="inline-block border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs px-3 py-1.5 rounded-lg transition-colors">
                    View Official Notice
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}