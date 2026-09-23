import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  NOTE_CONTENT_TYPES,
  type Note,
  type NoteContentType,
} from "@/lib/notes-types";

export const runtime = "nodejs";

const NOTES_FILE = path.join(process.cwd(), "data", "notes.json");

async function readNotes(): Promise<Note[]> {
  if (!existsSync(NOTES_FILE)) return [];
  try {
    const raw = await readFile(NOTES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
}

async function writeNotes(notes: Note[]) {
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  const subject = request.nextUrl.searchParams.get("subject");
  const contentType = request.nextUrl.searchParams.get("contentType");
  let notes = await readNotes();
  if (videoId) notes = notes.filter((n) => n.videoId === videoId);
  if (subject) notes = notes.filter((n) => n.subject === subject);
  if (contentType) notes = notes.filter((n) => n.contentType === contentType);
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ notes });
}

export async function POST(request: NextRequest) {
  let body: { subject?: unknown; topic?: unknown; videoId?: unknown; contentType?: unknown; content?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  const contentTypeRaw = typeof body.contentType === "string" ? body.contentType : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!NOTE_CONTENT_TYPES.includes(contentTypeRaw as NoteContentType)) {
    return Response.json(
      { error: "contentType must be one of: " + NOTE_CONTENT_TYPES.join(", ") },
      { status: 400 }
    );
  }
  const contentType = contentTypeRaw as NoteContentType;
  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const note: Note = {
    id: randomUUID(),
    subject: subject.slice(0, 200),
    topic: topic.slice(0, 200),
    videoId: videoId.slice(0, 200),
    contentType,
    content,
    createdAt: new Date().toISOString(),
  };

  const notes = await readNotes();
  notes.push(note);
  await writeNotes(notes);

  return Response.json({ note }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  let notes = await readNotes();
  const before = notes.length;
  notes = notes.filter((n) => n.id !== id);
  if (notes.length === before) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }
  await writeNotes(notes);

  return Response.json({ ok: true });
}