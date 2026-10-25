import { Question, Category, CategoryId, QuestionId } from '@/types/audit'

export const QUESTIONS: Record<QuestionId, Question> = {
  // Credentials
  'password-manager': {
    id: 'password-manager',
    category: 'credentials',
    text: 'Use a password manager',
    description: 'Store unique, complex passwords in an encrypted password manager (Bitwarden, 1Password, KeePassXC)',
    weight: 10,
    positive: true,
  },
  'unique-passwords': {
    id: 'unique-passwords',
    category: 'credentials',
    text: 'Unique passwords per service',
    description: 'Never reuse passwords across different websites or services',
    weight: 9,
    positive: true,
  },
  '2fa-enabled': {
    id: '2fa-enabled',
    category: 'credentials',
    text: 'Two-factor authentication enabled',
    description: 'Use 2FA (TOTP authenticator app, hardware key) on all important accounts',
    weight: 10,
    positive: true,
  },
  'passkeys-enabled': {
    id: 'passkeys-enabled',
    category: 'credentials',
    text: 'Passkeys configured',
    description: 'Use passkeys (WebAuthn) where available for phishing-resistant authentication',
    weight: 8,
    positive: true,
  },

  // Browsing
  'browser-tracking': {
    id: 'browser-tracking',
    category: 'browsing',
    text: 'Block third-party trackers',
    description: 'Use uBlock Origin, Privacy Badger, or browser built-in tracking protection',
    weight: 9,
    positive: true,
  },
  'private-search': {
    id: 'private-search',
    category: 'browsing',
    text: 'Use private search engine',
    description: 'Default to DuckDuckGo, Brave Search, Startpage, or Kagi instead of Google',
    weight: 7,
    positive: true,
  },
  'cookie-management': {
    id: 'cookie-management',
    category: 'browsing',
    text: 'Auto-clear cookies/site data',
    description: 'Clear cookies on exit or use container tabs/incognito for sensitive sessions',
    weight: 6,
    positive: true,
  },
  'vpn-usage': {
    id: 'vpn-usage',
    category: 'browsing',
    text: 'Use VPN or encrypted DNS',
    description: 'Encrypt DNS (DoH/DoT) and/or use trusted VPN on public networks',
    weight: 8,
    positive: true,
  },

  // Social Media
  'social-visibility': {
    id: 'social-visibility',
    category: 'social-media',
    text: 'Profiles set to private',
    description: 'Restrict who can see your posts, friends list, and profile info',
    weight: 8,
    positive: true,
  },
  'social-data-sharing': {
    id: 'social-data-sharing',
    category: 'social-media',
    text: 'Limit data sharing with apps',
    description: 'Review and revoke third-party app permissions regularly',
    weight: 7,
    positive: true,
  },
  'social-old-posts': {
    id: 'social-old-posts',
    category: 'social-media',
    text: 'Clean up old posts',
    description: 'Delete or limit visibility of old posts that reveal personal information',
    weight: 5,
    positive: true,
  },
  'social-third-party-apps': {
    id: 'social-third-party-apps',
    category: 'social-media',
    text: 'Audit connected apps',
    description: 'Remove unused apps/games connected to your social accounts',
    weight: 6,
    positive: true,
  },

  // Mobile Permissions
  'app-permissions': {
    id: 'app-permissions',
    category: 'mobile-permissions',
    text: 'Minimal app permissions',
    description: 'Grant only necessary permissions (location, contacts, camera, microphone)',
    weight: 9,
    positive: true,
  },
  'location-tracking': {
    id: 'location-tracking',
    category: 'mobile-permissions',
    text: 'Limit location access',
    description: 'Use "While Using App" or "Approximate Location" instead of "Always"',
    weight: 8,
    positive: true,
  },
  'microphone-camera': {
    id: 'microphone-camera',
    category: 'mobile-permissions',
    text: 'Restrict microphone/camera',
    description: 'Only allow access when actively using the feature',
    weight: 7,
    positive: true,
  },
  'background-data': {
    id: 'background-data',
    category: 'mobile-permissions',
    text: 'Restrict background data',
    description: 'Disable background app refresh and data usage for non-essential apps',
    weight: 5,
    positive: true,
  },

  // Data Sharing
  'ad-personalization': {
    id: 'ad-personalization',
    category: 'data-sharing',
    text: 'Opt out of ad personalization',
    description: 'Disable ad personalization in Google, Meta, Apple, Microsoft accounts',
    weight: 7,
    positive: true,
  },
  'data-broker-optout': {
    id: 'data-broker-optout',
    category: 'data-sharing',
    text: 'Opt out of data brokers',
    description: 'Submit opt-out requests to major data brokers (Whitepages, Spokeo, etc.)',
    weight: 6,
    positive: true,
  },
  'public-records': {
    id: 'public-records',
    category: 'data-sharing',
    text: 'Remove from people search sites',
    description: 'Request removal from people-finder / public records aggregators',
    weight: 5,
    positive: true,
  },
  'email-aliases': {
    id: 'email-aliases',
    category: 'data-sharing',
    text: 'Use email aliases/masks',
    description: 'Use unique email aliases per service (SimpleLogin, AnonAddy, Firefox Relay)',
    weight: 8,
    positive: true,
  },

  // Device Security
  'software-updates': {
    id: 'software-updates',
    category: 'device-security',
    text: 'Auto-update OS and apps',
    description: 'Enable automatic security updates for OS, browser, and applications',
    weight: 10,
    positive: true,
  },
  'disk-encryption': {
    id: 'disk-encryption',
    category: 'device-security',
    text: 'Full disk encryption enabled',
    description: 'FileVault (macOS), BitLocker (Windows), LUKS (Linux) active',
    weight: 9,
    positive: true,
  },
  'screen-lock': {
    id: 'screen-lock',
    category: 'device-security',
    text: 'Strong screen lock',
    description: 'Use 6+ digit PIN, alphanumeric password, or biometric with fallback',
    weight: 8,
    positive: true,
  },
  'backup-encryption': {
    id: 'backup-encryption',
    category: 'device-security',
    text: 'Encrypted backups',
    description: 'Encrypt local and cloud backups (Time Machine, restic, Cryptomator)',
    weight: 7,
    positive: true,
  },
}

export const CATEGORIES: Record<CategoryId, Category> = {
  'browsing': {
    id: 'browsing',
    name: 'Browsing & Network',
    description: 'How you browse the web and protect your network traffic',
    icon: 'globe',
    color: 'muted-blue',
    questions: ['browser-tracking', 'private-search', 'cookie-management', 'vpn-usage'],
    maxScore: 30,
  },
  'social-media': {
    id: 'social-media',
    name: 'Social Media',
    description: 'Visibility and data sharing on social platforms',
    icon: 'users',
    color: 'muted-purple',
    questions: ['social-visibility', 'social-data-sharing', 'social-old-posts', 'social-third-party-apps'],
    maxScore: 26,
  },
  'credentials': {
    id: 'credentials',
    name: 'Credentials & Auth',
    description: 'Password hygiene and authentication security',
    icon: 'key',
    color: 'muted-green',
    questions: ['password-manager', 'unique-passwords', '2fa-enabled', 'passkeys-enabled'],
    maxScore: 37,
  },
  'mobile-permissions': {
    id: 'mobile-permissions',
    name: 'Mobile Permissions',
    description: 'App permissions and sensor access on mobile devices',
    icon: 'smartphone',
    color: 'muted-amber',
    questions: ['app-permissions', 'location-tracking', 'microphone-camera', 'background-data'],
    maxScore: 29,
  },
  'data-sharing': {
    id: 'data-sharing',
    name: 'Data Sharing & Brokers',
    description: 'Third-party data collection and broker opt-outs',
    icon: 'database',
    color: 'muted-rose',
    questions: ['ad-personalization', 'data-broker-optout', 'public-records', 'email-aliases'],
    maxScore: 26,
  },
  'device-security': {
    id: 'device-security',
    name: 'Device Security',
    description: 'Local device protection and encryption',
    icon: 'shield',
    color: 'slate-600',
    questions: ['software-updates', 'disk-encryption', 'screen-lock', 'backup-encryption'],
    maxScore: 34,
  },
}

export const CATEGORY_ORDER: CategoryId[] = [
  'credentials',
  'browsing',
  'device-security',
  'mobile-permissions',
  'social-media',
  'data-sharing',
]

export function getQuestionsByCategory(categoryId: CategoryId): Question[] {
  return CATEGORIES[categoryId].questions.map(id => QUESTIONS[id])
}

export function getAllQuestions(): Question[] {
  return Object.values(QUESTIONS)
}

export function getTotalMaxScore(): number {
  return Object.values(CATEGORIES).reduce((sum, cat) => sum + cat.maxScore, 0)
}