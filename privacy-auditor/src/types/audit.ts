export type CategoryId = 
  | 'browsing'
  | 'social-media'
  | 'credentials'
  | 'mobile-permissions'
  | 'data-sharing'
  | 'device-security'

export type QuestionId = 
  | 'password-manager'
  | 'unique-passwords'
  | '2fa-enabled'
  | 'passkeys-enabled'
  | 'browser-tracking'
  | 'private-search'
  | 'cookie-management'
  | 'vpn-usage'
  | 'social-visibility'
  | 'social-data-sharing'
  | 'social-old-posts'
  | 'social-third-party-apps'
  | 'app-permissions'
  | 'location-tracking'
  | 'microphone-camera'
  | 'background-data'
  | 'ad-personalization'
  | 'data-broker-optout'
  | 'public-records'
  | 'email-aliases'
  | 'software-updates'
  | 'disk-encryption'
  | 'screen-lock'
  | 'backup-encryption'

export interface Question {
  id: QuestionId
  category: CategoryId
  text: string
  description: string
  weight: number // 1-10 impact weight
  positive: boolean // true = good practice, false = risky behavior
}

export interface Category {
  id: CategoryId
  name: string
  description: string
  icon: string
  color: string
  questions: QuestionId[]
  maxScore: number
}

export interface Answer {
  questionId: QuestionId
  value: boolean // true = user follows good practice / false = risk present
  timestamp: number
}

export interface CategoryScore {
  categoryId: CategoryId
  score: number // 0-100
  maxScore: number
  answeredQuestions: number
  totalQuestions: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface PrivacyScore {
  overall: number // 0-100
  categories: CategoryScore[]
  totalAnswered: number
  totalQuestions: number
  completedAt?: number
}

export interface MitigationAction {
  id: string
  categoryId: CategoryId
  questionId: QuestionId
  title: string
  description: string
  steps: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  timeEstimate: string // e.g., "5 min", "30 min"
  priority: number // 1-10
  resources: ResourceLink[]
  completed: boolean
}

export interface ResourceLink {
  title: string
  url: string
  type: 'guide' | 'tool' | 'video' | 'article'
  description?: string
}

export interface PrivacyTool {
  id: string
  name: string
  category: 'password-manager' | 'browser' | 'email' | 'vpn' | 'dns' | 'messaging' | 'search' | 'other'
  description: string
  website: string
  openSource: boolean
  free: boolean
  platforms: string[]
  tags: string[]
  rating?: number
}

export interface AssessmentState {
  currentStep: number
  answers: Partial<Record<QuestionId, boolean>>
  startedAt: number
  completedAt?: number
  version: number
}

export const STORAGE_KEYS = {
  ASSESSMENT: 'privacy-audit-assessment',
  SCORE: 'privacy-audit-score',
  MITIGATIONS: 'privacy-audit-mitigations',
  PREFERENCES: 'privacy-audit-preferences',
} as const

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  animations: boolean
  compactMode: boolean
  dataRetentionDays: number
}