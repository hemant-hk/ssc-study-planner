import { CategoryId, QueryAnalysis, Resource, SearchResult } from '@/types/govt'
import { RESOURCES, CATEGORY_ORDER } from './resources'
import { STATE_FACTS } from './facts'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'is',
  'are', 'how', 'what', 'where', 'which', 'do', 'does', 'can', 'i',
  'my', 'me', 'please', 'with', 'from', 'at', 'by', 'be', 'get', 'find',
])

const INTENT_KEYWORDS: Record<Exclude<QueryAnalysis['intent'], 'general'>, string[]> = {
  scheme: ['scheme', 'yojana', 'yojana', 'benefit', 'welfare', 'eligibility', 'apply', 'subsidy', 'dbt', 'instalment'],
  data: ['data', 'dataset', 'download', 'csv', 'api', 'portal', 'statistics', 'open data', 'table'],
  helpline: ['helpline', 'number', 'toll free', 'call', 'emergency', 'dial', 'contact no', 'help line'],
  law: ['law', 'act', 'rule', 'legal', 'rti', 'bill', 'judgment', 'court', 'constitution', 'section'],
  tender: ['tender', 'procurement', 'bid', 'rfp', 'quotation', 'gem', 'contract'],
  job: ['job', 'vacancy', 'recruitment', 'employment', 'exam', 'form', 'notification', 'unemployment'],
  finance: ['budget', 'tax', 'gst', 'finance', 'interest rate', 'rbi', 'deficit', 'receipt', 'expenditure'],
  stat: ['population', 'literacy', 'census', 'gdp', 'rate', 'percent', '%', 'growth', 'index'],
}

const CATEGORY_HINTS: Record<CategoryId, string[]> = {
  schemes: ['scheme', 'yojana', 'welfare', 'benefit'],
  portals: ['portal', 'website', 'directory', 'platform'],
  stats: ['statistics', 'census', 'data', 'stats', 'survey', 'index'],
  laws: ['law', 'act', 'legal', 'rti', 'court', 'bill'],
  tenders: ['tender', 'procurement', 'bid'],
  helplines: ['helpline', 'emergency', 'call', 'number'],
  finance: ['budget', 'tax', 'finance', 'banking', 'market'],
}

export function analyzeQuery(query: string): QueryAnalysis {
  const q = query.toLowerCase().trim()
  const terms = q
    .split(/[^a-z0-9₹%]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))

  // intent: score each bucket by keyword hits (word-boundary prefixed match)
  const hasKeyword = (word: string): boolean => {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^a-z0-9])${esc}`).test(q)
  }
  let intent: QueryAnalysis['intent'] = 'general'
  let best = 0
  for (const [key, words] of Object.entries(INTENT_KEYWORDS)) {
    const hits = words
      .filter(hasKeyword)
      .reduce((n, w) => n + w.split(' ').length, 0)
    if (hits > best) {
      best = hits
      intent = key as QueryAnalysis['intent']
    }
  }

  // entity extraction: states & years
  const states = STATE_FACTS.filter(s => q.includes(s.state.toLowerCase())).map(
    s => s.state
  )
  const years = (q.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number)

  const interpretedAs: string[] = []
  if (intent !== 'general') interpretedAs.push(`${intent} query`)
  if (states.length) interpretedAs.push(`region: ${states.join(', ')}`)
  if (years.length) interpretedAs.push(`year: ${years.join(', ')}`)

  return { intent, states, years, terms, interpretedAs }
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[n]
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function fuzzyHit(term: string, word: string): boolean {
  if (term === word) return true
  if (term.length >= 4 && word.includes(term)) return true
  if (word.length >= 4 && term.includes(word)) return true
  return term.length >= 5 && word.length >= 5 && levenshtein(term, word) <= 2
}

/** Score one resource against the query. Returns 0 when irrelevant. */
function scoreResource(
  resource: Resource,
  analysis: QueryAnalysis
): { score: number; matchedOn: string[] } {
  let score = 0
  const matchedOn: string[] = []
  const titleWords = tokenize(resource.title)
  const descWords = tokenize(resource.description)
  const tagWords = resource.tags.flatMap(tokenize)
  const all = [...titleWords, ...descWords, ...tagWords]

  for (const term of analysis.terms) {
    if (titleWords.some(w => fuzzyHit(term, w))) {
      score += 3
      if (!matchedOn.includes('title')) matchedOn.push('title')
    } else if (tagWords.some(w => fuzzyHit(term, w))) {
      score += 2.5
      if (!matchedOn.includes('tags')) matchedOn.push('tags')
    } else if (descWords.some(w => fuzzyHit(term, w))) {
      score += 1.5
      if (!matchedOn.includes('description')) matchedOn.push('description')
    } else if (all.some(w => fuzzyHit(term, w))) {
      score += 1
    }
  }

  // intent → category affinity bonus
  const intentCategory: Partial<Record<QueryAnalysis['intent'], CategoryId>> = {
    scheme: 'schemes',
    data: 'portals',
    helpline: 'helplines',
    law: 'laws',
    tender: 'tenders',
    job: 'tenders',
    finance: 'finance',
    stat: 'stats',
  }
  const preferred = intentCategory[analysis.intent]
  if (preferred && resource.category === preferred) score += 2

  // entity match bonus
  for (const st of analysis.states) {
    if (resource.title.includes(st) || resource.description.includes(st)) score += 3
    if (resource.tags.some(t => t.toLowerCase() === st.toLowerCase())) score += 2
  }

  return { score, matchedOn }
}

export function search(query: string, limit = 20): SearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const analysis = analyzeQuery(trimmed)

  const results: SearchResult[] = RESOURCES.map(resource => {
    const { score, matchedOn } = scoreResource(resource, analysis)
    return { resource, score, matchedOn }
  })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)

  if (results.length > 0) return results.slice(0, limit)

  // fallback: category-hint browse when nothing matches
  const q = trimmed.toLowerCase()
  const cat = CATEGORY_ORDER.find(c => CATEGORY_HINTS[c].some(h => q.includes(h)))
  if (cat) {
    return RESOURCES.filter(r => r.category === cat)
      .slice(0, limit)
      .map(resource => ({ resource, score: 1, matchedOn: ['category'] }))
  }
  return []
}

export function getPopularQueries(): string[] {
  return [
    'Ayushman Bharat eligibility',
    'file RTI online',
    'Union budget documents',
    'unemployment rate data',
    'emergency helpline number',
    'PM-KISAN status',
    'census literacy by district',
    'government tenders',
  ]
}
