import { NextRequest } from "next/server";
import {
  extractVideoId,
  extractPlaylistId,
  fetchVideoInfo,
  fetchPlaylistInfo,
} from "@/lib/youtube";
import type { YouTubeVideoInfo } from "@/lib/youtube";
import { generateStudyPlan, generateQuiz, type StudyPlan } from "@/lib/gemini";

// No server-side filesystem access here. Serverless runtimes (Vercel) mount
// the filesystem read-only, so writing e.g. data/study-plans.json would throw
// EROFS. Instead, the client caches plans and video metadata in localStorage
// and passes what it already has back in the request body so we avoid
// re-fetching YouTube metadata on retries.

export async function GET() {
  // Plans are cached on the client; keep the endpoint valid for old clients.
  return Response.json({ plans: {} });
}

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      videoId: selectedVideoId,
      style,
      videoInfo: cachedVideoInfo,
      plan: cachedPlan,
    } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "YouTube URL is required" }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    const playlistId = extractPlaylistId(trimmedUrl);

    if (playlistId && !selectedVideoId) {
      const playlistInfo = await fetchPlaylistInfo(playlistId);
      return Response.json({ type: "playlist", playlist: playlistInfo });
    }

    const vid = selectedVideoId || extractVideoId(trimmedUrl);
    if (!vid) {
      return Response.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Reuse previously-fetched video info (supplied by the client from its
    // localStorage cache) so we don't re-fetch YouTube metadata on every retry.
    const videoInfo: YouTubeVideoInfo =
      cachedVideoInfo && typeof cachedVideoInfo === "object"
        ? (cachedVideoInfo as YouTubeVideoInfo)
        : await fetchVideoInfo(vid);

    if (style === "quiz") {
      const existing = cachedPlan as StudyPlan | undefined;
      if (existing?.quiz && existing.quiz.length > 0) {
        return Response.json({ type: "video", videoInfo, studyPlan: existing, cached: true });
      }
      const base = existing || (await generateStudyPlan(videoInfo));
      const merged: StudyPlan = { ...base, quiz: await generateQuiz(videoInfo, base) };
      return Response.json({ type: "video", videoInfo, studyPlan: merged });
    }

    if (cachedPlan) {
      return Response.json({ type: "video", videoInfo, studyPlan: cachedPlan, cached: true });
    }

    const studyPlan = await generateStudyPlan(videoInfo);
    return Response.json({ type: "video", videoInfo, studyPlan });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return Response.json({ error: message }, { status: 500 });
  }
}