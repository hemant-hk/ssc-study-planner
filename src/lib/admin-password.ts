import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const PASSWORD_FILE = path.join(process.cwd(), "data", "admin-password.json");

// The admin password can be changed from the UI at runtime. The chosen value
// persists to data/admin-password.json and takes precedence over the
// ADMIN_PASSWORD environment variable so both login and admin-gated APIs
// always use the same, up-to-date secret.
export async function getAdminPassword(): Promise<string> {
  if (existsSync(PASSWORD_FILE)) {
    try {
      const raw = await readFile(PASSWORD_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.password === "string" && parsed.password) {
        return parsed.password;
      }
    } catch {
      // fall through to env fallback
    }
  }
  return process.env.ADMIN_PASSWORD || "";
}

export async function setAdminPassword(password: string): Promise<void> {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(PASSWORD_FILE, JSON.stringify({ password }, null, 2));
}

export async function isAdminBearer(authorization: string | null): Promise<boolean> {
  if (!authorization) return false;
  const password = await getAdminPassword();
  if (!password) return false;
  return authorization === `Bearer ${password}`;
}