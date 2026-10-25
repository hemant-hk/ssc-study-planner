import { PrivacyScore, CategoryScore, CategoryId, QuestionId, Answer, MitigationAction } from '@/types/audit'
import { CATEGORIES, QUESTIONS, CATEGORY_ORDER } from './questions'

export function getRiskLevel(percentage: number): CategoryScore['riskLevel'] {
  if (percentage >= 80) return 'low'
  if (percentage >= 55) return 'medium'
  if (percentage >= 30) return 'high'
  return 'critical'
}

export type AnswerMap = Partial<Record<QuestionId, boolean>>

export function calculateCategoryScore(
  categoryId: CategoryId,
  answers: AnswerMap
): CategoryScore {
  const category = CATEGORIES[categoryId]
  const questionIds = category.questions
  const answered = questionIds.filter(id => answers[id] !== undefined)
  
  if (answered.length === 0) {
    return {
      categoryId,
      score: 0,
      maxScore: category.maxScore,
      answeredQuestions: 0,
      totalQuestions: questionIds.length,
      riskLevel: 'critical',
    }
  }

  let earned = 0
  let available = 0

  for (const qid of questionIds) {
    const q = QUESTIONS[qid]
    available += q.weight
    if (answers[qid] === true) earned += q.weight
  }

  const percentage = available > 0 ? Math.round((earned / available) * 100) : 0

  return {
    categoryId,
    score: percentage,
    maxScore: category.maxScore,
    answeredQuestions: answered.length,
    totalQuestions: questionIds.length,
    riskLevel: getRiskLevel(percentage),
  }
}

export function calculatePrivacyScore(answers: AnswerMap): PrivacyScore {
  const categories = CATEGORY_ORDER.map(id => calculateCategoryScore(id, answers))

  const totalQuestions = Object.keys(QUESTIONS).length
  const totalAnswered = Object.keys(answers).filter(
    k => answers[k as QuestionId] !== undefined
  ).length

  const answeredEntries = Object.entries(answers).filter(
    ([, v]) => v !== undefined
  )
  const earned = answeredEntries.reduce((sum, [qid, val]) => {
    const q = QUESTIONS[qid as QuestionId]
    if (!q) return sum
    return sum + (val === true ? q.weight : 0)
  }, 0)
  const possible = answeredEntries.reduce((sum, [qid]) => {
    const q = QUESTIONS[qid as QuestionId]
    return sum + (q ? q.weight : 0)
  }, 0)

  const overall = possible > 0 ? Math.round((earned / possible) * 100) : 0

  return {
    overall,
    categories,
    totalAnswered,
    totalQuestions,
    completedAt: totalAnswered === totalQuestions ? Date.now() : undefined,
  }
}

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Excellent', color: 'text-emerald-600' }
  if (score >= 70) return { label: 'Good', color: 'text-green-600' }
  if (score >= 55) return { label: 'Fair', color: 'text-amber-600' }
  if (score >= 35) return { label: 'At Risk', color: 'text-orange-500' }
  return { label: 'High Risk', color: 'text-red-500' }
}

export function buildMitigationChecklist(answers: AnswerMap): MitigationAction[] {
  const actions: MitigationAction[] = []

  for (const [qid, answered] of Object.entries(answers)) {
    const q = QUESTIONS[qid as QuestionId]
    if (!q || answered !== false) continue

    const action = MITIGATION_TEMPLATES[qid as QuestionId]
    if (action) actions.push({ ...action, completed: false })
  }

  actions.sort((a, b) => b.priority - a.priority)
  return actions
}

export const MITIGATION_TEMPLATES: Record<QuestionId, Omit<MitigationAction, 'completed'>> = {
  'password-manager': {
    id: 'mit-password-manager',
    categoryId: 'credentials',
    questionId: 'password-manager',
    title: 'Set up a password manager',
    description: 'Adopt an encrypted password manager to generate and store unique passwords.',
    steps: [
      'Choose an open-source manager: Bitwarden (free tier) or KeePassXC (fully local).',
      'Create a strong, memorable master passphrase (4+ random words).',
      'Import passwords from your browser\'s built-in store.',
      'Replace reused/weak passwords service by service, starting with email and banking.',
      'Enable emergency access or share recovery code with a trusted person.',
    ],
    difficulty: 'easy',
    timeEstimate: '30–60 min setup, ongoing',
    priority: 10,
    resources: [
      { title: 'Bitwarden', url: 'https://bitwarden.com', type: 'tool' },
      { title: 'KeePassXC', url: 'https://keepassxc.org', type: 'tool' },
      { title: 'Passphrase generator', url: 'https://bitwarden.com/password-generator/', type: 'tool' },
    ],
  },
  'unique-passwords': {
    id: 'mit-unique-passwords',
    categoryId: 'credentials',
    questionId: 'unique-passwords',
    title: 'Eliminate reused passwords',
    description: 'Every service gets a unique password to prevent credential-stuffing attacks.',
    steps: [
      'Audit your browser\'s saved-password list for duplicates.',
      'Prioritize: email, financial, cloud storage, then everything else.',
      'Generate a unique 16+ char password for each reused account.',
      'Change reused passwords immediately on high-risk accounts.',
      'Enable breach monitoring (Bitwarden / HaveIBeenPwned).',
    ],
    difficulty: 'medium',
    timeEstimate: '1–2 hours',
    priority: 9,
    resources: [
      { title: 'Have I Been Pwned', url: 'https://haveibeenpwned.com', type: 'tool' },
      { title: 'Password strength test', url: 'https://howsecureismypassword.net', type: 'tool' },
    ],
  },
  '2fa-enabled': {
    id: 'mit-2fa',
    categoryId: 'credentials',
    questionId: '2fa-enabled',
    title: 'Enable two-factor authentication',
    description: 'Protect accounts with a second factor — prefer authenticator apps or hardware keys over SMS.',
    steps: [
      'Install an authenticator app: Aegis (Android), 2FAS, or Raivo OTP (iOS).',
      'Enable TOTP on your email account first (highest-value target).',
      'Add 2FA to financial, social, and cloud-storage accounts.',
      'Replace SMS 2FA with app-based or passkey 2FA where offered.',
      'Store backup codes in your password manager.',
      'Upgrade to a hardware key (YubiKey) for your most critical accounts.',
    ],
    difficulty: 'easy',
    timeEstimate: '20–40 min',
    priority: 10,
    resources: [
      { title: '2FA Directory', url: 'https://2fa.directory', type: 'guide' },
      { title: 'Aegis Authenticator', url: 'https://getaegis.app', type: 'tool' },
      { title: 'YubiKey', url: 'https://yubico.com', type: 'tool' },
    ],
  },
  'passkeys-enabled': {
    id: 'mit-passkeys',
    categoryId: 'credentials',
    questionId: 'passkeys-enabled',
    title: 'Adopt passkeys',
    description: 'Passkeys are phishing-resistant, passwordless sign-in supported by major platforms.',
    steps: [
      'Check passkey support at passkeys.directory for your key services.',
      'Create a passkey for your primary email and password manager.',
      'Enable on social and e-commerce accounts as they become available.',
      'Sync via your platform\'s keychain (iCloud Keychain, Google Password Manager) or a manager like Bitwarden.',
      'Keep one recovery method (backup key or codes) in case of device loss.',
    ],
    difficulty: 'easy',
    timeEstimate: '15 min',
    priority: 7,
    resources: [
      { title: 'Passkeys Directory', url: 'https://passkeys.directory', type: 'tool' },
      { title: 'FIDO Alliance — What are passkeys?', url: 'https://fidoalliance.org/passkeys/', type: 'guide' },
    ],
  },
  'browser-tracking': {
    id: 'mit-trackers',
    categoryId: 'browsing',
    questionId: 'browser-tracking',
    title: 'Block third-party trackers',
    description: 'Install a tracker blocker and enable your browser\'s built-in protections.',
    steps: [
      'Install uBlock Origin (Firefox/Chromium) with default lists.',
      'Enable Enhanced Tracking Protection (Firefox) or Similar features (Brave, Safari).',
      'Add Privacy Badger or ClearURLs for supplemental protection.',
      'For Chrome: switch to Firefox or Brave if possible — Manifest V3 limits blocking.',
      'Allow-list sites you trust so blocking doesn\'t break them.',
    ],
    difficulty: 'easy',
    timeEstimate: '10 min',
    priority: 9,
    resources: [
      { title: 'uBlock Origin', url: 'https://ublockorigin.com', type: 'tool' },
      { title: 'Privacy Badger', url: 'https://privacybadger.org', type: 'tool' },
      { title: 'EFF Cover Your Tracks', url: 'https://coveryourtracks.eff.org', type: 'guide' },
    ],
  },
  'private-search': {
    id: 'mit-private-search',
    categoryId: 'browsing',
    questionId: 'private-search',
    title: 'Switch to a private search engine',
    description: 'Stop handing your queries to ad-tech companies.',
    steps: [
      'Set DuckDuckGo or Brave Search as your default search engine.',
      'For better quality: consider Kagi (paid) or Startpage (Google results, no tracking).',
      'Update default search in all browsers and devices.',
      'Disable search-history personalization in your old engine\'s account settings.',
    ],
    difficulty: 'easy',
    timeEstimate: '5 min',
    priority: 6,
    resources: [
      { title: 'DuckDuckGo', url: 'https://duckduckgo.com', type: 'tool' },
      { title: 'Kagi Search', url: 'https://kagi.com', type: 'tool' },
      { title: 'Startpage', url: 'https://startpage.com', type: 'tool' },
    ],
  },
  'cookie-management': {
    id: 'mit-cookies',
    categoryId: 'browsing',
    questionId: 'cookie-management',
    title: 'Automate cookie and site-data cleanup',
    description: 'Clear tracking cookies on exit and isolate sessions.',
    steps: [
      'Enable "Clear cookies and site data when you close all windows" in browser settings.',
      'Install "I don\'t care about cookies" or use uBlock\'s cookie-notice filters.',
      'Use Firefox Multi-Account Containers to isolate work/personal/logins.',
      'Periodically run a full site-data wipe from settings.',
      'Decline non-essential cookies; use an extension to auto-reject banners.',
    ],
    difficulty: 'easy',
    timeEstimate: '10 min',
    priority: 5,
    resources: [
      { title: 'Firefox Containers', url: 'https://support.mozilla.org/en-US/kb/containers', type: 'guide' },
      { title: 'Cookie AutoDelete', url: 'https://github.com/Cookie-AutoDelete/Cookie-AutoDelete', type: 'tool' },
    ],
  },
  'vpn-usage': {
    id: 'mit-vpn',
    categoryId: 'browsing',
    questionId: 'vpn-usage',
    title: 'Encrypt DNS and consider a VPN',
    description: 'Prevent your ISP (and network operators) from logging every site you visit.',
    steps: [
      'Enable DNS-over-HTTPS: use Cloudflare 1.1.1.1, NextDNS, or Mullvad DNS.',
      'On public Wi-Fi, use a trustworthy VPN (Mullvad, IVPN, Proton VPN).',
      'Read the provider\'s no-logs policy; prefer audited providers.',
      'Configure the VPN/DNS at router level for whole-home coverage if comfortable.',
    ],
    difficulty: 'medium',
    timeEstimate: '15–30 min',
    priority: 7,
    resources: [
      { title: 'Mullvad VPN', url: 'https://mullvad.net', type: 'tool' },
      { title: 'NextDNS', url: 'https://nextdns.io', type: 'tool' },
      { title: 'Proton VPN (free)', url: 'https://protonvpn.com', type: 'tool' },
    ],
  },
  'social-visibility': {
    id: 'mit-social-visibility',
    categoryId: 'social-media',
    questionId: 'social-visibility',
    title: 'Lock down social profiles',
    description: 'Make posts and personal details visible only to people you trust.',
    steps: [
      'Set account visibility to Private/Friends-only on each platform.',
      'Remove phone number, birth year, and hometown from public profiles.',
      'Disable search-engine indexing of your profile where offered.',
      'Review tagged photos and remove location-revealing content.',
      'Do a Google search of your name/handles to spot public leaks.',
    ],
    difficulty: 'easy',
    timeEstimate: '20 min',
    priority: 7,
    resources: [
      { title: 'Facebook privacy checkup', url: 'https://www.facebook.com/privacy/checkup', type: 'guide' },
      { title: 'X/Twitter privacy settings', url: 'https://x.com/settings/privacy_and_safety', type: 'guide' },
    ],
  },
  'social-data-sharing': {
    id: 'mit-social-sharing',
    categoryId: 'social-media',
    questionId: 'social-data-sharing',
    title: 'Cut data sharing with third parties',
    description: 'Stop platforms from sharing your activity with advertisers and partners.',
    steps: [
      'Disable ad personalization and off-platform activity sharing.',
      'Turn off "share with business partners" toggles.',
      'Revoke app/website connections under Settings → Apps.',
      'Download your data archive, then review what\'s stored.',
      'Delete the archive and repeat quarterly.',
    ],
    difficulty: 'easy',
    timeEstimate: '20–30 min',
    priority: 6,
    resources: [
      { title: 'Meta privacy settings', url: 'https://www.facebook.com/settings?tab=privacy', type: 'guide' },
      { title: 'Google Ad Settings', url: 'https://adssettings.google.com', type: 'guide' },
    ],
  },
  'social-old-posts': {
    id: 'mit-old-posts',
    categoryId: 'social-media',
    questionId: 'social-old-posts',
    title: 'Prune old posts and activity',
    description: 'Old posts often expose addresses, routines, or relationships.',
    steps: [
      'Delete or archive posts older than 1–2 years.',
      'Remove check-ins and location-tagged content.',
      'Set past posts to "Friends only" or use platform bulk-privacy tools.',
      'Clear likes/follows on sensitive topics (health, politics).',
      'Consider tools like Postpone or Clear Social for bulk cleanup.',
    ],
    difficulty: 'medium',
    timeEstimate: '1 hour',
    priority: 5,
    resources: [
      { title: 'Facebook activity log', url: 'https://www.facebook.com/me/allactivity', type: 'guide' },
      { title: 'TweetDelete', url: 'https://www.tweetdelete.net', type: 'tool' },
    ],
  },
  'social-third-party-apps': {
    id: 'mit-connected-apps',
    categoryId: 'social-media',
    questionId: 'social-third-party-apps',
    title: 'Disconnect unused third-party apps',
    description: 'Old OAuth connections keep reading your data long after you stop using them.',
    steps: [
      'Open Settings → Security → Connected apps (or Apps & websites).',
      'Revoke every app you don\'t actively use.',
      'For remaining apps, remove unnecessary permission scopes.',
      'Do this for Google, Facebook, X, Apple, Spotify, and GitHub.',
      'Calendar a quarterly reminder.',
    ],
    difficulty: 'easy',
    timeEstimate: '15 min',
    priority: 6,
    resources: [
      { title: 'Google connected apps', url: 'https://myaccount.google.com/permissions', type: 'guide' },
      { title: 'Apple ID connected apps', url: 'https://account.apple.com', type: 'guide' },
      { title: 'GitHub OAuth apps', url: 'https://github.com/settings/applications', type: 'guide' },
    ],
  },
  'app-permissions': {
    id: 'mit-app-permissions',
    categoryId: 'mobile-permissions',
    questionId: 'app-permissions',
    title: 'Audit mobile app permissions',
    description: 'Most apps request more access than they need.',
    steps: [
      'Settings → Privacy → Permission manager (Android) or Privacy → permissions (iOS).',
      'Review Camera, Microphone, Contacts, Location, Storage per app.',
      'Set unused permissions to "Deny" or "Ask every time".',
      'Delete apps you haven\'t used in 90 days.',
      'Prefer progressive web apps or lite versions where possible.',
    ],
    difficulty: 'easy',
    timeEstimate: '20–30 min',
    priority: 8,
    resources: [
      { title: 'Android permission controls', url: 'https://support.google.com/android/answer/9431959', type: 'guide' },
      { title: 'iOS app privacy report', url: 'https://support.apple.com/en-us/105085', type: 'guide' },
    ],
  },
  'location-tracking': {
    id: 'mit-location',
    categoryId: 'mobile-permissions',
    questionId: 'location-tracking',
    title: 'Minimize location tracking',
    description: 'Continuous location history is one of the most sensitive data trails.',
    steps: [
      'Set location to "While Using App" or "Approximate" instead of "Always/Exact".',
      'Pause or delete Google/Apple location history.',
      'Turn off Wi-Fi/Bluetooth scanning used for location.',
      'Disable geotagging in camera settings.',
      'Remove weather/location widgets that poll continuously.',
    ],
    difficulty: 'easy',
    timeEstimate: '10–15 min',
    priority: 8,
    resources: [
      { title: 'Google Maps timeline controls', url: 'https://www.google.com/maps/timeline', type: 'guide' },
      { title: 'Apple Significant Locations', url: 'https://support.apple.com/guide/iphone/view-or-delete-significant-locations-iphf4be1d671/ios', type: 'guide' },
    ],
  },
  'microphone-camera': {
    id: 'mit-mic-camera',
    categoryId: 'mobile-permissions',
    questionId: 'microphone-camera',
    title: 'Restrict microphone and camera access',
    description: 'Sensor indicators exist for a reason — only grant access to trusted apps actively in use.',
    steps: [
      'Set both permissions to "While Using" or "Never" by default.',
      'Remove permissions from social/media apps that don\'t need them.',
      'On iOS, review the privacy report to see background sensor use.',
      'On Android, watch for the camera/mic indicator and investigate unexpected use.',
      'Cover laptop webcams when not in use.',
    ],
    difficulty: 'easy',
    timeEstimate: '10 min',
    priority: 7,
    resources: [
      { title: 'iOS privacy report guide', url: 'https://support.apple.com/en-us/105085', type: 'guide' },
    ],
  },
  'background-data': {
    id: 'mit-background-data',
    categoryId: 'mobile-permissions',
    questionId: 'background-data',
    title: 'Restrict background data and refresh',
    description: 'Background sync increases your tracking surface and battery drain.',
    steps: [
      'Disable Background App Refresh for non-essential apps.',
      'Restrict background data usage per app (Android Data Saver).',
      'Turn off auto-sync for accounts you rarely use.',
      'Disable push email for low-value accounts — check manually instead.',
    ],
    difficulty: 'easy',
    timeEstimate: '10 min',
    priority: 4,
    resources: [],
  },
  'ad-personalization': {
    id: 'mit-ad-prefs',
    categoryId: 'data-sharing',
    questionId: 'ad-personalization',
    title: 'Opt out of ad personalization',
    description: 'Every major platform lets you opt out of profile-based ad targeting.',
    steps: [
      'Google: adssettings.google.com → turn off Ad Personalization.',
      'Meta: Settings → Ad preferences → disable "Ads based on data from partners".',
      'Apple: Settings → Privacy → Apple Advertising → turn off Personalized Ads.',
      'Microsoft: privacy.microsoft.com → disable advertising ID.',
      'Note: you\'ll still see ads — just not targeted ones.',
    ],
    difficulty: 'easy',
    timeEstimate: '15 min',
    priority: 6,
    resources: [
      { title: 'Google Ad Settings', url: 'https://adssettings.google.com', type: 'tool' },
      { title: 'YourAdChoices', url: 'https://optout.aboutads.info', type: 'tool' },
      { title: 'NAI opt-out', url: 'https://optout.networkadvertising.org', type: 'tool' },
    ],
  },
  'data-broker-optout': {
    id: 'mit-brokers',
    categoryId: 'data-sharing',
    questionId: 'data-broker-optout',
    title: 'Opt out of data brokers',
    description: 'Broker sites aggregate your public records into profiles anyone can buy.',
    steps: [
      'Search yourself on Whitepages, Spokeo, BeenVerified, Intelius.',
      'Submit opt-out requests on each site (usually a hidden form).',
      'Use JustDeleteMe or a service like DeleteMe/Kanary for bulk requests.',
      'Re-check every 6 months — brokers re-add profiles.',
      'Consider a "removal" calendar reminder.',
    ],
    difficulty: 'medium',
    timeEstimate: '1–2 hours first pass',
    priority: 7,
    resources: [
      { title: 'JustDeleteMe', url: 'https://justdeleteme.xyz', type: 'tool' },
      { title: 'EasyOptOuts (free)', url: 'https://easyoptouts.org', type: 'tool' },
      { title: 'Privacy.com', url: 'https://privacy.com', type: 'tool' },
    ],
  },
  'public-records': {
    id: 'mit-people-search',
    categoryId: 'data-sharing',
    questionId: 'public-records',
    title: 'Remove yourself from people-search sites',
    description: 'People-finder aggregators expose addresses, relatives, and phone numbers.',
    steps: [
      'Google yourself: `"<full name>" address` etc. — list every hit.',
      'Request removal on each people-search site (must repeat yearly).',
      'Opt out of FastPeopleSearch, TruePeopleSearch, Radaris (free, no account).',
      'Request removal from Google results pointing to those pages.',
      'Remove your info from voter-registration mirrors where allowed.',
    ],
    difficulty: 'medium',
    timeEstimate: '1–2 hours first pass',
    priority: 6,
    resources: [
      { title: 'FastPeopleSearch opt-out', url: 'https://www.fastpeoplesearch.com/removal-request', type: 'guide' },
      { title: 'TruePeopleSearch opt-out', url: 'https://truepeoplesearch.com/removal', type: 'guide' },
      { title: 'Google removals', url: 'https://search.google.com/search-console/remove-outdated-content', type: 'guide' },
    ],
  },
  'email-aliases': {
    id: 'mit-aliases',
    categoryId: 'data-sharing',
    questionId: 'email-aliases',
    title: 'Use email aliases and masks',
    description: 'Unique aliases let you disable any leaked address instantly.',
    steps: [
      'Set up SimpleLogin, Firefox Relay, or Addy.io.',
      'Create an alias for each service you sign up for going forward.',
      'Migrate high-risk accounts (shopping, newsletters) to aliases.',
      'Set a catch-all plus-address rule as a zero-cost fallback (name+site@domain).',
      'If an alias starts getting spam, disable it — your real address stays clean.',
    ],
    difficulty: 'easy',
    timeEstimate: '20 min setup',
    priority: 7,
    resources: [
      { title: 'SimpleLogin', url: 'https://simplelogin.io', type: 'tool' },
      { title: 'Firefox Relay', url: 'https://relay.firefox.com', type: 'tool' },
      { title: 'Addy.io', url: 'https://addy.io', type: 'tool' },
    ],
  },
  'software-updates': {
    id: 'mit-updates',
    categoryId: 'device-security',
    questionId: 'software-updates',
    title: 'Enable automatic updates',
    description: 'Unpatched software is the #1 exploited attack vector.',
    steps: [
      'macOS: System Settings → General → Software Update → Automatic Updates on.',
      'Windows: Settings → Windows Update → enable auto restart & driver updates.',
      'Linux: enable unattended-upgrades (Debian/Ubuntu) or your distro equivalent.',
      'Enable auto-update for browser and password manager.',
      'Restart your devices weekly so pending updates apply.',
    ],
    difficulty: 'easy',
    timeEstimate: '5 min',
    priority: 9,
    resources: [
      { title: 'Ubuntu unattended-upgrades', url: 'https://wiki.ubuntu.com/UnattendedUpgrades', type: 'guide' },
      { title: 'NVD vulnerability database', url: 'https://nvd.nist.gov', type: 'tool' },
    ],
  },
  'disk-encryption': {
    id: 'mit-disk-encryption',
    categoryId: 'device-security',
    questionId: 'disk-encryption',
    title: 'Enable full disk encryption',
    description: 'Encryption protects your data if your device is lost or stolen.',
    steps: [
      'macOS: enable FileVault in System Settings → Privacy & Security.',
      'Windows: enable BitLocker (Pro) or Device Encryption (Home).',
      'Linux: enable LUKS during install, or use cryptsetup on an existing disk.',
      'Store the recovery key somewhere safe (password manager, printed backup).',
      'Encrypt external drives too when transporting them.',
    ],
    difficulty: 'medium',
    timeEstimate: '15–30 min',
    priority: 9,
    resources: [
      { title: 'FileVault guide', url: 'https://support.apple.com/en-us/102654', type: 'guide' },
      { title: 'BitLocker guide', url: 'https://support.microsoft.com/en-us/windows/turn-on-device-encryption-in-windows-11-', type: 'guide' },
    ],
  },
  'screen-lock': {
    id: 'mit-screen-lock',
    categoryId: 'device-security',
    questionId: 'screen-lock',
    title: 'Strengthen your screen lock',
    description: 'A weak or absent lock makes encryption irrelevant in physical-access attacks.',
    steps: [
      'Set auto-lock to 1 minute or less.',
      'Use a 6+ digit PIN, alphanumeric password, or passphrase.',
      'Avoid simple PINs (123456, 000000, birthdays).',
      'Enable biometrics with a strong fallback PIN/passphrase.',
      'On desktop, lock the screen when stepping away (Win+L / Ctrl+Cmd+Q).',
    ],
    difficulty: 'easy',
    timeEstimate: '5 min',
    priority: 8,
    resources: [],
  },
  'backup-encryption': {
    id: 'mit-encrypted-backups',
    categoryId: 'device-security',
    questionId: 'backup-encryption',
    title: 'Encrypt your backups',
    description: 'Unencrypted backups (cloud or local) bypass all device security.',
    steps: [
      'macOS Time Machine: encrypt the backup disk when prompted.',
      'Windows: enable File History or system-image encryption.',
      'Use restic or BorgBackup with a passphrase for local/remote backups.',
      'For cloud storage: wrap files in Cryptomator before uploading.',
      'Test a restore once — untested backups fail when you need them.',
    ],
    difficulty: 'medium',
    timeEstimate: '30–60 min',
    priority: 7,
    resources: [
      { title: 'restic', url: 'https://restic.net', type: 'tool' },
      { title: 'Cryptomator', url: 'https://cryptomator.org', type: 'tool' },
      { title: 'BorgBackup', url: 'https://www.borgbackup.org', type: 'tool' },
    ],
  },
}
