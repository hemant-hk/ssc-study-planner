// Trend and gap analysis over the recorded shift papers.
//
// Two questions drive this file:
//
//  1. What has the exam actually repeated? "Repeated Core Concepts" surfaces
//     clusters of questions that showed up in more than one shift, using the
//     same token-overlap rule as the repeat list so a reworded question counts.
//
//  2. What has *not* appeared yet? SSC draws from a known syllabus, so the gaps
//     are predictable: standard topics with no appearance in any recorded shift
//     are the most likely candidates for the next shift. The syllabus below is
//     the standard CGL Tier-I weighting, not a guess about this particular exam.
import { tokenize, intersectionSize, overlapCoefficient, MIN_SHARED_TOKENS } from "./exam-analysis";
import type { ExamShift } from "./exam-shifts-types";

export interface CoreConcept {
  /** The question text of the first sighting, used as the concept label. */
  label: string;
  topic: string;
  section: string;
  shifts: string[];
  timesSeen: number;
  /** True when the matches were wordings of each other, not identical text. */
  reworded: boolean;
  score: number;
}

/**
 * Core concepts = clusters of questions seen in 2+ different shifts.
 *
 * This is deliberately a looser bar than the repeat list. For repeats we want
 * certainty, because the UI presents them as "this is the same question". For
 * core concepts we want recall: a concept the exam keeps circling is the signal
 * an aspirant prepares from, so clustering at 45% overlap still beats missing
 * it entirely. Every cluster carries its score so the UI can show how firm the
 * grouping is.
 */
export const CORE_CONCEPT_THRESHOLD = 0.45;

interface Member {
  question: string;
  topic: string;
  section: string;
  shift: string;
  tokens: Set<string>;
  normalized: string;
}

export function findCoreConcepts(
  shifts: ExamShift[],
  threshold: number = CORE_CONCEPT_THRESHOLD
): CoreConcept[] {
  const members: Member[] = shifts.flatMap((s) =>
    s.questions
      .filter((q) => typeof q?.question === "string" && q.question.trim().length > 0)
      .map((q) => ({
        question: q.question.trim(),
        topic: q.topic || "General",
        section: q.section || "",
        shift: s.name,
        tokens: tokenize(q.question),
        normalized: q.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
      }))
  );

  const clusters: Member[][] = [];
  for (const item of members) {
    let best: Member[] | null = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      for (const member of cluster) {
        const shared = intersectionSize(item.tokens, member.tokens);
        if (shared < MIN_SHARED_TOKENS) continue;
        const score = overlapCoefficient(item.tokens, member.tokens);
        if (score >= threshold && score > bestScore) {
          best = cluster;
          bestScore = score;
        }
      }
    }
    if (best) best.push(item);
    else clusters.push([item]);
  }

  const out: CoreConcept[] = [];
  for (const cluster of clusters) {
    const distinct = [...new Set(cluster.map((m) => m.shift))];
    if (distinct.length < 2) continue;
    const exact = new Set(cluster.map((m) => m.normalized)).size === 1;
    out.push({
      label: cluster[0].question,
      topic: cluster[0].topic,
      section: cluster[0].section,
      shifts: distinct,
      timesSeen: cluster.length,
      reworded: !exact,
      score: minPairScore(cluster, threshold),
    });
  }
  return out.sort((a, b) => b.timesSeen - a.timesSeen || b.score - a.score);
}

function minPairScore(cluster: Member[], threshold: number): number {
  let lowest = 1;
  for (let i = 0; i < cluster.length; i += 1) {
    for (let j = i + 1; j < cluster.length; j += 1) {
      const a = cluster[i].tokens;
      const b = cluster[j].tokens;
      if (intersectionSize(a, b) < MIN_SHARED_TOKENS) continue;
      const score = overlapCoefficient(a, b);
      if (score < threshold) continue;
      if (score < lowest) lowest = score;
    }
  }
  return Number(lowest.toFixed(2));
}

/**
 * The standard SSC CGL Tier-I syllabus, grouped by section. Used to detect
 * topics that have not appeared in any recorded shift yet.
 *
 * `keywords` are the distinctive words we match against parsed question text.
 * A topic counts as "covered" when a question shares at least one of them, so
 * these are deliberately the words that are unlikely to collide across topics
 * (e.g. "tropic" for a geography topic, not "which").
 */
export interface SyllabusTopic {
  topic: string;
  section: string;
  keywords: string[];
  /** Rough share of the paper in recent years, 1-5. Drives the sort order. */
  weight: number;
}

export const CGL_SYLLABUS: SyllabusTopic[] = [
  // Quantitative Aptitude
  { topic: "Arithmetic - Percent, Ratio & Profit", section: "Quantitative Aptitude", keywords: ["percent", "ratio", "profit", "loss", "discount"], weight: 5 },
  { topic: "Arithmetic - Averages, Time & Work", section: "Quantitative Aptitude", keywords: ["average", "work", "days", "efficiency", "man-days"], weight: 5 },
  { topic: "Arithmetic - Speed, Time & Distance", section: "Quantitative Aptitude", keywords: ["speed", "distance", "train", "boat", "stream", "kmph", "km/h"], weight: 5 },
  { topic: "Algebra - Equations & Polynomials", section: "Quantitative Aptitude", keywords: ["equation", "polynomial", "roots", "quadratic", "expression", "value of"], weight: 4 },
  { topic: "Algebra - Inequalities & Simplification", section: "Quantitative Aptitude", keywords: ["inequality", "simplify", "surds", "simplification"], weight: 3 },
  { topic: "Number System & LCM/HCF", section: "Quantitative Aptitude", keywords: ["divisible", "remainder", "lcm", "hcf", "prime", "factors"], weight: 4 },
  { topic: "Mensuration - Area, Volume & Surface", section: "Quantitative Aptitude", keywords: ["area", "volume", "surface", "cylinder", "cone", "sphere", "triangle", "rectangle", "circle", "radius"], weight: 5 },
  { topic: "Trigonometry - Heights & Distances", section: "Quantitative Aptitude", keywords: ["angle", "triangle", "sin", "cos", "tan", "elevation", "inclination"], weight: 3 },
  { topic: "Data Interpretation - Tables & Graphs", section: "Quantitative Aptitude", keywords: ["table", "graph", "diagram", "following data", "pie chart", "bar graph"], weight: 4 },
  { topic: "Statistics & Probability", section: "Quantitative Aptitude", keywords: ["probability", "dice", "cards", "mean", "median", "standard deviation"], weight: 3 },
  // Reasoning
  { topic: "Analogy & Classification", section: "General Intelligence", keywords: ["analogy", "classification", "odd", "related"], weight: 4 },
  { topic: "Series - Completion & Inequality", section: "General Intelligence", keywords: ["series", "next term", "find the missing", "wrong number"], weight: 4 },
  { topic: "Coding-Decoding", section: "General Intelligence", keywords: ["code", "coded", "decoding", "statement is true"], weight: 3 },
  { topic: "Blood Relations & Direction Sense", section: "General Intelligence", keywords: ["direction", "facing", "relation", "brother", "son of", "left"], weight: 4 },
  { topic: "Syllogism & Statement-Conclusion", section: "General Intelligence", keywords: ["conclusion", "statements", "follows", "syllogism"], weight: 3 },
  { topic: "Seating Arrangement", section: "General Intelligence", keywords: ["arrangement", "seating", "row", "facing north", "circle"], weight: 3 },
  { topic: "Venn Diagrams, Puzzles & Ranking", section: "General Intelligence", keywords: ["venn", "puzzle", "ranking", "order", "letter"], weight: 3 },
  // General Awareness
  { topic: "Indian Polity - Constitution & Articles", section: "General Awareness", keywords: ["constitution", "article", "schedule", "amendment", "parliament"], weight: 5 },
  { topic: "Polity - Fundamental Rights & Duties", section: "General Awareness", keywords: ["right", "duty", "directive", "article"], weight: 4 },
  { topic: "Indian History - Ancient & Medieval", section: "General Awareness", keywords: ["empire", "dynasty", "maurya", "gupta", "chola", "century"], weight: 4 },
  { topic: "Indian History - Modern & Freedom Struggle", section: "General Awareness", keywords: ["movement", "independence", "gandhi", "quit india", "congress"], weight: 4 },
  { topic: "Indian Geography - Physical", section: "General Awareness", keywords: ["river", "mountain", "plateau", "monsoon", "soil", "tropic", "island"], weight: 4 },
  { topic: "Indian Geography - World Geography", section: "General Awareness", keywords: ["country", "continent", "equator", "globe", "latitude"], weight: 3 },
  { topic: "Indian Economy - Basics & Budget", section: "General Awareness", keywords: ["gdp", "inflation", "budget", "rbi", "tax", "economy"], weight: 4 },
  { topic: "Science - Physics", section: "General Awareness", keywords: ["force", "energy", "light", "current", "velocity", "momentum"], weight: 4 },
  { topic: "Science - Chemistry", section: "General Awareness", keywords: ["acid", "element", "reaction", "gas", "compound", "periodic"], weight: 4 },
  { topic: "Science - Biology & Human Body", section: "General Awareness", keywords: ["cell", "blood", "vitamin", "organ", "disease", "plant"], weight: 4 },
  { topic: "Science - Everyday & Environment", section: "General Awareness", keywords: ["environment", "pollution", "ecology", "gas", "layer"], weight: 3 },
  { topic: "Static GK - Books, Awards & Firsts", section: "General Awareness", keywords: ["award", "nobel", "first", "book", "written by", "founded"], weight: 3 },
  { topic: "Static GK - Sports, Capitals & Important Days", section: "General Awareness", keywords: ["capital", "sport", "day", "festival", "national"], weight: 3 },
  // English
  { topic: "Grammar - Error Spotting & Correction", section: "English Comprehension", keywords: ["error", "correct", "sentence", "grammar", "choose"], weight: 4 },
  { topic: "Vocabulary - Synonyms, Antonyms & Idioms", section: "English Comprehension", keywords: ["synonym", "antonym", "idiom", "meaning", "phrase"], weight: 4 },
  { topic: "Fill in the Blanks & Cloze", section: "English Comprehension", keywords: ["blank", "cloze", "fill", "missing word"], weight: 3 },
  { topic: "Reading Comprehension", section: "English Comprehension", keywords: ["passage", "comprehension", "read the following"], weight: 3 },
  { topic: "Active & Passive Voice, Narration", section: "English Comprehension", keywords: ["voice", "passive", "narration", "reported speech"], weight: 2 },
  { topic: "One Word Substitution & Spelling", section: "English Comprehension", keywords: ["substitution", "spelling", "one word", "correctly spelt"], weight: 2 },
];

export interface PredictionGap {
  topic: string;
  section: string;
  weight: number;
}

/**
 * Syllabus topics with no keyword appearing in any recorded question.
 *
 * Sorted by expected weight, so the biggest gaps surface first — a topic that
 * typically takes 6 questions and has not been seen yet is a stronger candidate
 * for the next shift than a 2-question topic.
 */
export function findPredictionGaps(
  shifts: ExamShift[],
  syllabus: SyllabusTopic[] = CGL_SYLLABUS
): PredictionGap[] {
  const corpus = shifts
    .flatMap((s) => s.questions.map((q) => q.question))
    .join(" \n ")
    .toLowerCase();

  return syllabus
    .filter((t) => !t.keywords.some((k) => corpus.includes(k)))
    .map(({ topic, section, weight }) => ({ topic, section, weight }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}
