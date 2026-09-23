import { NextRequest } from "next/server";
import {
  extractVideoId,
  extractPlaylistId,
  fetchVideoInfo,
  fetchPlaylistInfo,
} from "@/lib/youtube";
import { generateStudyPlan } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { url, videoId: selectedVideoId } = await request.json();

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

    const videoInfo = await fetchVideoInfo(vid);
    const studyPlan = await generateStudyPlan(videoInfo);

    return Response.json({ type: "video", videoInfo, studyPlan });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return Response.json({ error: message }, { status: 500 });
  }
}
