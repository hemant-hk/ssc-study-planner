// Cross-shift analysis for a live exam. The value here is not the per-shift
// question list (that is just a transcript) but what happens when you compare
// shifts against each other: a question that shows up in several shifts is very
// likely to come back in the next tier, and topics that dominate one shift are
// usually worth revising first.
//
// Memory-based papers rarely repeat a question verbatim — the same question gets
// reworded slightly between shifts. So repeats are found by token overlap
// (Jaccard similarity over significant words) rather than string equality.
import type { ExamShift, ExamShiftData, ShiftQuestion } from "./exam-shifts-types";

// Question wording is full of filler that carries no identifying signal. Leaving
// these in makes two unrelated questions look similar just because they both
// start "Which of the following...".
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "were", "has", "have", "had", "been", "being",
  "which", "what", "whose", "whom", "this", "that", "these", "those", "there", "their",
  "they", "them", "then", "than", "with", "from", "into", "onto", "upon", "about",
  "above", "below", "under", "over", "between", "among", "during", "while", "when",
  "where", "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "not", "but", "any", "all", "some", "each", "other", "such", "only", "also", "its",
  "his", "her", "him", "she", "you", "your", "our", "out", "off", "per", "via",
]);

// Below this many meaningful tokens a question is too short for overlap to mean
// anything (two different one-word-ish questions can share every token), so we
// fall back to exact text equality for those.
const MIN_TOKENS_FOR_SIMILARITY = 4;

// 0.7 catches the reworded repeats while still rejecting genuinely different
// questions that happen to share a topic.
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

// Two questions must share at least this many meaningful words to count as a
// repeat, regardless of the ratio. Without it, a short question that happens to
// be fully contained in a longer one (e.g. "Who wrote Gitanjali?" inside a
// longer Polity question that also names the author) would score a perfect
// overlap and be reported as the same question.
export const MIN_SHARED_TOKENS = 4;

export function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[’'"`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out = new Set<string>();
  for (const raw of cleaned.split(" ")) {
    const word = raw.trim();
    if (word.length < 3) continue;
    if (STOP_WORDS.has(word)) continue;
    out.add(word);
  }
  return out;
}

export function intersectionSize(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection;
}

// Overlap coefficient (intersection / smaller set) rather than plain Jaccard.
// Memory-based papers reword a question but rarely rewrite it wholesale, so both
// halves of a pair share most of their significant words while the filler words
// differ. Jaccard penalises that added vocabulary and scored genuine repeats at
// ~0.62, under the 0.7 bar; overlap correctly scores them ~0.83 while a merely
// related question on the same topic stays near 0.14.
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = intersectionSize(a, b);
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return intersectionSize(a, b) / Math.min(a.size, b.size);
}

// The score used for repeat decisions. Both the ratio and an absolute shared-word
// count must clear their bar, which keeps paraphrases together without letting a
// question be matched on a couple of stray words.
export function similarity(a: Set<string>, b: Set<string>): number {
  if (intersectionSize(a, b) < MIN_SHARED_TOKENS) return 0;
  return overlapCoefficient(a, b);
}

// Exact normalized text, used when either question is too short for overlap.
export function normalizedText(text: string): string {
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
  variants: string[];
  matchKind: "exact" | "similar";
  similarity: number;
  explanation?: string;
  options?: string[];
  correctAnswer?: number;
}

interface ClusterMember {
  question: string;
  shift: string;
  tokens: Set<string>;
  exact: string;
}

interface Cluster {
  members: ClusterMember[];
}

export function findRepeated(
  shifts: ExamShift[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): RepeatedQuestion[] {
  const clusters: Cluster[] = [];

  const items: ClusterMember[] = shifts.flatMap((s) =>
    s.questions
      .filter((q) => typeof q?.question === "string" && q.question.trim().length > 0)
      .map((q) => ({
        question: q.question,
        shift: s.name,
        tokens: tokenize(q.question),
        exact: normalizedText(q.question),
      }))
  );

  for (const item of items) {
    let bestIndex = -1;
    let bestScore = 0;

    // Compare against every existing member rather than a running union of
    // tokens. Accumulating tokens would let a cluster drift: A≈B and B≈C would
    // wrongly pull A and C together even when they are clearly different.
    for (let c = 0; c < clusters.length; c++) {
      for (const member of clusters[c].members) {
        let score: number;
        if (item.tokens.size < MIN_TOKENS_FOR_SIMILARITY || member.tokens.size < MIN_TOKENS_FOR_SIMILARITY) {
          score = item.exact === member.exact && item.exact.length > 0 ? 1 : 0;
        } else {
          score = similarity(item.tokens, member.tokens);
        }
        if (score > bestScore) {
          bestScore = score;
          bestIndex = c;
        }
      }
    }

    if (bestIndex >= 0 && bestScore >= threshold) {
      clusters[bestIndex].members.push(item);
    } else {
      clusters.push({ members: [item] });
    }
  }

  const repeated: RepeatedQuestion[] = [];
  for (const cluster of clusters) {
    const distinctShifts = [...new Set(cluster.members.map((m) => m.shift))];
    if (distinctShifts.length < 2) continue;

    // The first member is the representative; prefer one that carries options
    // and an explanation so the analysis card is actually useful.
    const withExtras =
      cluster.members.find((m) => {
        const q = findQuestion(shifts, m.question);
        return q && (q.options?.length || q.explanation);
      }) || cluster.members[0];
    const source = findQuestion(shifts, withExtras.question) as ShiftQuestion | undefined;

    const variants = [...new Set(cluster.members.map((m) => m.question))];
    const exact = variants.length === 1;

    repeated.push({
      question: withExtras.question,
      topic: source?.topic || "—",
      section: source?.section || "—",
      difficulty: source?.difficulty || "medium",
      shifts: distinctShifts.sort(),
      timesSeen: cluster.members.length,
      variants,
      matchKind: exact ? "exact" : "similar",
      similarity: exact ? 1 : Math.round(bestScoreOf(cluster) * 100),
      explanation: source?.explanation,
      options: source?.options,
      correctAnswer: source?.correctAnswer,
    });
  }

  return repeated.sort(
    (a, b) => b.timesSeen - a.timesSeen || b.similarity - a.similarity || a.question.localeCompare(b.question)
  );
}

function bestScoreOf(cluster: Cluster): number {
  let best = 0;
  for (let i = 0; i < cluster.members.length; i++) {
    for (let j = i + 1; j < cluster.members.length; j++) {
      const a = cluster.members[i].tokens;
      const b = cluster.members[j].tokens;
      if (a.size < MIN_TOKENS_FOR_SIMILARITY || b.size < MIN_TOKENS_FOR_SIMILARITY) continue;
      const s = similarity(a, b);
      if (s > best) best = s;
    }
  }
  return best || 1;
}

function findQuestion(shifts: ExamShift[], question: string): ShiftQuestion | undefined {
  for (const s of shifts) {
    for (const q of s.questions) if (q.question === question) return q;
  }
  return undefined;
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
  exactRepeated: number;
  similarRepeated: number;
  repeated: RepeatedQuestion[];
  topics: TopicStat[];
  difficulty: DifficultyStat[];
  sections: SectionStat[];
}

export function analyze(data: ExamShiftData): ExamAnalysis {
  const all: ShiftQuestion[] = data.shifts.flatMap((s) => s.questions);
  const reportedCount = all.length;
  const repeated = findRepeated(data.shifts);

  // "Distinct" now means distinct clusters, so a question repeated in three
  // shifts counts once rather than three times.
  const distinctCount = repeated.length + (reportedCount - repeated.reduce((a, r) => a + r.timesSeen, 0));

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
    distinctCount,
    repeatedCount: repeated.length,
    exactRepeated: repeated.filter((r) => r.matchKind === "exact").length,
    similarRepeated: repeated.filter((r) => r.matchKind === "similar").length,
    repeated,
    topics: [...topicMap.values()].sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic)),
    difficulty,
    sections: [...sectionCount.entries()]
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count),
  };
}
