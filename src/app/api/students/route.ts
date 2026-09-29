import { NextRequest, NextResponse } from "next/server";
import {
  blankProfile,
  getStudent,
  listStudents,
  normalizeProfileInput,
  resolveStudentId,
  saveStudent,
  withStudentCookie,
} from "@/lib/student-store";
import { isAdminRequest } from "@/lib/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wantsAll = request.nextUrl.searchParams.get("all") === "1";
  if (wantsAll) {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ students: await listStudents() });
  }

  const { id, isNew } = resolveStudentId(request);
  const existing = await getStudent(id);
  return withStudentCookie(
    NextResponse.json({ profile: existing ?? blankProfile(id), isNew: !existing }),
    id,
    isNew
  );
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, isNew } = resolveStudentId(request);
  const existing = await getStudent(id);
  const input = normalizeProfileInput(id, body);
  const record = await saveStudent({
    ...input,
    // Role is never client-writable; keep the stored value.
    role: existing?.role ?? "student",
  });

  return withStudentCookie(NextResponse.json({ profile: record }), id, isNew);
}
