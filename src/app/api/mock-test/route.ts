import { NextRequest } from "next/server";

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 8000 }),
    });
    if (res.ok) break;
    if (res.status === 429) { await new Promise(r => setTimeout(r, (attempt + 1) * 3000)); continue; }
    throw new Error("API error");
  }
  if (!res || !res.ok) throw new Error("API failed");
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const { type, topic, subject, sections } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

    if (type === "full") {
      const sectionPromises = (sections || ["General Studies", "Reasoning", "Mathematics", "English"]).map(async (section: string) => {
        const prompt = `Generate25SSC CGL previous year style questions for ${section} section.
Mix of easy, medium, hard. Cover various subtopics.
Return ONLY valid JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`;
        const text = await callGroq(apiKey, prompt);
        try { return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}").questions || []; } catch { return []; }
      });
      const sectionResults = await Promise.all(sectionPromises);
      return Response.json({ sections: sectionResults.map((q, i) => ({ name: ["General Studies", "Reasoning", "Mathematics", "English"][i], questions: q })) });
    }

    const prompt = type === "subject"
      ? `Generate25SSC exam questions about ${subject}. Mix difficulties. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`
      : `Generate25SSC exam questions about "${topic}" under subject ${subject}. Mix difficulties. Return ONLY JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"easy|medium|hard"}]}`;

    const text = await callGroq(apiKey, prompt);
    let questions = [];
    try { questions = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}").questions || []; } catch {}
    return Response.json({ questions });
  } catch {
    return Response.json({ error: "Failed to generate test" }, { status: 500 });
  }
}
