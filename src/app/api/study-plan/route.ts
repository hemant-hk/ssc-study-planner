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
import { generateStudyPlan, generateQuiz, type StudyPlan } from "@/lib/gemini";

const PLANS_FILE = path.join(process.cwd(), "data", "study-plans.json");
const PLAYER_FILE = path.join(process.cwd(), "data", "video-info.json");

async function readPlans(): Promise<Record<string, unknown>> {
  if (!existsSync(PLANS_FILE)) return {};
  try {
    return JSON.parse(await readFile(PLANS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function savePlan(videoId: string, plan: StudyPlan) {
  const plans = await readPlans();
  plans[videoId] = plan;
  await writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));
}

async function readVideoInfo(): Promise<Record<string, unknown>> {
  if (!existsSync(PLAYER_FILE)) return {};
  try {
    return JSON.parse(await readFile(PLAYER_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function rememberVideoInfo(videoId: string, info: unknown) {
  const all = await readVideoInfo();
  all[videoId] = info;
  await writeFile(PLAYER_FILE, JSON.stringify(all, null, 2));
}

export async function GET() {
  const plans = await readPlans();
  return Response.json({ plans });
}

export async function POST(request: NextRequest) {
  try {
    const { url, videoId: selectedVideoId, style } = await request.json();

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

    // Video info: reuse fetched info so we avoid re-fetching every retry.
    const cachedVideoInfo = (await readVideoInfo())[vid];
    const videoInfo = cachedVideoInfo ? (cachedVideoInfo as Parameters<typeof generateStudyPlan>[0]) : await fetchVideoInfo(vid);
    if (!cachedVideoInfo) await rememberVideoInfo(vid, videoInfo);

    const plans = await readPlans();

    if (style === "quiz") {
      const existing = plans[vid] as StudyPlan | undefined;
      if (existing?.quiz && existing.quiz.length > 0) {
        return Response.json({ type: "video", videoInfo, studyPlan: existing, cached: true });
      }
      const base = existing || (await generateStudyPlan(videoInfo));
      const merged: StudyPlan = { ...base, quiz: await generateQuiz(videoInfo, base) };
      await savePlan(vid, merged);
      return Response.json({ type: "video", videoInfo, studyPlan: merged });
    }

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