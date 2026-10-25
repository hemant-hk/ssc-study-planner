import { AskAnswer, Resource } from '@/types/govt'
import { FACTS, STATE_FACTS, findStateFact } from './facts'
import { RESOURCES, CATEGORIES } from './resources'
import { search, analyzeQuery } from './search'

function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** State-specific questions: "literacy rate of bihar", "capital of kerala" */
function stateAnswer(query: string): AskAnswer | null {
  const q = normalize(query)
  const state = STATE_FACTS.find(s => q.includes(s.state.toLowerCase()))
  if (!state) return null

  const source = 'Census of India 2011'
  const sourceUrl = 'https://censusindia.gov.in'

  if (/capital/.test(q)) {
    return {
      text: `The capital of ${state.state} is ${state.capital}.`,
      source,
      sourceUrl,
      asOf: 'Census 2011',
    }
  }
  if (/literacy/.test(q)) {
    return {
      text: `${state.state}'s literacy rate was ${state.literacy}% as per Census 2011.`,
      source,
      sourceUrl,
      asOf: 'Census 2011',
    }
  }
  if (/population|people|inhabitants/.test(q)) {
    return {
      text: `${state.state} had a population of ${state.population} (Census 2011).`,
      source,
      sourceUrl,
      asOf: 'Census 2011',
    }
  }
  // generic state profile
  return {
    text: `${state.state} — capital: ${state.capital}; literacy ${state.literacy}% (Census 2011); population ${state.population} (Census 2011).`,
    source,
    sourceUrl,
    asOf: 'Census 2011',
  }
}

/** Match the curated fact base with fuzzy keyword scoring. */
function factAnswer(query: string): AskAnswer | null {
  const q = normalize(query)
  let best: { score: number; answer: AskAnswer } | null = null

  for (const fact of FACTS) {
    let score = 0
    for (const key of fact.match) {
      if (q.includes(key)) score += key.split(' ').length * 3
    }
    // loose token overlap
    const tokens = q.split(' ').filter(t => t.length > 3)
    for (const key of fact.match) {
      for (const t of tokens) {
        if (key.includes(t)) score += 1
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = {
        score,
        answer: {
          text: fact.answer,
          source: fact.source,
          sourceUrl: fact.sourceUrl,
          asOf: fact.asOf,
        },
      }
    }
  }
  return best ? best.answer : null
}

/** Greeting / meta answers */
function metaAnswer(query: string): AskAnswer | null {
  const q = normalize(query)
  if (/^(hi|hello|hey|namaste|namaskar)\b/.test(q)) {
    return {
      text: 'Hello! Ask me about government schemes, datasets, laws, tenders, helplines or published statistics — for example, "What is the literacy rate of Kerala?" or "How do I file an RTI?"',
    }
  }
  if (/what can you|help|who are you|features/.test(q)) {
    return {
      text: 'I answer questions from a curated index of public government resources: welfare schemes, open-data portals, census & economic statistics, laws and RTI, tenders, helplines and budget data. Every answer cites an official source.',
    }
  }
  return null
}

/**
 * Route the question through:
 * 1) meta  2) state profile  3) curated facts  4) search fallback
 */
export function ask(query: string): AskAnswer {
  const q = query.trim()
  if (!q) {
    return { text: 'Ask a question to get started.' }
  }

  const meta = metaAnswer(q)
  if (meta) return meta

  const state = stateAnswer(q)
  if (state) return state

  const fact = factAnswer(q)
  if (fact) return fact

  const results = search(q, 4)
  if (results.length > 0) {
    const analysis = analyzeQuery(q)
    const catLabel =
      analysis.intent !== 'general'
        ? CATEGORIES[
            (Object.entries({
              scheme: 'schemes',
              data: 'portals',
              helpline: 'helplines',
              law: 'laws',
              tender: 'tenders',
              job: 'tenders',
              finance: 'finance',
              stat: 'stats',
            }) as [string, keyof typeof CATEGORIES][]).find(
              ([k]) => k === analysis.intent
            )?.[1] ?? 'portals'
          ].name
        : 'matching'

    const top = results[0].resource
    return {
      text: `I don't have a single-number answer for that, but here's the closest official ${catLabel} resource:\n\n${top.title} — ${top.description}`,
      source: `${top.org}${top.url ? '' : ''}`,
      sourceUrl: top.url,
      related: results.map(r => r.resource),
    }
  }

  return {
    text:
      "I couldn't find that in the public-data index. Try rephrasing with a scheme name, state, year or topic — for example \"PM Awas Yojana eligibility\", \"literacy rate of Bihar\", or \"where to download census data\".",
    related: suggestedResources(),
  }
}

function suggestedResources(): Resource[] {
  return RESOURCES.filter(r =>
    ['data-gov-in', 'rti-portal', 'india-budget', 'census-india'].includes(r.id)
  )
}

export const SUGGESTED_PROMPTS: string[] = [
  'What is the literacy rate of Kerala?',
  'How do I file an RTI?',
  'What is Ayushman Bharat PM-JAY?',
  'Where can I download census data?',
  'Emergency helpline number?',
  'What is the Union Budget size?',
  'PM-KISAN eligibility',
  'How many states in India?',
]
