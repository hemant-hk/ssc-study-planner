import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { generatePYQs, type PYQ } from "@/lib/pyqs";

export const runtime = "nodejs";

const PYQS_FILE = path.join(process.cwd(), "data", "pyqs.json");

const SUBJECTS = [
  "Quantitative Aptitude",
  "Reasoning",
  "English Comprehension",
  "General Awareness",
];

function normalizeSubject(s: string): string {
  const lower = s.trim().toLowerCase();
  if (lower === "quantitative aptitude" || lower.includes("quant") || lower.includes("math") || lower.includes("aptitude")) {
    return "Quantitative Aptitude";
  }
  if (lower.includes("reason") || lower.includes("logical")) {
    return "Reasoning";
  }
  if (lower.includes("english")) {
    return "English Comprehension";
  }
  if (lower.includes("general") || lower.includes("awareness") || lower.includes("gs") || lower.includes("gk")) {
    return "General Awareness";
  }
  return s.trim();
}

async function readPYQs(): Promise<PYQ[]> {
  if (!existsSync(PYQS_FILE)) return [];
  try {
    const raw = await readFile(PYQS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PYQ[]) : [];
  } catch {
    return [];
  }
}

async function writePYQs(pyqs: PYQ[]) {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(PYQS_FILE, JSON.stringify(pyqs, null, 2));
}

function parseYearRange(range: string): { from: number; to: number } | null {
  const r = range.trim().toLowerCase();
  if (r === "old" || r === "2010-2017") return { from: 2010, to: 2017 };
  if (r === "recent" || r === "2018-2024") return { from: 2018, to: 2024 };
  if (r === "all" || r === "all20" || r === "all-20") return { from: 2005, to: 2026 };
  const m = r.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  return null;
}

export async function GET(request: NextRequest) {
  const subjectRaw = request.nextUrl.searchParams.get("subject") || "";
  const topic = request.nextUrl.searchParams.get("topic") || "";
  const tier = request.nextUrl.searchParams.get("tier") || "";
  const yearRange = request.nextUrl.searchParams.get("yearRange") || "all";
  const search = request.nextUrl.searchParams.get("q") || "";

  const subject = subjectRaw ? normalizeSubject(subjectRaw) : "";
  const range = parseYearRange(yearRange);

  let pyqs = await readPYQs();

  if (subject) pyqs = pyqs.filter((p) => p.subject === subject);
  if (topic) pyqs = pyqs.filter((p) => p.topic.toLowerCase().includes(topic.toLowerCase()));
  if (tier) pyqs = pyqs.filter((p) => p.tier.toLowerCase() === tier.toLowerCase());
  if (range) pyqs = pyqs.filter((p) => p.year >= range.from && p.year <= range.to);
  if (search) {
    const q = search.toLowerCase();
    pyqs = pyqs.filter(
      (p) =>
        p.question.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.explanation.toLowerCase().includes(q)
    );
  }

  pyqs.sort((a, b) => b.year - a.year);

  return Response.json({ pyqs, total: pyqs.length });
}

export async function POST(request: NextRequest) {
  let body: {
    subject?: unknown;
    topic?: unknown;
    year?: unknown;
    tier?: unknown;
    count?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = normalizeSubject(typeof body.subject === "string" ? body.subject : "");
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const year = Number(body.year);
  const tier = typeof body.tier === "string" ? body.tier : "Tier 1";

  if (!subject) {
    return Response.json({ error: "subject is required" }, { status: 400 });
  }

  const genYear = Number.isInteger(year) && year >= 2000 && year <= 2026 ? year : 2024;
  const count = Number.isInteger(body.count as number | undefined) ? Math.min(Math.max(Number(body.count), 3), 8) : 5;

  let generated: PYQ[] = [];
  try {
    generated = await generatePYQs({ subject, topic, year: genYear, tier, count });
  } catch (err: unknown) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate PYQs" },
      { status: 502 }
    );
  }

  if (generated.length === 0) {
    return Response.json({ error: "AI generated no valid questions. Try again in a moment." }, { status: 502 });
  }

  const cache = await readPYQs();
  const seen = new Set(cache.map((p) => p.question.toLowerCase().trim()));

  const merged: PYQ[] = [];
  for (const q of generated) {
    if (seen.has(q.question.toLowerCase().trim())) continue;
    seen.add(q.question.toLowerCase().trim());
    const record: PYQ = {
      ...q,
      id: q.id || randomUUID(),
      subject,
      topic: q.topic || topic || "General",
    };
    merged.push(record);
  }

  if (merged.length > 0) {
    cache.push(...merged);
    await writePYQs(cache);
  }

  return Response.json({
    pyqs: merged,
    added: merged.length,
    cacheTotal: cache.length,
  });
}