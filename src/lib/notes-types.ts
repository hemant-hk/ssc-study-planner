export type NoteContentType = "revision" | "quiz" | "doubt" | "custom";

export interface Note {
  id: string;
  subject: string;
  topic: string;
  videoId: string;
  contentType: NoteContentType;
  content: string;
  // Owner of the note. Older notes predate per-student accounts and carry no
  // owner; they stay visible to everyone as shared legacy notes.
  studentId?: string;
  createdAt: string;
}

export const NOTE_CONTENT_TYPES: NoteContentType[] = [
  "revision",
  "quiz",
  "doubt",
  "custom",
];