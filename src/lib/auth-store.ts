// Node-runtime user + session persistence (JSON files under data/).
// Route handlers and server components use this. The edge proxy only watches
// for a signed cookie via session-crypto (no fs), so it can't read these rows;
// = fine, because the proxy's job is just to redirect stale/unauthenticated
// visitors, and every actual data mutation re-checks server-side.
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  hashPassword,
  signSession,
  verifySession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type SessionPayload,
} from "./session-crypto";
import { getAdminPassword, isAdminBearer } from "./admin-password";

export type UserRole = "student" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  targetExam: string;
  dailyGoal: number; // minutes per day
  createdAt: string;
}

interface SessionRow {
  token: string;
  uid: string;
  role: UserRole;
  exp: number; // unix seconds (matches token exp)
}

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");

async function ensureDir(): Promise<void> {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

export async function readUsers(): Promise<AppUser[]> {
  if (!existsSync(USERS_FILE)) return [];
  try {
    const raw = await readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppUser[]) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: AppUser[]): Promise<void> {
  await ensureDir();
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function readSessions(): Promise<SessionRow[]> {
  if (!existsSync(SESSIONS_FILE)) return [];
  try {
    const raw = await readFile(SESSIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRow[]) : [];
  } catch {
    return [];
  }
}

async function writeSessions(rows: SessionRow[]): Promise<void> {
  await ensureDir();
  await writeFile(SESSIONS_FILE, JSON.stringify(rows, null, 2));
}

function makeId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

function pruneExpired(sessions: SessionRow[]): SessionRow[] {
  const now = Math.floor(Date.now() / 1000);
  return sessions.filter((s) => s.exp > now);
}

// Seed the first admin (role admin, same credentials as the legacy password
// login so the professor keeps signing in exactly like before) and a demo
// student. Pure upsert — never overwrites an existing account.
export async function seedAuth(): Promise<void> {
  const users = await readUsers();
  let changed = false;

  const adminPassword = (await getAdminPassword()) || "admin123";
  const existingAdmin = users.find((u) => u.role === "admin");
  if (!existingAdmin) {
    const now = new Date().toISOString();
    users.push({
      id: makeId("admin"),
      name: "Professor",
      email: "admin@studyplanner.app",
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      targetExam: "SSC CGL 2026",
      dailyGoal: 240,
      createdAt: now,
    });
    changed = true;
  } else {
    // Keep the account's password in sync with the on-disk admin password in
    // case it was changed from the old Admin → Change Password flow.
    const desired = await hashPassword(adminPassword);
    if (existingAdmin.passwordHash !== desired) {
      existingAdmin.passwordHash = desired;
      changed = true;
    }
  }

  const demoStudent = users.find((u) => u.email.toLowerCase() === "student@studyplanner.app");
  if (!demoStudent) {
    const now = new Date().toISOString();
    users.push({
      id: makeId("student"),
      name: "Aarav Sharma",
      email: "student@studyplanner.app",
      passwordHash: await hashPassword("student123"),
      role: "student",
      targetExam: "SSC CGL 2026",
      dailyGoal: 180,
      createdAt: now,
    });
    changed = true;
  }

  if (changed) await writeUsers(users);
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const norm = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((u) => u.email.toLowerCase() === norm) || null;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  targetExam?: string;
  dailyGoal?: number;
}): Promise<AppUser | null> {
  await seedAuth();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (input.password.length < 6) return null;
  if (await findUserByEmail(email)) return null;

  const users = await readUsers();
  const user: AppUser = {
    id: makeId("user"),
    name: input.name.trim().slice(0, 60),
    email,
    passwordHash: await hashPassword(input.password),
    role: "student",
    targetExam: input.targetExam?.trim() || "",
    dailyGoal: input.dailyGoal && input.dailyGoal > 0 ? Math.round(input.dailyGoal) : 0,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<AppUser, "name" | "targetExam" | "dailyGoal">>
): Promise<AppUser | null> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const next = { ...users[idx] };
  if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 60) || next.name;
  if (patch.targetExam !== undefined) next.targetExam = patch.targetExam.trim();
  if (patch.dailyGoal !== undefined) {
    const v = Math.round(Number(patch.dailyGoal));
    next.dailyGoal = Number.isFinite(v) && v >= 0 ? v : next.dailyGoal;
  }
  users[idx] = next;
  await writeUsers(users);
  return next;
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const hash = await hashPassword(password);
  return hash === user.passwordHash ? user : null;
}

// Create a fresh session for a user, store its row, return the signed token.
// Old sessions for the same user are rotated automatically ('everywhere login').
export async function createSession(user: AppUser): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const token = await signSession({ uid: user.id, role: user.role, exp });
  const sessions = pruneExpired(await readSessions());
  sessions.push({ token, uid: user.id, role: user.role, exp });
  await writeSessions(sessions);
  return token;
}

export function sessionCookieOptions(token: string): {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure?: boolean;
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

// Resolve a session server-side: signature valid AND row exists AND not
// expired AND the user row still exists. Returns the user or null.
export async function sessionToUser(token: string): Promise<AppUser | null> {
  const payload = await verifySession(token);
  if (!payload) return null;
  const sessions = pruneExpired(await readSessions());
  const row = sessions.find((s) => s.token === token);
  if (!row || row.uid !== payload.uid || row.role !== payload.role) return null;
  return findUserById(payload.uid);
}

export async function deleteSession(token: string): Promise<void> {
  const sessions = pruneExpired(await readSessions());
  await writeSessions(sessions.filter((s) => s.token !== token));
}

// Public shape (no passwordHash) for API JSON responses and client components.
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  targetExam: string;
  dailyGoal: number;
  createdAt: string;
}

export function toSafeUser(user: AppUser): SafeUser {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

// Read the current user from the Request cookie (for API routes).
export async function requestUser(request: NextRequest): Promise<AppUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return sessionToUser(token);
}

// Server-component guard: returns the signed-in user or redirects to /login.
export async function requireUser(): Promise<AppUser> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = token ? await sessionToUser(token) : null;
  if (!user) redirect("/login");
  return user;
}

// Server-component guard: admin-only or redirect to /unauthorized.
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/unauthorized");
  return user;
}

// Authorization helper: accepts the old opaque "Authorization: Bearer <admin
// password>" format AND the new signed session cookie with role=admin, so the
// admin panel, the legacy header flow, and any future client all work.
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const bearer = await isAdminBearer(request.headers.get("authorization"));
  if (bearer) return true;
  const user = await requestUser(request);
  return user?.role === "admin";
}

export { SESSION_COOKIE };

// keep the payload type import referenced (used by typedef consumers)
export type { SessionPayload };