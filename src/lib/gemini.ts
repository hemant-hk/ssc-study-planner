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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured. Get one free at https://console.groq.com");
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

Create a comprehensive study plan in the following JSON format (respond with ONLY valid JSON, no markdown, no code blocks):
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
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
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
  const text = data.choices?.[0]?.message?.content;

  if (!text) throw new Error("No response from AI");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid JSON response from AI");

  return JSON.parse(jsonMatch[0]) as StudyPlan;
}
