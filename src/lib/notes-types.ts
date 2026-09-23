export type NoteContentType = "revision" | "quiz" | "doubt" | "custom";

export interface Note {
  id: string;
  subject: string;
  topic: string;
  videoId: string;
  contentType: NoteContentType;
  content: string;
  createdAt: string;
}

export const NOTE_CONTENT_TYPES: NoteContentType[] = [
  "revision",
  "quiz",
  "doubt",
  "custom",
];