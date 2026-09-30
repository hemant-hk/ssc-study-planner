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

// A single AI provider's free quota is small (Groq allows only 8000 tokens per
// minute for the whole organization, shared across every key). Since each
// provider meters its own quota independently, running several of them at the
// same time multiplies the questions we can produce inside the deadline.
type BlockGenerator = (prompt: string, maxTokens: number) => Promise<Question[]>;

// The gpt-oss models emit a hidden reasoning trace before the answer, so a
// small max_tokens budget gets spent on reasoning and comes back with empty
// content. Non-reasoning models are a far better fit for short question
// chunks, and the reasoning ones get a bigger budget when we do fall back.
const REASONING_MODELS = new Set(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
const REASONING_TOKEN_BONUS = 2200;

function groqBlockGenerator(apiKey: string, model: string, start: number): BlockGenerator {
  return async (prompt, maxTokens) => {
    const budget = Math.max(500, HARD_DEADLINE_MS - (Date.now() - start));
    const tokens = REASONING_MODELS.has(model) ? maxTokens + REASONING_TOKEN_BONUS : maxTokens;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: tokens,
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
  };
}

function geminiBlockGenerator(apiKey: string, model: string, start: number): BlockGenerator {
  return async (prompt, maxTokens) => {
    // Clamp the abort to the remaining deadline so a slow provider can never
    // push the route past the platform timeout.
    const budget = Math.max(500, HARD_DEADLINE_MS - (Date.now() - start));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
          }),
          signal: AbortSignal.timeout(budget),
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: { text?: string }) => p.text || "").join("");
      if (!text) return [];
      return extractQuestions(text);
    } catch {
      return [];
    }
  };
}

// Every configured provider/model, so the chunk pool can spread work across
// them. Non-reasoning models come first: they answer a short chunk in a few
// hundred ms and never blow the token budget on a hidden reasoning trace.
// `start` is the request start, used to clamp each call's abort to the deadline.
function buildGenerators(start: number): BlockGenerator[] {
  const out: BlockGenerator[] = [];
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey !== "your_groq_api_key_here") {
    const models = (process.env.MOCK_GROQ_MODELS || "qwen/qwen3.8-27b,openai/gpt-oss-20b,openai/gpt-oss-120b")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of models) out.push(groqBlockGenerator(groqKey, model, start));
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    const model = (process.env.GEMINI_MODELS || "gemini-3.6-flash,gemini-3.1-pro-preview")
      .split(",")[0]
      .trim();
    out.push(geminiBlockGenerator(geminiKey, model, start));
  }
  return out;
}

// How many chunks each provider may have in flight at once. Chunks are small,
// so a couple per provider still fit inside its per-minute quota.
const CHUNKS_PER_PROVIDER = 2;

// A provider whose quota is spent fails instantly, so handing it a share of the
// work would just waste that slot. Track failures per provider and route each
// chunk to a healthy one, only falling back to the rest when all have failed.
class ProviderPool {
  private fails: number[] = [];
  private cursor = 0;

  constructor(private generators: BlockGenerator[]) {
    this.fails = generators.map(() => 0);
  }

  get size(): number {
    return this.generators.length;
  }

  // Round-robin over the healthy providers so none is hammered; if the picked
  // one is failing, switch to whichever has the fewest failures.
  next(): { generate: BlockGenerator; index: number } {
    this.cursor = (this.cursor + 1) % this.generators.length;
    let chosen = this.cursor;
    if (this.fails[chosen] > 0) {
      let best = 0;
      for (let i = 1; i < this.fails.length; i++) {
        if (this.fails[i] < this.fails[best]) best = i;
      }
      chosen = best;
    }
    return { generate: this.generators[chosen], index: chosen };
  }

  report(index: number, ok: boolean): void {
    if (index < 0 || index >= this.fails.length) return;
    this.fails[index] = ok ? 0 : this.fails[index] + 1;
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
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
      if (!section.trim() || !Array.isArray(list) || list.length === 0) continue;
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
  providers: ProviderPool,
  makePrompt: (count: number) => string,
  start: number,
  seeded: Question[] = []
): Promise<Question[]> {
  const questions: Question[] = [];
  pushUnique(questions, seeded);
  if (questions.length >= TARGET) return questions.slice(0, TARGET);

  // Small 3-question chunks only, spread across every configured provider. A
  // single 25-question call would ask for ~4500 tokens at once, which alone can
  // exceed one provider's per-minute quota, so chunking across independent
  // providers is what actually gets us a full set of 25.
  const batches: number[] = [];
  let remaining = TARGET - questions.length;
  while (remaining > 0) {
    const size = Math.min(CHUNK_SIZE, remaining);
    batches.push(size);
    remaining -= size;
  }
  const chunkResults = await mapPool(batches, providers.size * CHUNKS_PER_PROVIDER, async (size) => {
    if (Date.now() - start > HARD_DEADLINE_MS) return [] as Question[];
    const { generate, index } = providers.next();
    const questions = await generate(makePrompt(size), CHUNK_TOKENS);
    providers.report(index, questions.length > 0);
    return questions;
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
    const providers = new ProviderPool(buildGenerators(start));
    if (providers.size === 0) return Response.json({ error: "No AI provider is configured" }, { status: 500 });

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

      // Fill any shortfall with small chunk calls spread across every
      // configured provider. Chunks are interleaved round-robin across sections
      // so the first wave of parallel calls gives every section equal progress
      // instead of letting one section eat the whole budget. We stop the
      // instant the deadline hits.
      const queue: { idx: number; size: number }[] = [];
      const shortfall = seeded.map((sec) => TARGET - sec.questions.length);
      const chunkCount = Math.ceil(Math.max(0, ...shortfall) / CHUNK_SIZE);
      for (let round = 0; round < chunkCount; round++) {
        seeded.forEach((_, idx) => {
          const size = Math.min(CHUNK_SIZE, shortfall[idx] - round * CHUNK_SIZE);
          if (size > 0) queue.push({ idx, size });
        });
      }

      // A couple of in-flight chunks per provider, so the pool runs the
      // providers side by side and skips any whose quota is spent.
      const results = await mapPool(queue, providers.size * CHUNKS_PER_PROVIDER, async ({ idx, size }) => {
        if (Date.now() - start > HARD_DEADLINE_MS) return { idx, questions: [] as Question[] };
        const { generate, index } = providers.next();
        const questions = await generate(sectionSchema(seeded[idx].name, size), CHUNK_TOKENS);
        providers.report(index, questions.length > 0);
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
    const questions = await generateQuestions(providers, makePrompt, start, poolSeed);

    // Fold freshly generated questions back into the pool so later tests of the
    // same subject can reuse them without another AI round-trip.
    if (questions.length > poolSeed.length) {
      const fresh = questions.slice(poolSeed.length);
      // Key the pool by the mock's own section name so a later full mock can
      // find it; never write an empty key.
      const key = subj || top;
      if (key && fresh.length > 0) {
        const existing = Array.isArray(pool[key]) ? pool[key] : [];
        pool[key] = [...existing, ...fresh];
        writePool(pool);
      }
    }

    const elapsed = Date.now() - start;
    console.error(`[mock-test] ${type} test: ${elapsed}ms, ${questions.length} questions`);
    return Response.json({ questions });
  } catch (err: unknown) {
    console.error("[mock-test] route error:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Failed to generate test" }, { status: 500 });
  }
}