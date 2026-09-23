import { NextRequest } from "next/server";
import { callGroq } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { type, topic, subject, sections } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

    if (type === "full") {
      const sectionPromises = (sections || ["General Studies", "Reasoning", "Mathematics", "English"]).map(async (section: string) => {
        const prompt = `Generate 12 SSC CGL previous year style questions for ${section} section.
Mix of easy, medium, hard. Cover various subtopics.
Return ONLY valid JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`;
const text = await callGroq(apiKey, prompt, 2200);
        try { return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}").questions || []; } catch { return []; }
      });
      const sectionResults = await Promise.all(sectionPromises);
      return Response.json({ sections: sectionResults.map((q, i) => ({ name: ["General Studies", "Reasoning", "Mathematics", "English"][i], questions: q })) });
    }

    const prompt = type === "subject"
      ? `Generate 12 SSC exam questions about ${subject}. Mix difficulties. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`
      : `Generate 12 SSC exam questions about "${topic}" under subject ${subject}. Mix difficulties. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`;

    const text = await callGroq(apiKey, prompt, 2200);
    let questions = [];
    try { questions = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}").questions || []; } catch {}
    return Response.json({ questions });
  } catch {
    return Response.json({ error: "Failed to generate test" }, { status: 500 });
  }
}
