import { NextRequest } from "next/server";
import { extractVideoId, fetchVideoInfo } from "@/lib/youtube";
import { generateStudyPlan } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "YouTube URL is required" }, { status: 400 });
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      return Response.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    const videoInfo = await fetchVideoInfo(videoId);
    const studyPlan = await generateStudyPlan(videoInfo);

    return Response.json({ videoInfo, studyPlan });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return Response.json({ error: message }, { status: 500 });
  }
}
