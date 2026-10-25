export type CategoryId =
  | 'schemes'
  | 'portals'
  | 'stats'
  | 'laws'
  | 'tenders'
  | 'helplines'
  | 'finance'

export interface Resource {
  id: string
  title: string
  description: string
  category: CategoryId
  org: string
  url: string
  tags: string[]
  /** Short hint shown on the card, e.g. "DBT · agriculture" */
  hint?: string
}

export type DatasetFormat = 'API' | 'CSV' | 'Dashboard' | 'PDF' | 'Web'

export interface Dataset {
  id: string
  title: string
  description: string
  org: string
  format: DatasetFormat
  url: string
  tags: string[]
  region: string
}

export interface Helpline {
  id: string
  name: string
  number: string
  description: string
  url?: string
}

export interface StateFact {
  state: string
  capital: string
  literacy: number // %, Census 2011
  population: string // Census 2011
}

export interface Fact {
  id: string
  /** Keywords that should trigger this fact in the Q&A engine */
  match: string[]
  question: string
  answer: string
  source: string
  sourceUrl: string
  asOf: string
}

export interface QueryAnalysis {
  intent:
    | 'scheme'
    | 'data'
    | 'helpline'
    | 'law'
    | 'tender'
    | 'job'
    | 'finance'
    | 'stat'
    | 'general'
  states: string[]
  years: number[]
  terms: string[]
  interpretedAs: string[]
}

export interface SearchResult {
  resource: Resource
  score: number
  matchedOn: string[]
}

export interface AskAnswer {
  text: string
  source?: string
  sourceUrl?: string
  asOf?: string
  related?: Resource[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  answer?: AskAnswer
  time: number
}
