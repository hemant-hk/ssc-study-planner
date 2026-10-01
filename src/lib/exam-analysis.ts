// Cross-shift analysis for a live exam. The value here is not the per-shift
// question list (that is just a transcript) but what happens when you compare
// shifts against each other: a question that shows up in several shifts is very
// likely to come back in the next tier, and topics that dominate one shift are
// usually worth revising first.
import type { ExamShift, ExamShiftData, ShiftQuestion } from "./exam-shifts-store";

// Compare on a normalised form so trivial differences in punctuation, spacing
// or trailing "?" don't hide a genuine repeat.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’'"`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface RepeatedQuestion {
  question: string;
  topic: string;
  section: string;
  difficulty: string;
  shifts: string[];
  timesSeen: number;
  explanation?: string;
  options?: string[];
  correctAnswer?: number;
}

export interface TopicStat {
  topic: string;
  section: string;
  total: number;
  shifts: number;
  difficulty: Record<string, number>;
}

export interface DifficultyStat {
  label: string;
  count: number;
  percent: number;
}

export interface SectionStat {
  section: string;
  count: number;
}

export interface ExamAnalysis {
  exam: string;
  updatedAt: string;
  shiftCount: number;
  reportedCount: number;
  distinctCount: number;
  repeatedCount: number;
  repeated: RepeatedQuestion[];
  topics: TopicStat[];
  difficulty: DifficultyStat[];
  sections: SectionStat[];
}

// The same question reported from different shifts — the highest-signal group,
// because a memory-based paper usually keeps a common core.
export function findRepeated(shifts: ExamShift[]): RepeatedQuestion[] {
  const byKey = new Map<string, RepeatedQuestion>();
  for (const shift of shifts) {
    for (const q of shift.questions) {
      const key = normalize(q.question);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.shifts.includes(shift.name)) existing.shifts.push(shift.name);
        existing.timesSeen += 1;
        continue;
      }
      byKey.set(key, {
        question: q.question,
        topic: q.topic,
        section: q.section,
        difficulty: q.difficulty,
        shifts: [shift.name],
        timesSeen: 1,
        explanation: q.explanation,
        options: q.options,
        correctAnswer: q.correctAnswer,
      });
    }
  }
  return [...byKey.values()]
    .filter((q) => q.timesSeen > 1)
    .sort((a, b) => b.timesSeen - a.timesSeen || a.question.localeCompare(b.question));
}

export function analyze(data: ExamShiftData): ExamAnalysis {
  const all: ShiftQuestion[] = data.shifts.flatMap((s) => s.questions);
  const reportedCount = all.length;
  const distinct = new Set(all.map((q) => normalize(q.question)).filter(Boolean));
  const repeated = findRepeated(data.shifts);

  const topicMap = new Map<string, TopicStat>();
  const difficultyCount: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const sectionCount = new Map<string, number>();

  for (const shift of data.shifts) {
    for (const q of shift.questions) {
      const topicKey = `${q.section}::${q.topic}`.toLowerCase();
      const existing = topicMap.get(topicKey);
      if (existing) {
        existing.total += 1;
        existing.shifts += 1;
        existing.difficulty[q.difficulty] = (existing.difficulty[q.difficulty] || 0) + 1;
      } else {
        topicMap.set(topicKey, {
          topic: q.topic,
          section: q.section,
          total: 1,
          shifts: 1,
          difficulty: { [q.difficulty]: 1 },
        });
      }
      if (q.difficulty in difficultyCount) difficultyCount[q.difficulty] += 1;
      sectionCount.set(q.section, (sectionCount.get(q.section) || 0) + 1);
    }
  }

  const difficulty: DifficultyStat[] = (["easy", "medium", "hard"] as const).map((label) => ({
    label,
    count: difficultyCount[label] || 0,
    percent: reportedCount ? Math.round(((difficultyCount[label] || 0) / reportedCount) * 100) : 0,
  }));

  return {
    exam: data.exam,
    updatedAt: data.updatedAt,
    shiftCount: data.shifts.length,
    reportedCount,
    distinctCount: distinct.size,
    repeatedCount: repeated.length,
    repeated,
    topics: [...topicMap.values()].sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic)),
    difficulty,
    sections: [...sectionCount.entries()]
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count),
  };
}
