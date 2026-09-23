import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export interface DiscussionComment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  timestamp: string;
  upvotes: number;
}

const DISCUSSIONS_FILE = path.join(process.cwd(), "data", "discussions.json");

async function readDiscussions(): Promise<DiscussionComment[]> {
  if (!existsSync(DISCUSSIONS_FILE)) return [];
  try {
    const raw = await readFile(DISCUSSIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiscussionComment[]) : [];
  } catch {
    return [];
  }
}

async function writeDiscussions(comments: DiscussionComment[]) {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(DISCUSSIONS_FILE, JSON.stringify(comments, null, 2));
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const comments = await readDiscussions();
  if (videoId) {
    return Response.json({
      comments: comments.filter((c) => c.videoId === videoId),
    });
  }
  return Response.json({ comments });
}

export async function POST(request: NextRequest) {
  let body: { videoId?: unknown; author?: unknown; text?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  const author =
    typeof body.author === "string" ? body.author.trim().slice(0, 60) : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!videoId) {
    return Response.json({ error: "videoId is required" }, { status: 400 });
  }
  if (!author) {
    return Response.json({ error: "author is required" }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const comment: DiscussionComment = {
    id: randomUUID(),
    videoId,
    author,
    text,
    timestamp: new Date().toISOString(),
    upvotes: 0,
  };

  const comments = await readDiscussions();
  comments.push(comment);
  await writeDiscussions(comments);

  return Response.json({ comment }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let body: { id?: unknown; increment?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const increment = body.increment === true ? 1 : body.increment === false ? -1 : 1;

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const comments = await readDiscussions();
  const comment = comments.find((c) => c.id === id);
  if (!comment) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  comment.upvotes = Math.max(0, comment.upvotes + increment);
  await writeDiscussions(comments);

  return Response.json({ comment });
}