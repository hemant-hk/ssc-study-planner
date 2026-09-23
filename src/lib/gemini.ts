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

async function callGroq(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  let res;
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (res.ok) break;

    lastError = await res.text();
    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      const waitSec = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(retryAfterSec, 30)
        : Math.min(5 * 2 ** attempt, 20);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }
    throw new Error(`Groq API error: ${lastError}`);
  }

  if (!res || !res.ok) {
    throw new Error("AI is busy right now. Please wait a moment and try again.");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid JSON response from AI");
  return match[0];
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
  const apiKey = getApiKey();
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

  const studyText = await callGroq(apiKey, studyPrompt, 4096);
  const studyData = JSON.parse(extractJson(studyText));

  return {
    summary: studyData.summary || "",
    keyTopics: studyData.keyTopics || [],
    chapters: studyData.chapters || [],
    revisionPoints: studyData.revisionPoints || [],
    difficulty: studyData.difficulty || "Intermediate",
    estimatedStudyTime: studyData.estimatedStudyTime || "1 hour",
    quiz: [],
    lastYearNotes: studyData.lastYearNotes || [],
    predictedTopics: studyData.predictedTopics || [],
  };
}

export async function generateQuiz(
  videoInfo: YouTubeVideoInfo,
  studyPlan: StudyPlan
): Promise<QuizQuestion[]> {
  const apiKey = getApiKey();
  const baseContext = buildBaseContext(videoInfo);
  const quizTopics = studyPlan.keyTopics.join(", ");
  const chapterList = studyPlan.chapters.map((c) => c.title).join(", ");

  const quizPrompt = `You are an SSC exam question expert. Generate 10 previous year style questions for this topic.

Topic: ${quizTopics}
Chapters: ${chapterList}
${baseContext}

Include questions from SSC CGL, SSC CHSL, SSC CPO and SSC MTS exams.
Recall actual previous year questions from SSC exams on these topics.

Respond with ONLY valid JSON (no markdown):
{
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation",
      "difficulty": "easy|medium|hard",
      "year": "2023",
      "exam": "SSC CGL"
    }
  ]
}

Generate exactly 10 questions. Each must have 4 options, correctAnswer (0-indexed), explanation, difficulty, year, exam.`;

  const text = await callGroq(apiKey, quizPrompt, 4000);
  const data = JSON.parse(extractJson(text));
  return (data.quiz || []) as QuizQuestion[];
}