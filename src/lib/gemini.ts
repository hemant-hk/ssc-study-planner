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

const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
const MODEL_TOKEN_CAPS: Record<string, number> = { "qwen/qwen3.8-27b": 900 };

function modelsFor(maxTokens: number): string[] {
  // qwen can only produce ~900 output tokens; include it only for small replies.
  return maxTokens <= 900
    ? GROQ_MODELS
    : GROQ_MODELS.filter((m) => m !== "qwen/qwen3.8-27b");
}

export async function callGroq(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  let lastError = "Unknown error";
  // Two passes over all models so a temporary rate limit (429) doesn't block
  // an otherwise-clean model waiting on a different budget.
  for (let pass = 0; pass < 2; pass++) {
    let hadRateLimit = false;
    let longestReset = 0;
    const chain = modelsFor(maxTokens);
    for (let modelIndex = 0; modelIndex < chain.length; modelIndex++) {
      const model = chain[modelIndex];
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
          // Return only a *valid, complete* JSON block so downstream parsing
          // never sees markdown fences, preamble, or broken output.
          const json = content.match(/\{[\s\S]*\}/)?.[0];
          if (json) {
            try {
              JSON.parse(json);
              return json;
            } catch {
              lastError = "Invalid JSON in AI response";
              continue;
            }
          }
          lastError = "Response contains no JSON";
          continue;
        } catch {
          lastError = "Invalid response from AI";
          continue;
        }
      }

      lastError = text.slice(0, 200);
      if (res.status === 429) {
        hadRateLimit = true;
        const resetHeader = res.headers.get("x-ratelimit-reset-tokens");
        const resetSec = resetHeader ? parseFloat(resetHeader) : NaN;
        if (Number.isFinite(resetSec) && resetSec > 0) {
          longestReset = Math.max(longestReset, resetSec);
        }
        // "Request too large" means this model can't handle the token count -
        // skip it entirely (retrying won't help).
        if (/request too large/i.test(text)) {
          continue;
        }
        // Otherwise: move on to another model (each has its own token budget).
      }
      // Non-429 error (500 etc.) or exhausted retries: try another model.
    }

    if (hadRateLimit) {
      // A short pause helps a transient per-minute limit recover; keep it
      // bounded so a burnt-out daily budget fails fast and lets callers
      // fall back to compact generation instead of hanging.
      const waitSec = Math.min(Math.max(longestReset, 3), 12);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    break;
  }

  throw new Error("AI is busy right now. Please wait a moment and try again.");
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid JSON response from AI");
  return match[0];
}

export async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const models = (process.env.GEMINI_MODELS || "gemini-3.6-flash,gemini-3.1-pro-preview")
    .split(",")
    .map((m) => m.trim());
  let lastError = "Unknown Gemini error";
  for (const model of models) {
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
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
          const errText = data?.error?.message || "";
          const retryIn = errText.match(/retry in ([\d.]+)s/i);
          if (retryIn) {
            lastError = errText.slice(0, 200);
            await new Promise((r) => setTimeout(r, Math.min(parseFloat(retryIn[1]), 45) * 1000));
            continue;
          }
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
        const json = content.match(/\{[\s\S]*\}/)?.[0];
        if (json) {
          try {
            JSON.parse(json);
            return json;
          } catch {
            lastError = "Invalid JSON in AI response";
            continue;
          }
        }
        lastError = "Response contains no JSON";
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }
  }
  throw new Error(`Gemini error: ${lastError}`);
}

// Try Groq's multi-model chain first; if it is rate-limited or exhausted,
// fall back to Gemini, which has a completely separate quota pool.
async function callAI(prompt: string, maxTokens: number): Promise<string> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
    return callGroq(getApiKey(), prompt, maxTokens);
  }
  // Try candidates across both providers and return the first valid one.
  const providers = [
    async () => callGroq(getApiKey(), prompt, maxTokens),
    async () => callGemini(prompt, maxTokens),
  ];
  let lastError = "";
  for (const attempt of providers) {
    try {
      return await attempt();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError || "AI is busy right now. Please wait a moment and try again.");
}

async function callAndParseJson<T>(
  prompt: string,
  maxTokens: number,
  retries = 3
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const text = await callAI(prompt, maxTokens);
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("No JSON in AI response");
      return JSON.parse(json) as T;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
  }
  throw new Error(`AI returned invalid JSON: ${lastError}`);
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

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return apiKey;
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
    const studyData = await callAndParseJson<Record<string, any>>(compactPrompt, 900, 3);
    return normalizePlan(studyData);
  }
}

function normalizePlan(data: Record<string, any>): StudyPlan {
  return {
    summary: data.summary || "",
    keyTopics: data.keyTopics || [],
    chapters: data.chapters || [],
    revisionPoints: data.revisionPoints || [],
    difficulty: data.difficulty || "Intermediate",
    estimatedStudyTime: data.estimatedStudyTime || "1 hour",
    quiz: [],
    lastYearNotes: data.lastYearNotes || [],
    predictedTopics: data.predictedTopics || [],
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

  // gpt-oss daily budgets may be exhausted; generate the quiz in small,
  // qwen-compatible chunks so the output never exceeds the token cap.
  const chunks: QuizQuestion[] = [];
  for (const range of ["1 through 4", "5 through 8", "9 through 10"]) {
    const chunkPrompt = `You are an SSC exam question expert. Generate 4 previous year style questions (questions ${range}) for this topic.

Topic: ${quizTopics}
Chapters: ${chapterList}
${baseContext}

Include questions from SSC CGL, SSC CHSL, SSC CPO and SSC MTS exams.

${quizSchema}
Generate exactly 4 questions in the quiz array.`;
    const chunk = await callAndParseArray<QuizQuestion[]>(chunkPrompt, 700, "quiz");
    chunks.push(...chunk);
  }
  return chunks;
}