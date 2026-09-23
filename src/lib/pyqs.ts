import { callGroq } from "./gemini";
import { randomUUID } from "crypto";

export interface PYQ {
  id: string;
  subject: string;
  topic: string;
  year: number;
  tier: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

const PYQ_SUBJECTS = [
  "Quantitative Aptitude",
  "Reasoning",
  "English Comprehension",
  "General Awareness",
];

async function callAndParsePYQ(
  prompt: string,
  maxTokens: number
): Promise<PYQ[]> {
  let lastError = "Unknown error";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callGroq(getApiKey(), prompt, maxTokens);
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("No JSON in AI response");
      const data = JSON.parse(json);
      const questions = Array.isArray(data?.pyqs) ? data.pyqs : Array.isArray(data?.questions) ? data.questions : [];
      return normalizeQuestions(questions);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`AI returned invalid JSON: ${lastError}`);
}

function normalizeQuestions(raw: unknown[]): PYQ[] {
  const out: PYQ[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const rec = q as Record<string, any>;
    const question = typeof rec.question === "string" ? rec.question.trim() : "";
    const options = Array.isArray(rec.options)
      ? rec.options.filter((o: unknown) => typeof o === "string").map((o: string) => o.trim())
      : [];
    const answerIndex = Number(rec.answerIndex);
    if (!question || options.length < 2 || !Number.isInteger(answerIndex)) continue;
    if (answerIndex < 0 || answerIndex >= options.length) continue;
    const subject =
      typeof rec.subject === "string" && PYQ_SUBJECTS.includes(rec.subject)
        ? rec.subject
        : "General Awareness";
    const topic = typeof rec.topic === "string" && rec.topic.trim() ? rec.topic.trim() : "General";
    const year = Number(rec.year);
    const tier = typeof rec.tier === "string" ? rec.tier.trim() : "Tier 1";
    out.push({
      id: randomUUID(),
      subject,
      topic,
      year: Number.isInteger(year) && year >= 2000 && year <= 2026 ? year : 2024,
      tier: tier.startsWith("Tier") ? tier : `Tier ${tier}`,
      question,
      options,
      answerIndex,
      explanation: typeof rec.explanation === "string" ? rec.explanation.trim() : "No explanation provided.",
    });
  }
  return out;
}

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return apiKey;
}

export async function generatePYQs(params: {
  subject: string;
  topic: string;
  year: number;
  tier: string;
  count?: number;
}): Promise<PYQ[]> {
  const count = Math.min(Math.max(params.count || 5, 3), 8);
  const topicLabel = params.topic || "this topic";
  const schema = `Respond with ONLY valid JSON (no markdown, no code blocks):
{"pyqs":[
  {"subject":"${params.subject}","topic":"${topicLabel}","year":${params.year},"tier":"${params.tier}","question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}
]}`;

  const fullPrompt = `You are an expert SSC CGL previous-year question generator with a deep memory of real SSC question papers from 2005 to 2024.

Generate ${count} authentic SSC CGL previous-year questions for:
Subject: ${params.subject}
Topic: ${topicLabel}
Tier: ${params.tier}
Year: ${params.year}

Rules:
- Recall or closely reconstruct REAL questions asked in SSC CGL ${params.year} (${params.tier}) for this exact topic.
- Vary difficulty across the set; include the classic high-yield type that repeats every year.
- Options must be exactly 4 plausible choices, one correct.
- answerIndex is the 0-based index of the correct option.
- Provide a crisp explanation with a shortcut, formula, or memory trick where possible.
- If you are unsure of the exact wording, keep the numbers/scenario realistic for an SSC paper.

${schema}
Generate exactly ${count} questions in the pyqs array.`;

  try {
    return await callAndParsePYQ(fullPrompt, 3200);
  } catch {
    // gpt-oss daily budgets may be exhausted; generate compact 2-question
    // chunks that fit small output caps (e.g. qwen ~900 tokens).
    const chunks: PYQ[] = [];
    const batchCount = Math.min(count, 2);
    for (let i = 0; i < Math.ceil(count / 2); i++) {
      const subPrompt = `Generate ${batchCount} concise authentic SSC CGL ${params.year} (${params.tier}) previous-year questions.

Subject: ${params.subject}
Topic: ${topicLabel}

Return ONLY valid JSON:
{"pyqs":[{"subject":"${params.subject}","topic":"${topicLabel}","year":${params.year},"tier":"${params.tier}","question":"one line","options":["A","B","C","D"],"answerIndex":0,"explanation":"one line shortcut"}]}
Keep each question short. Exactly ${batchCount} questions in the pyqs array.`;
      const chunk = await callAndParsePYQ(subPrompt, 900);
      chunks.push(...chunk);
      if (chunks.length >= count) break;
    }
    return chunks;
  }
}