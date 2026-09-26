// Route protection for the Next.js 16 proxy (the renamed middleware).
// Runs before rendering, executes anywhere (CDN/edge/node) — so it only uses
// edge-safe WebCrypto via session-crypto (no fs, no Node-only modules).
//
// Rules:
//   /dashboard/**      -> any signed-in user (student or admin)
//   /admin/**          -> signed-in user with role "admin" only
//                         (students get bounced to /unauthorized)
// Redirects to /login?next=<path> so the login page can bounce you back.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session-crypto";

const AUTHENTICATED_PREFIXES = ["/dashboard"];
const ADMIN_PREFIXES = ["/admin"];

function isAuthedPath(pathname: string): boolean {
  return AUTHENTICATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAuthedPath(pathname) && !isAdminPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (isAdminPath(pathname)) {
    if (!session) {
      const url = new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url);
      return NextResponse.redirect(url);
    }
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return NextResponse.next();
  }

  // /dashboard and friends
  if (!session) {
    const url = new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};