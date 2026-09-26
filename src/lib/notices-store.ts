// Server-only notice store: reads/writes data/notices.json so the SSC notice
// board can be edited from the Admin panel. Defaults to the static built-in
// list from ssc-notices when the file doesn't exist yet.
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { SSC_NOTICES, type SscNotice } from "./ssc-notices";

const NOTICES_FILE = path.join(process.cwd(), "data", "notices.json");

export async function loadNotices(): Promise<SscNotice[]> {
  if (!existsSync(NOTICES_FILE)) return SSC_NOTICES;
  try {
    const raw = await readFile(NOTICES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as SscNotice[];
    return SSC_NOTICES;
  } catch {
    return SSC_NOTICES;
  }
}

export async function saveNotices(notices: SscNotice[]): Promise<void> {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(NOTICES_FILE, JSON.stringify(notices, null, 2));
}