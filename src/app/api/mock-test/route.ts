import { NextRequest } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const TARGET = 25;
const FULL_SECTIONS = ["General Studies", "Reasoning", "Mathematics", "English"];
// The Groq key has a tiny tokens-per-minute quota, so we never ask for a huge
// single response: small chunks keep each call under the TPM ceiling and
// parallel workers can't collectively blow the budget.
const CHUNK_SIZE = 3;
const CHUNK_TOKENS = 800;
// Vercel kills long-running serverless functions at ~10s; leave headroom so
// the route always returns valid JSON before the platform cuts us off.
const HARD_DEADLINE_MS = 8000;
// Cap the persisted per-section pool so the file stays small and fresh.
const POOL_MAX = 60;

// Map full-mock section names to the subject labels used in the cached PYQ store.
const SECTION_TO_SUBJECT: Record<string, string> = {
  "General Studies": "General Awareness",
  Reasoning: "Reasoning",
  Mathematics: "Quantitative Aptitude",
  English: "English Comprehension",
};

const PYQS_FILE = path.join(process.cwd(), "data", "pyqs.json");
const POOL_FILE = path.join(process.cwd(), "data", "mock-pool.json");

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
}

function extractQuestions(jsonText: string): Question[] {
  try {
    const data = JSON.parse(jsonText.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const raw = Array.isArray(data?.questions) ? data.questions : [];
    const out: Question[] = [];
    for (const q of raw) {
      if (!q || typeof q !== "object") continue;
      const rec = q as Record<string, any>;
      const question = typeof rec.question === "string" ? rec.question.trim() : "";
      const options = Array.isArray(rec.options)
        ? rec.options.filter((o: unknown) => typeof o === "string").map((o: string) => o.trim())
        : [];
      const correctAnswer = Number(rec.correctAnswer);
      if (!question || options.length < 2 || !Number.isInteger(correctAnswer)) continue;
      if (correctAnswer < 0 || correctAnswer >= options.length) continue;
      out.push({
        question,
        options,
        correctAnswer,
        explanation: typeof rec.explanation === "string" ? rec.explanation : "",
        difficulty: ["easy", "medium", "hard"].includes(rec.difficulty) ? rec.difficulty : "medium",
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Single-attempt Groq call with a short abort so a rate-limited (429) response
// fails fast instead of burning the 1-2s retry sleeps inside callGroq. The
// abort is clamped to the remaining deadline so a slow response can never push
// the route past the platform timeout.
async function generateBlockFast(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  start: number
): Promise<Question[]> {
  const budget = Math.max(500, HARD_DEADLINE_MS - (Date.now() - start));
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: Math.min(maxTokens, 4500),
      }),
      signal: AbortSignal.timeout(budget),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) return [];
    return extractQuestions(content);
  } catch {
    return [];
  }
}

// Small concurrent pool so top-up chunks don't hammer the rate limit.
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Append questions into `out` de-duplicated by question text, capped at TARGET.
function pushUnique(out: Question[], list: Question[]): void {
  const seen = new Set(out.map((q) => q.question.toLowerCase().trim()));
  for (const q of list) {
    const key = q.question.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  }
}

// --- Disk-backed question pool -------------------------------------------------
// The free-tier AI key rate-limits hard, so 100 fresh questions in one request
// is not reliable. Every question we ever get (from the AI or the static PYQ
// store) is persisted per-section, so later requests are served from disk in
// milliseconds and the AI is only needed to top up a shrinking shortfall.
type Pool = Record<string, Question[]>;

function readPool(): Pool {
  if (!existsSync(POOL_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(POOL_FILE, "utf-8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Pool) : {};
  } catch {
    return {};
  }
}

// Keep a bounded pool per section (fresh questions are more useful than an
// unbounded ever-growing file) and merge newly generated ones in.
function writePool(pool: Pool): void {
  try {
    const trimmed: Pool = {};
    for (const [section, list] of Object.entries(pool)) {
      if (!Array.isArray(list) || list.length === 0) continue;
      const seen = new Set<string>();
      const kept: Question[] = [];
      for (const q of shuffle(list)) {
        const key = String(q?.question || "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        kept.push(q);
        if (kept.length >= POOL_MAX) break;
      }
      trimmed[section] = kept;
    }
    writeFileSync(POOL_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch (err: unknown) {
    console.error("[mock-test] pool write failed:", err instanceof Error ? err.message : String(err));
  }
}

// Questions already on disk for this section, shuffled for variety.
function poolQuestions(pool: Pool, section: string): Question[] {
  const list = pool[section];
  if (!Array.isArray(list)) return [];
  return shuffle(list.filter((q) => typeof q?.question === "string" && Array.isArray(q.options)));
}

// Seed the section with cached static PYQs (subject-matched, randomly sampled)
// so the mock never waits on the AI for its baseline.
function seedFromCache(section: string): Question[] {
  const subject = SECTION_TO_SUBJECT[section];
  if (!subject) return [];
  if (!existsSync(PYQS_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(PYQS_FILE, "utf-8"));
    if (!Array.isArray(raw)) return [];
    const matched = raw.filter(
      (q: Record<string, any>) => q?.subject === subject && typeof q?.question === "string"
    );
    const questions = matched
      .map((q: Record<string, any>) => ({
        question: String(q.question).trim(),
        options: Array.isArray(q.options) ? q.options.filter((o: unknown) => typeof o === "string") : [],
        correctAnswer: Number(q.answerIndex),
        explanation: typeof q.explanation === "string" ? q.explanation : "",
        difficulty: "medium" as const,
      }))
      .filter((q) => q.question && q.options.length >= 2 && Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer < q.options.length);
    return shuffle(questions).slice(0, TARGET);
  } catch (err: unknown) {
    console.error("[mock-test] cache seed failed:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

function topicSchema(subject: string, topic: string, count: number): string {
  return `Generate exactly ${count} SSC exam questions about "${topic}" under subject ${subject}. Mix easy, medium and hard. Vary the subtopics.
Return ONLY valid JSON (no markdown, no code blocks):
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}
Generate exactly ${count} questions in the questions array.`;
}

function subjectSchema(subject: string, count: number): string {
  return `Generate exactly ${count} SSC exam questions about ${subject}. Mix easy, medium and hard. Cover various subtopics.
Return ONLY valid JSON (no markdown, no code blocks):
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}
Generate exactly ${count} questions in the questions array.`;
}

function sectionSchema(section: string, count: number): string {
  return `Generate exactly ${count} SSC CGL previous year style questions for the ${section} section. Mix easy, medium and hard. Cover various subtopics of ${section}.
Return ONLY valid JSON (no markdown, no code blocks):
{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}
Generate exactly ${count} questions in the questions array.`;
}

function schemaFor(type: string, subject: string, topic: string, section: string): (count: number) => string {
  if (type === "full") return (count: number) => sectionSchema(section, count);
  if (type === "subject") return (count: number) => subjectSchema(subject, count);
  return (count: number) => topicSchema(subject, topic, count);
}

// Ask for the full target in one call (big max_tokens so it isn't truncated),
// then top up with small concurrent chunks if the model under-delivered. Stops
// early to respect the hard deadline so the client always gets valid JSON.
async function generateQuestions(
  apiKey: string,
  makePrompt: (count: number) => string,
  start: number,
  seeded: Question[] = []
): Promise<Question[]> {
  const questions: Question[] = [];
  pushUnique(questions, seeded);
  if (questions.length >= TARGET) return questions.slice(0, TARGET);

  // Small 3-question chunks only. A single 25-question call would ask for
  // ~4500 tokens at once, which alone can exceed the Groq per-minute quota, so
  // chunking is what actually gets us a full set of 25.
  const batches: number[] = [];
  let remaining = TARGET - questions.length;
  while (remaining > 0) {
    const size = Math.min(CHUNK_SIZE, remaining);
    batches.push(size);
    remaining -= size;
  }
  const chunkResults = await mapPool(batches, 6, async (size) => {
    if (Date.now() - start > HARD_DEADLINE_MS) return [] as Question[];
    return generateBlockFast(apiKey, makePrompt(size), CHUNK_TOKENS, start);
  });
  for (const chunk of chunkResults) {
    if (Date.now() - start > HARD_DEADLINE_MS) break;
    pushUnique(questions, chunk);
    if (questions.length >= TARGET) break;
  }
  return questions.slice(0, TARGET);
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const { type, topic, subject, sections } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

    if (type === "full") {
      // Assemble from disk first (instant, no rate limit): the persisted pool,
      // topped up with the static PYQ store. Whatever is still short is filled
      // by parallel batch calls using the fast no-retry caller, so a
      // rate-limited request fails in milliseconds instead of burning retry
      // sleeps. The deadline is checked before every AI call, so the route
      // always returns valid sections well inside the platform timeout.
      const wanted = (sections || FULL_SECTIONS)
        .map((s: unknown) => (typeof s === "string" ? s : ""))
        .filter((s: string) => s.length > 0);
      const names: string[] = wanted.length > 0 ? wanted : FULL_SECTIONS;

      const pool = readPool();
      const seeded = names.map((name) => {
        const questions = poolQuestions(pool, name);
        pushUnique(questions, seedFromCache(name));
        return { name, questions: questions.slice(0, TARGET) };
      });

      // Fill any shortfall with small chunk calls. The Groq TPM quota is tiny,
      // so each chunk asks for only 3 questions (~800 tokens). Chunks are
      // interleaved round-robin across sections so the first wave of parallel
      // calls gives every section equal progress instead of letting one
      // section eat the whole budget. We stop the instant the deadline hits.
      const queue: { idx: number; size: number }[] = [];
      const shortfall = seeded.map((sec) => TARGET - sec.questions.length);
      const chunkCount = Math.ceil(Math.max(0, ...shortfall) / CHUNK_SIZE);
      for (let round = 0; round < chunkCount; round++) {
        seeded.forEach((_, idx) => {
          const size = Math.min(CHUNK_SIZE, shortfall[idx] - round * CHUNK_SIZE);
          if (size > 0) queue.push({ idx, size });
        });
      }

      const results = await mapPool(queue, 6, async ({ idx, size }) => {
        if (Date.now() - start > HARD_DEADLINE_MS) return { idx, questions: [] as Question[] };
        const questions = await generateBlockFast(
          apiKey,
          sectionSchema(seeded[idx].name, size),
          CHUNK_TOKENS,
          start
        );
        return { idx, questions };
      });
      for (const { idx, questions } of results) {
        if (Date.now() - start > HARD_DEADLINE_MS) break;
        if (questions.length === 0) continue;
        pushUnique(seeded[idx].questions, questions);
        const name = seeded[idx].name;
        const existing = Array.isArray(pool[name]) ? pool[name] : [];
        pool[name] = [...existing, ...questions];
      }

      // Persist everything we learned so the next mock is served from disk.
      writePool(pool);

      const sectionsOut = seeded.map((sec) => ({
        name: sec.name,
        questions: sec.questions.slice(0, TARGET),
      }));

      const elapsed = Date.now() - start;
      console.error(`[mock-test] full mock: ${elapsed}ms, total ${sectionsOut.reduce((a, s) => a + s.questions.length, 0)} questions`);
      return Response.json({ sections: sectionsOut });
    }

    const subj = typeof subject === "string" ? subject.trim() : "";
    const top = typeof topic === "string" ? topic.trim() : "";
    const makePrompt = schemaFor(type, subj, top, "");
    // Seed topic/subject tests from the disk pool (matched by subject) so a
    // warm pool serves them without touching the rate-limited AI.
    const pool = readPool();
    const poolSeed =
      type === "subject" && subj
        ? Object.keys(pool)
            .filter((k) => k === subj || SECTION_TO_SUBJECT[k] === subj)
            .flatMap((k) => poolQuestions(pool, k))
        : [];
    const questions = await generateQuestions(apiKey, makePrompt, start, poolSeed);

    // Fold freshly generated questions back into the pool so later tests of the
    // same subject can reuse them without another AI round-trip.
    if (questions.length > poolSeed.length) {
      const fresh = questions.slice(poolSeed.length);
      const key = SECTION_TO_SUBJECT[subj] || subj;
      const existing = Array.isArray(pool[key]) ? pool[key] : [];
      pool[key] = [...existing, ...fresh];
      writePool(pool);
    }

    const elapsed = Date.now() - start;
    console.error(`[mock-test] ${type} test: ${elapsed}ms, ${questions.length} questions`);
    return Response.json({ questions });
  } catch (err: unknown) {
    console.error("[mock-test] route error:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Failed to generate test" }, { status: 500 });
  }
}