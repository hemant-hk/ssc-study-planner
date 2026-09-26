import type { YouTubeVideoInfo } from "./youtube";

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  year?: string;
  exam?: string;
}

export interface StudyPlan {
  summary: string;
  keyTopics: string[];
  chapters: StudyChapter[];
  revisionPoints: string[];
  difficulty: string;
  estimatedStudyTime: string;
  quiz: QuizQuestion[];
  lastYearNotes: ImportantNote[];
  predictedTopics: PredictedTopic[];
  fullNotes?: string;
}

export interface ImportantNote {
  topic: string;
  frequency: string;
  notes: string;
  exams: string[];
}

export interface PredictedTopic {
  topic: string;
  probability: string;
  reason: string;
  preparationTip: string;
}

export interface StudyChapter {
  title: string;
  timestamp: string;
  keyConcepts: string[];
  notes: string;
}

export class AIProviderError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
const MODEL_TOKEN_CAPS: Record<string, number> = { "qwen/qwen3.8-27b": 900 };

function modelsFor(maxTokens: number): string[] {
  // qwen can only produce ~900 output tokens; include it only for small replies.
  return maxTokens <= 900
    ? GROQ_MODELS
    : GROQ_MODELS.filter((m) => m !== "qwen/qwen3.8-27b");
}

// Strip markdown fences (```json ... ``` or ``` ... ```) and preamble, then
// return the first balanced JSON object so parsing never sees prose.
function sanitizeJson(text: string): string {
  let t = (text || "").trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fenced) t = fenced[1].trim();
  const block = t.match(/\{[\s\S]*\}/);
  if (!block) {
    const snippet = t.slice(0, 200);
    throw new AIProviderError(`AI gave a non-JSON response: ${snippet}`, 502);
  }
  return block[0];
}

export interface CallGroqOptions {
  // Override the default model chain (e.g. fall back to specific llama models).
  models?: string[];
  // When true (default), only a valid complete JSON object is returned.
  // Set false to get the raw text content (used by chat-style callers).
  requireJSON?: boolean;
}

export async function callGroq(
  apiKey: string,
  prompt: string,
  maxTokens: number,
  options?: CallGroqOptions
): Promise<string> {
  const chain = options?.models && options.models.length > 0 ? options.models : modelsFor(maxTokens);
  const requireJSON = options?.requireJSON ?? true;
  let lastError = "Unknown error";
  let lastStatus = 500;
  let sawRateLimit = false;
  // Max 1-2 retries with exponential backoff: a transient per-minute 429
  // recovers quickly, but a daily-budget error won't, so fail fast instead of
  // hammering the API with a tight retry loop.
  for (let pass = 0; pass < 2; pass++) {
    let transient429 = false;
    for (const model of chain) {
      const tokens = Math.min(maxTokens, MODEL_TOKEN_CAPS[model] ?? maxTokens);
      let res;
      try {
        res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
          signal: AbortSignal.timeout(120000),
        });
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }

      const text = await res.text();
      if (res.ok) {
        try {
          const data = JSON.parse(text);
          const content = data.choices?.[0]?.message?.content || "";
          const finishReason = data.choices?.[0]?.finish_reason;
          if (finishReason === "length") {
            lastError = "Response truncated by token limit";
            continue;
          }
          // Chat-style callers want raw prose; skip the JSON gate entirely.
          if (!requireJSON) {
            if (content) return content;
            lastError = "Empty response from AI";
            continue;
          }
          // Return only a *valid, complete* JSON block so downstream parsing
          // never sees markdown fences, preamble, or broken output.
          try {
            return sanitizeJson(content);
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Invalid JSON in AI response";
            continue;
          }
        } catch {
          lastError = "Invalid response from AI";
          continue;
        }
      }

      lastError = text.slice(0, 200);
      lastStatus = res.status || 500;
      if (res.status === 429) {
        sawRateLimit = true;
        // A daily token budget is gone for hours; waiting won't help, so skip
        // straight to the next model (or fail fast) instead of stalling.
        if (/tokens per day \(TPD\)|limit.*per day|request too large/i.test(text)) {
          continue;
        }
        transient429 = true;
        // Otherwise: move on to another model (each has its own token budget).
      }
      // Non-429 error (500 etc.): try another model.
    }

    if (!transient429) break;
    // Short exponential backoff before one more pass (1s then 2s), bounded so
    // a burnt-out daily budget fails fast instead of hanging.
    await sleep(1000 * Math.pow(2, pass));
  }

  if (sawRateLimit) {
    throw new AIProviderError("AI is rate limited. Please wait a moment and try again.", 429);
  }
  throw new AIProviderError(`AI error: ${lastError}`, lastStatus);
}

export async function callGemini(
  prompt: string,
  maxTokens: number,
  requireJSON = true
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new AIProviderError("GEMINI_API_KEY is not configured", 500);
  }
  const models = (process.env.GEMINI_MODELS || "gemini-3.6-flash,gemini-3.1-pro-preview")
    .split(",")
    .map((m) => m.trim());
  let lastError = "Unknown Gemini error";
  let sawRateLimit = false;
  for (const model of models) {
    // Max 2 attempts per model with exponential backoff on transient 429s.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(1000 * Math.pow(2, attempt - 1));
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
            signal: AbortSignal.timeout(120000),
          }
        );

        const data = await res.json();

        if (res.status === 429) {
          sawRateLimit = true;
          const errText = data?.error?.message || "";
          lastError = errText.slice(0, 200) || "Gemini rate limited";
          continue;
        }

        if (!res.ok) {
          lastError = JSON.stringify(data).slice(0, 200);
          continue;
        }

        const content =
          data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
        if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
          lastError = "Response truncated by token limit";
          continue;
        }

        // Return only a valid, complete JSON block, same contract as callGroq.
        try {
          if (!requireJSON) return content;
          return sanitizeJson(content);
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Invalid JSON in AI response";
          continue;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }
  }
  if (sawRateLimit) {
    throw new AIProviderError("AI is rate limited. Please wait a moment and try again.", 429);
  }
  throw new AIProviderError(`Gemini error: ${lastError}`, 500);
}

// Provider fallback chain: Groq is the fast, reliable primary; if it rate
// limits (429) we switch to Gemini; if Gemini also fails we go back to Groq
// once more before giving up.
async function callAI(
  prompt: string,
  maxTokens: number,
  requireJSON = true
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const hasGroq = groqKey && groqKey !== "your_groq_api_key_here";
  const hasGemini = geminiKey && geminiKey !== "your_gemini_api_key_here";

  const attempts: Array<() => Promise<string>> = [];
  if (hasGroq)
    attempts.push(() => callGroq(groqKey as string, prompt, maxTokens, { requireJSON }));
  if (hasGemini) attempts.push(() => callGemini(prompt, maxTokens, requireJSON));
  if (hasGroq && hasGemini)
    attempts.push(() => callGroq(groqKey as string, prompt, maxTokens, { requireJSON }));

  if (attempts.length === 0) {
    throw new AIProviderError("No AI provider is configured (set GROQ_API_KEY or GEMINI_API_KEY)", 500);
  }

  // At most 3 provider calls total (e.g. groq -> gemini -> groq), each with a
  // short exponential backoff between attempts, never a tight retry loop.
  let lastError: unknown = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      return await attempts[i]();
    } catch (err) {
      lastError = err;
      if (i < attempts.length - 1) await sleep(1000 * Math.pow(2, i));
    }
  }
  if (lastError instanceof AIProviderError) throw lastError;
  throw new AIProviderError("AI is rate limited. Please wait a moment and try again.", 429);
}

async function callAndParseJson<T>(
  prompt: string,
  maxTokens: number,
  retries = 2
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const text = await callAI(prompt, maxTokens);
      return JSON.parse(sanitizeJson(text)) as T;
    } catch (err: unknown) {
      // Provider-level failures (rate limit, 5xx) are already final and clear;
      // surface them directly instead of wrapping them as a JSON parse error.
      if (err instanceof AIProviderError) {
        throw new AIProviderError(err.message, err.status);
      }
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries - 1) await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw new AIProviderError(`AI returned invalid JSON: ${lastError}`, 502);
}

async function callAndParseArray<T>(
  prompt: string,
  maxTokens: number,
  key: string
): Promise<T> {
  try {
    const data = await callAndParseJson<Record<string, T>>(prompt, maxTokens);
    return data[key] as T;
  } catch {
    return [] as T;
  }
}

function buildBaseContext(videoInfo: YouTubeVideoInfo): string {
  const chapterContext =
    videoInfo.chapters.length > 0
      ? `Video chapters:\n${videoInfo.chapters.map((c) => `- ${c.timestamp} ${c.title}`).join("\n")}`
      : "No chapters found in the video description.";

  return `Video Title: ${videoInfo.title}
Video Author: ${videoInfo.author}
Video Description:
${videoInfo.description.slice(0, 2000)}
${chapterContext}`;
}

export async function generateStudyPlan(
  videoInfo: YouTubeVideoInfo
): Promise<StudyPlan> {
  const baseContext = buildBaseContext(videoInfo);

  const studyPrompt = `You are an expert study planner for SSC exam preparation. Analyze this YouTube video and create a detailed study plan.

${baseContext}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "A 2-3 sentence overview of what this video teaches",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "chapters": [
    {
      "title": "Chapter title",
      "timestamp": "0:00",
      "keyConcepts": ["concept1", "concept2"],
      "notes": "Detailed study notes for this section"
    }
  ],
  "revisionPoints": ["point1", "point2", "point3"],
  "difficulty": "Beginner|Intermediate|Advanced",
  "estimatedStudyTime": "X hours Y minutes",
  "lastYearNotes": [
    {
      "topic": "Topic name",
      "frequency": "Asked X times in last five years",
      "notes": "Key facts and notes that appeared in exams",
      "exams": ["SSC CGL 2023", "SSC CHSL 2022"]
    }
  ],
  "predictedTopics": [
    {
      "topic": "Topic name",
      "probability": "High|Medium|Low",
      "reason": "Why this is likely to be asked",
      "preparationTip": "How to prepare for this topic"
    }
  ]
}

LAST YEAR NOTES REQUIREMENTS:
- Analyze which topics from this video are most frequently asked in SSC exams
- List 8-12 most important topics with their exam frequency
- Include specific facts, dates, names that appeared in previous year papers
- Mention which SSC exams asked these questions (CGL, CHSL, CPO, MTS etc.)
- Focus on 2020-2025 exam trends

PREDICTED TOPICS REQUIREMENTS:
- Predict 8-10 topics most likely to appear in upcoming 2025-2026 SSC exams
- Based on patterns from last 5 years of SSC exams
- Include probability (High/Medium/Low) based on frequency analysis
- Give specific preparation tips for each predicted topic
- Explain reasoning behind each prediction

If there are no chapters, create 4-8 logical chapters. Make notes detailed and educational.`;

  try {
    const studyData = await callAndParseJson<Record<string, any>>(studyPrompt, 3800, 2);
    return normalizePlan(studyData);
  } catch {
    // gpt-oss daily budgets can be exhausted; build a compact but valid plan
    // that fits the small output budget of fallback models (e.g. qwen).
    const compactPrompt = `Create a concise SSC exam study plan for this video.

${baseContext}

Return ONLY valid JSON (no markdown):
{"summary":"one sentence","keyTopics":["t1","t2","t3"],"chapters":[{"title":"short title","timestamp":"0:00","keyConcepts":["a","b"],"notes":"one line of study notes"}],"revisionPoints":["r1","r2"],"difficulty":"Beginner|Intermediate|Advanced","estimatedStudyTime":"X hours","lastYearNotes":[{"topic":"topic","frequency":"asked frequently","notes":"key facts","exams":["SSC CGL"]}],"predictedTopics":[{"topic":"topic","probability":"High|Medium|Low","reason":"brief","preparationTip":"brief"}]}
Keep everything short and concise. 4-6 chapters max.`;
    const studyData = await callAndParseJson<Record<string, any>>(compactPrompt, 900, 2);
    return normalizePlan(studyData);
  }
}

// Generate exhaustive, self-contained study notes that cover *everything* in
// the video — used on demand (like the quiz) so the long output doesn't blow
// the token budget of the compact study-plan transcript.
export async function generateFullNotes(
  videoInfo: YouTubeVideoInfo,
  existingPlan?: StudyPlan | null
): Promise<string> {
  const baseContext = buildBaseContext(videoInfo);
  const topicContext = existingPlan?.keyTopics?.length
    ? `Key topics: ${existingPlan.keyTopics.join(", ")}`
    : "";

  const prompt = `You are an expert SSC exam mentor. Write a COMPLETE, DETAILED study note for this topic. It must cover EVERYTHING in the video — every concept, definition, rule, formula, date, name, example, and examination-relevant fact. Write in clear Markdown with headings and bullet points, structured for active reading and revision. This is the student's primary study material, so be thorough and specific — include real examples, common mistakes, and memory hooks.

Video Title: ${videoInfo.title}
Video Author: ${videoInfo.author}
${topicContext}
Video Description:
${videoInfo.description.slice(0, 2000)}

Respond with your note as PLAIN MARKDOWN TEXT. Do NOT wrap it in code fences or JSON. No preamble or "Here is your note" — start directly with the markdown.`;

  const text = await callAI(prompt, 2600, false);
  return text.trim();
}

function normalizePlan(data: Record<string, any>): StudyPlan {
  return {
    summary: data.summary || "",
    keyTopics: data.keyTopics || [],
    chapters: data.chapters || [],
    revisionPoints: data.revisionPoints || [],
    difficulty: data.difficulty || "Intermediate",
    estimatedStudyTime: data.estimatedStudyTime || "1 hour",
    quiz: data.quiz || [],
    lastYearNotes: data.lastYearNotes || [],
    predictedTopics: data.predictedTopics || [],
    fullNotes: data.fullNotes || "",
  };
}

export async function generateQuiz(
  videoInfo: YouTubeVideoInfo,
  studyPlan: StudyPlan
): Promise<QuizQuestion[]> {
  const baseContext = buildBaseContext(videoInfo);
  const quizTopics = studyPlan.keyTopics.join(", ");
  const chapterList = studyPlan.chapters.map((c) => c.title).join(", ");

  const quizSchema = `Respond with ONLY valid JSON (no markdown, no code blocks):
{"quiz":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard","year":2018,"exam":"SSC CGL"}]}`;

  const quizPrompt = `You are an SSC exam question expert. Generate 10 previous year style questions for this topic.

Topic: ${quizTopics}
Chapters: ${chapterList}
${baseContext}

Include questions from SSC CGL, SSC CHSL, SSC CPO and SSC MTS exams.
Recall actual previous year questions from SSC exams on these topics.

${quizSchema}
Generate exactly 10 questions in the quiz array.`;

  const full = await callAndParseArray<QuizQuestion[]>(quizPrompt, 2200, "quiz");
  if (full.length > 0) return full;

  // gpt-oss daily budgets may be exhausted or the 10-question output can
  // exceed a model's cap; generate small 2-question chunks that always fit
  // the ~900-token output limit of fallback models (e.g. qwen).
  const chunks: QuizQuestion[] = [];
  const chunkRanges = ["1 and 2", "3 and 4", "5 and 6", "7 and 8", "9 and 10"];
  for (const range of chunkRanges) {
    const chunkPrompt = `You are an SSC exam question expert. Generate 2 previous year style questions (questions ${range}) for this topic. Be concise.

Topic: ${quizTopics}
Chapters: ${chapterList}
${baseContext}

Include questions from SSC CGL, SSC CHSL, SSC CPO and SSC MTS exams.

${quizSchema}
Generate exactly 2 questions in the quiz array.`;
    const chunk = await callAndParseArray<QuizQuestion[]>(chunkPrompt, 700, "quiz");
    chunks.push(...chunk);
  }
  return chunks;
}