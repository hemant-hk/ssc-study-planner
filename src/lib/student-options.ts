// Client-safe module: pure const arrays, types and blank-profile helpers.
// Keep this free of Node-only imports (`fs`, `path`) so browser bundles can
// pull it in safely. The file-backed store lives in student-store.ts.

export const STUDY_SLOTS = ["Morning", "Afternoon", "Evening", "Night"] as const;
export const QUALIFICATIONS = ["10th", "12th", "Graduation", "Post Graduation", "Other"] as const;
export const TARGET_EXAMS = [
  "SSC CGL",
  "SSC CHSL",
  "SSC GD",
  "SSC MTS",
  "SSC JE",
  "Railways NTPC",
  "Railways Group D",
  "IBPS PO",
  "Other",
] as const;

export type StudySlot = (typeof STUDY_SLOTS)[number];
export type Qualification = (typeof QUALIFICATIONS)[number];
export type TargetExam = (typeof TARGET_EXAMS)[number];

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  college: string;
  qualification: Qualification | "";
  yearOfPassing: string;
  targetExam: TargetExam | string;
  examDate: string;
  dailyGoal: number;
  studyTime: StudySlot | "";
  goals: string;
  role: "student" | "admin";
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_PROFILE_FIELDS = {
  name: "",
  email: "",
  phone: "",
  city: "",
  college: "",
  qualification: "",
  yearOfPassing: "",
  targetExam: "",
  examDate: "",
  dailyGoal: 0,
  studyTime: "",
  goals: "",
} as const;

export function blankProfile(id: string): StudentProfile {
  return {
    id,
    ...EMPTY_PROFILE_FIELDS,
    role: "student",
    createdAt: "",
    updatedAt: "",
  };
}