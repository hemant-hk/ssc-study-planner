import type { YouTubeVideoInfo } from "./youtube";

export interface StudyPlan {
  summary: string;
  keyTopics: string[];
  chapters: StudyChapter[];
  revisionPoints: string[];
  difficulty: string;
  estimatedStudyTime: string;
}

export interface StudyChapter {
  title: string;
  timestamp: string;
  keyConcepts: string[];
  notes: string;
}

export async function generateStudyPlan(
  videoInfo: YouTubeVideoInfo
): Promise<StudyPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const chapterContext =
    videoInfo.chapters.length > 0
      ? `Video chapters:\n${videoInfo.chapters.map((c) => `- ${c.timestamp} ${c.title}`).join("\n")}`
      : "No chapters found in the video description.";

  const prompt = `You are an expert study planner. Analyze this YouTube video and create a detailed study plan.

Video Title: ${videoInfo.title}
Video Author: ${videoInfo.author}
Video Description:
${videoInfo.description.slice(0, 3000)}

${chapterContext}

Create a comprehensive study plan in the following JSON format (respond with ONLY valid JSON, no markdown):
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
  "estimatedStudyTime": "X hours Y minutes"
}

If there are no chapters in the video, create logical chapters based on the content description (aim for 4-8 chapters). Make the notes detailed and educational.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  let res;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (res.ok) break;

    lastError = await res.text();
    if (res.status === 429 || res.status === 503) {
      const delay = res.status === 429 ? (attempt + 1) * 5000 : (attempt + 1) * 3000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Gemini API error: ${lastError}`);
  }

  if (!res || !res.ok) {
    if (res?.status === 429) {
      throw new Error("API rate limit exceeded. Please wait a minute and try again.");
    }
    throw new Error(`Gemini API error: ${lastError}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("No response from Gemini");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid JSON response from Gemini");

  return JSON.parse(jsonMatch[0]) as StudyPlan;
}
