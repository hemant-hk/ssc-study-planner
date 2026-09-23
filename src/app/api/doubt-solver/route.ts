import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are an expert SSC CGL mentor. Answer user doubts clearly, concisely, and provide exam-relevant shortcuts, formulas, and historical context where applicable.";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return Response.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
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

  const modelName = process.env.GEMINI_FLASH_MODEL || "gemini-3.6-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`)
      );
      try {
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
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`)
          );
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", text: fullText })}\n\n`)
        );
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: errorMessage.slice(0, 300) })}\n\n`
          )
        );
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