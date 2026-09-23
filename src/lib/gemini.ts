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
  for (let attempt = 0; attempt < 3; attempt++) {
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
    });

    if (res.ok) break;

    lastError = await res.text();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
      continue;
    }
    throw new Error(`Groq API error: ${lastError}`);
  }

  if (!res || !res.ok) {
    if (res?.status === 429) {
      throw new Error("Rate limit exceeded. Please wait30 seconds and try again.");
    }
    throw new Error(`Groq API error: ${lastError}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid JSON response from AI");
  return match[0];
}

export async function generateStudyPlan(
  videoInfo: YouTubeVideoInfo
): Promise<StudyPlan> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured. Get one free at https://console.groq.com");
  }

  const chapterContext =
    videoInfo.chapters.length > 0
      ? `Video chapters:\n${videoInfo.chapters.map((c) => `- ${c.timestamp} ${c.title}`).join("\n")}`
      : "No chapters found in the video description.";

  const baseContext = `Video Title: ${videoInfo.title}
Video Author: ${videoInfo.author}
Video Description:
${videoInfo.description.slice(0, 2000)}
${chapterContext}`;

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
      "frequency": "Asked X times in last5years",
      "notes": "Key facts and notes that appeared in exams",
      "exams": ["SSC CGL2023", "SSC CHSL2022"]
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
- List8-12most important topics with their exam frequency
- Include specific facts, dates, names that appeared in previous year papers
- Mention which SSC exams asked these questions (CGL, CHSL, CPO, MTS etc.)
- Focus on2020-2025exam trends

PREDICTED TOPICS REQUIREMENTS:
- Predict8-10topics most likely to appear in upcoming2025-2026SSC exams
- Based on patterns from last5years of SSC exams
- Include probability (High/Medium/Low) based on frequency analysis
- Give specific preparation tips for each predicted topic
- Explain reasoning behind each prediction

If there are no chapters, create4-8logical chapters. Make notes detailed and educational.`;

  const studyText = await callGroq(apiKey, studyPrompt, 4096);
  const studyData = JSON.parse(extractJson(studyText));

  const studyPlan: StudyPlan = {
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

  const quizTopics = studyPlan.keyTopics.join(", ");
  const chapterList = studyPlan.chapters.map((c) => c.title).join(", ");

  const batchConfigs = [
    { offset: "1-50", difficulty: "17easy,17medium,16hard", years: "2020-2025" },
    { offset: "51-100", difficulty: "17easy,17medium,16hard", years: "2015-2019" },
    { offset: "101-150", difficulty: "17easy,17medium,16hard", years: "2010-2014" },
    { offset: "151-200", difficulty: "17easy,17medium,16hard", years: "2005-2009" },
  ];

  const quizPromises = batchConfigs.map((batch) => {
    const quizPrompt = `You are an SSC exam question expert. Generate50previous year style questions for this topic.

Topic: ${quizTopics}
Chapters: ${chapterList}
${baseContext}

Questions ${batch.offset} - Focus on years ${batch.years}
Difficulty mix: ${batch.difficulty}

Include questions from SSC CGL, SSC CHSL, SSC CPO, SSC MTS, SSC Stenographer, SSC GD exams.
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

Generate exactly50questions. Each must have4options, correctAnswer (0-indexed), explanation, difficulty, year, exam.`;

    return callGroq(apiKey, quizPrompt, 16000)
      .then((text) => {
        try {
          const data = JSON.parse(extractJson(text));
          return (data.quiz || []) as QuizQuestion[];
        } catch {
          return [] as QuizQuestion[];
        }
      })
      .catch(() => [] as QuizQuestion[]);
  });

  const quizBatches = await Promise.all(quizPromises);
  for (const batch of quizBatches) {
    studyPlan.quiz.push(...batch);
  }

  return studyPlan;
}
