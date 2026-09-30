import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

// NOTE: Next.js 16 renamed the `middleware` file convention to `proxy`, so this
// gate lives in proxy.ts (creating src/middleware.ts would run the deprecated,
// soon-removed file convention). Everything here runs on the server before any
// route is rendered.
//
// Single-user app gate: every page and /api/* route is blocked unless the
// `app_session` cookie matches process.env.APP_ACCESS_KEY. Only /login and
// /api/auth/login are reachable without it (plus static assets).

const SESSION_COOKIE = "app_session";
const LOGIN_PATH = "/login";
const AUTH_LOGIN_PATH = "/api/auth/login";

// Routes that must work before the user has a session.
const PUBLIC_PATHS = new Set([LOGIN_PATH, AUTH_LOGIN_PATH]);

function safeEqual(candidate: string | undefined, expected: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const accessKey = process.env.APP_ACCESS_KEY;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (accessKey && safeEqual(session, accessKey)) {
    return NextResponse.next();
  }

  // API calls without a valid session get a JSON 401 (no redirect noise).
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Missing or invalid app_session" },
      { status: 401 }
    );
  }

  // Pages redirect to the login screen, remembering where the user was headed.
  const login = new URL(LOGIN_PATH, request.url);
  const destination = pathname + search;
  if (destination.startsWith("/") && !destination.startsWith("//")) {
    login.searchParams.set("next", destination);
  }
  return NextResponse.redirect(login);
}

// Apply to every route except static assets / image optimizations so CSS, JS,
// fonts and images keep loading on the login screen and after unblocking.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};