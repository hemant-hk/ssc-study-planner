// Drop-in next-auth-compatible, self-hosted authentication primitives.
// Works on BOTH the edge runtime (proxy.ts) and node runtime (route handlers,
// server components) because it only uses WebCrypto — no Buffer, no fs.

export const SESSION_COOKIE = "sp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;

// Secret is shared between proxy (edge) and server (node). In production set
// AUTH_SECRET; fallback keeps local dev working without config.
const SECRET = process.env.AUTH_SECRET || "study-planner-dev-secret-change-me";

export interface SessionPayload {
  uid: string;
  role: "student" | "admin";
  exp: number; // unix seconds
}

function base64UrlEncode(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function encodeStr(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await sha256(encodeStr(`${password}:${SECRET}`));
  return base64UrlEncode(digest);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = base64UrlEncode(encodeStr(JSON.stringify(payload)));
  const mac = base64UrlEncode(await sha256(encodeStr(`session:${body}:${SECRET}`)));
  return `${body}.${mac}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [body, mac] = token.split(".");
    const expectedMac = await sha256(encodeStr(`session:${body}:${SECRET}`));
    const provided = base64UrlDecode(mac);
    const bodyBytes = base64UrlDecode(body);
    if (!provided || !bodyBytes) return null;

    // Constant-time comparison of MAC and payload length check.
    if (expectedMac.length !== provided.length) return null;
    let diff = 0;
    for (let i = 0; i < expectedMac.length; i++) diff |= expectedMac[i] ^ provided[i];
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as SessionPayload;
    if (typeof payload.uid !== "string" || !["student", "admin"].includes(payload.role)) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}