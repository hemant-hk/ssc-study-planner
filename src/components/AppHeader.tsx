"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/pyqs",
    label: "PYQ Bank",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "My Notes",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/mock-test",
    label: "Mock Tests",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/notice",
    label: "Notices",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: "/roster",
    label: "Roster",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export interface AppHeaderAdmin {
  isAdmin: boolean;
  onOpenAdmin?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onLogin?: () => void;
}

const ADMIN_ITEMS: { key: "admin" | "password" | "logout"; label: string; icon: ReactNode }[] = [
  {
    key: "admin",
    label: "Admin Panel",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    key: "password",
    label: "Change Password",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 11-4 0m4 0a2 2 0 10-4 0m-2 3h8m-9 4h10a1 1 0 011 1v6a1 1 0 01-1 1H6a1 1 0 01-1-1v-6a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    key: "logout",
    label: "Logout",
    icon: (
      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
];

// `title` is still accepted so existing callers keep working, but it is
// intentionally not rendered: the navbar brand is always "[Logo] Study
// Planner", and each page renders its own heading inside the page body.
export default function AppHeader({
  right,
  admin,
  onMenuClick,
}: {
  title?: string;
  right?: ReactNode;
  admin?: AppHeaderAdmin;
  onMenuClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function runAdminAction(key: "admin" | "password" | "logout") {
    setMenuOpen(false);
    if (key === "admin") admin?.onOpenAdmin?.();
    if (key === "password") admin?.onChangePassword?.();
    if (key === "logout") admin?.onLogout?.();
  }

  // On mobile the inline admin buttons are hidden, so expose them in the
  // drawer instead; desktop users get the avatar dropdown as well.
  const drawerAdminItems = admin?.isAdmin
    ? ADMIN_ITEMS
    : admin?.onLogin
      ? [{ key: "login" as const, label: "Admin Login", icon: ADMIN_ITEMS[0].icon }]
      : [];

  return (
    <>
      <header className="w-full border-b border-white/10 bg-black sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => (onMenuClick ? onMenuClick() : setOpen(true))}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg p-1.5 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="hidden sm:inline text-lg font-bold tracking-tight text-white truncate">Study Planner</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {right}
            {admin?.isAdmin && (
              // Desktop-only inline actions; on mobile they live in the avatar
              // dropdown and the drawer so they never overflow the viewport.
              <div className="hidden md:flex items-center gap-2">
                <button onClick={runAdminAction.bind(null, "admin")} className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors whitespace-nowrap">
                  Admin Panel
                </button>
                <button onClick={runAdminAction.bind(null, "password")} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap">
                  Change Password
                </button>
                <button onClick={runAdminAction.bind(null, "logout")} className="text-xs text-zinc-400 hover:text-white transition-colors whitespace-nowrap">
                  Logout
                </button>
              </div>
            )}
            <div className="relative">
              {admin ? (
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-white/10 text-white text-xs font-medium flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                  title="Profile"
                  aria-label="Profile"
                  aria-expanded={menuOpen}
                >
                  A
                </button>
              ) : (
                <Link
                  href="/"
                  className="w-9 h-9 rounded-full bg-white/10 text-white text-xs font-medium flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                  title="Profile"
                  aria-label="Profile"
                >
                  A
                </Link>
              )}
              {admin && menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="fixed right-4 top-14 w-52 rounded-xl border border-white/10 bg-[#0f0f11] shadow-xl z-50 overflow-hidden">
                    {admin.isAdmin ? (
                      ADMIN_ITEMS.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => runAdminAction(item.key)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 hover:text-white transition-colors text-left"
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))
                    ) : (
                      <button
                        onClick={() => { setMenuOpen(false); admin.onLogin?.(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 hover:text-white transition-colors text-left"
                      >
                        {ADMIN_ITEMS[0].icon}
                        Admin Login
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg p-1.5 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span className="text-sm font-bold tracking-tight text-white">Study Planner</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close menu">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              <div className="px-4 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-200 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
            <div className="p-3 border-t border-white/10">
              <div className="flex items-center gap-3 p-2 rounded-xl border border-zinc-800 bg-[#0f0f11]">
                <span className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">A</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">Aspirant</p>
                  <span className="inline-block text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">SSC CGL 2026 Aspirant</span>
                </div>
              </div>
              {drawerAdminItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {drawerAdminItems.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setOpen(false);
                        if (item.key === "login") admin?.onLogin?.();
                        else runAdminAction(item.key);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}