import { NextRequest } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  extractVideoId,
  extractPlaylistId,
  fetchVideoInfo,
  fetchPlaylistInfo,
} from "@/lib/youtube";
import { generateStudyPlan } from "@/lib/gemini";

const PLANS_FILE = path.join(process.cwd(), "data", "study-plans.json");

async function readPlans(): Promise<Record<string, unknown>> {
  if (!existsSync(PLANS_FILE)) return {};
  try {
    return JSON.parse(await readFile(PLANS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function savePlan(videoId: string, plan: unknown) {
  const plans = await readPlans();
  plans[videoId] = plan;
  await writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
}

export async function GET() {
  const plans = await readPlans();
  return Response.json({ plans });
}

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

    const plans = await readPlans();
    if (plans[vid]) {
      return Response.json({ type: "video", videoInfo, studyPlan: plans[vid], cached: true });
    }

    const studyPlan = await generateStudyPlan(videoInfo);
    await savePlan(vid, studyPlan);

    return Response.json({ type: "video", videoInfo, studyPlan });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return Response.json({ error: message }, { status: 500 });
  }
}
