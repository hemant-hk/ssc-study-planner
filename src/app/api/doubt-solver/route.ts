import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { callGroq } from "@/lib/gemini";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are an expert SSC CGL mentor. Answer user doubts clearly, concisely, and provide exam-relevant shortcuts, formulas, and historical context where applicable.";

// Strictly pinned per product requirement. gemini-1.5-flash is retired, so
// use the 2.0 flash model name. Any failure on this endpoint (404/429/503)
// is caught and routed through the Groq fallback below.
const GEMINI_DOUBT_MODEL = "gemini-2.0-flash";

// Preferred llama models first (per requirement), then models actually
// available on this Groq key as an automatic fallback chain.
const GROQ_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
];

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function groqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return key;
}

function statusFromError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/(\d{3})\s/);
  return match ? match[1] : "500";
}

export async function POST(request: NextRequest) {
  let body: {
    message?: unknown;
    videoTitle?: unknown;
    subject?: unknown;
    topicSummary?: unknown;
    history?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const videoTitle = typeof body.videoTitle === "string" ? body.videoTitle : "Unknown video";
  const subject = typeof body.subject === "string" ? body.subject : "General";
  const topicSummary = typeof body.topicSummary === "string" ? body.topicSummary : "";
  const history: ChatMessage[] = Array.isArray(body.history)
    ? (body.history as ChatMessage[]).filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") && typeof m.text === "string"
      )
    : [];

  const context = `The student is currently watching this video in the SSC study planner:

Video Title: ${videoTitle}
Subject: ${subject}
Topic Summary: ${topicSummary || "No summary available."}

Use this context to ground your answer. Quote from the topic where helpful. If the question is unrelated to the video, answer generally but keep it SSC exam focused.`;

  const fallbackPrompt = `${SYSTEM_PROMPT}

${context}

User's doubt:
${history.map((m) => `${m.role}: ${m.text}`).join("\n")}
user: ${message}

Answer concisely and helpfully. If a formula or shortcut applies, include it.`;

  const apiKey = process.env.GEMINI_API_KEY;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (frame: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));

      send({ type: "start" });

      // 1) Try Gemini first (streaming). Any failure - especially the daily
      //    429 quota - should fall through immediately to Groq.
      if (apiKey && apiKey !== "your_gemini_api_key_here") {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: GEMINI_DOUBT_MODEL,
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          });

          const contents = [
            ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: "user", parts: [{ text: message }] },
          ];

          const result = await model.generateContentStream({
            systemInstruction: SYSTEM_PROMPT + "\n\n" + context,
            contents,
          });

          let fullText = "";
          for await (const chunk of result.stream) {
            const delta = chunk.text();
            if (!delta) continue;
            fullText += delta;
            send({ type: "delta", text: delta });
          }

          send({ type: "done", text: fullText });
          controller.close();
          return;
        } catch (err: unknown) {
          const status = statusFromError(err);
          const errText = err instanceof Error ? err.message : String(err);
          send({
            type: "status",
            message: `Gemini unavailable (${status}) — switching to Groq fallback…`,
          });
          console.warn(`[doubt-solver] Gemini ${status}: ${errText.slice(0, 200)}`);
        }
      } else {
        send({ type: "status", message: "Gemini not configured — using Groq fallback…" });
      }

      // 2) Groq fallback via callGroq (llama models, raw prose mode).
      try {
        const text = await callGroq(groqKey(), fallbackPrompt, 700, {
          models: GROQ_FALLBACK_MODELS,
          requireJSON: false,
        });

        // Emit the finished answer in small frames so the drawer still
        // renders progressively instead of appearing frozen.
        const CHUNK = 32;
        let fullText = "";
        for (let i = 0; i < text.length; i += CHUNK) {
          const delta = text.slice(i, i + CHUNK);
          fullText += delta;
          send({ type: "delta", text: delta });
        }
        send({ type: "done", text: fullText });
      } catch (err: unknown) {
        const status = statusFromError(err);
        const errText = err instanceof Error ? err.message : String(err);
        send({
          type: "error",
          status,
          message: `Both providers failed (${status}): ${errText.slice(0, 200)}`,
        });
        console.error(`[doubt-solver] Groq fallback ${status}: ${errText.slice(0, 200)}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}