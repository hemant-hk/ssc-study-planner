import { CategoryId, Resource } from '@/types/govt'

export const CATEGORIES: Record<
  CategoryId,
  { name: string; description: string; icon: string }
> = {
  schemes: {
    name: 'Govt Schemes',
    description: 'Central & state welfare schemes, eligibility and application links',
    icon: 'flag',
  },
  portals: {
    name: 'Data Portals',
    description: 'Official open-data and governance portals',
    icon: 'database',
  },
  stats: {
    name: 'Census & Stats',
    description: 'Population, literacy, economy and survey statistics',
    icon: 'bar-chart',
  },
  laws: {
    name: 'Laws & RTI',
    description: 'Acts, rules, drafts and RTI filing',
    icon: 'scale',
  },
  tenders: {
    name: 'Tenders & Procurement',
    description: 'Government procurement and tender notices',
    icon: 'briefcase',
  },
  helplines: {
    name: 'Helplines',
    description: 'National emergency and citizen helplines',
    icon: 'phone',
  },
  finance: {
    name: 'Budget & Finance',
    description: 'Union budget, receipts and public finance data',
    icon: 'indian-rupee',
  },
  transparency: {
    name: 'Transparency & Records',
    description: 'RTI disclosures, parliamentary records, gazette, archives & audit reports',
    icon: 'scroll',
  },
}

export const CATEGORY_ORDER: CategoryId[] = [
  'schemes',
  'portals',
  'stats',
  'laws',
  'transparency',
  'tenders',
  'helplines',
  'finance',
]

export const RESOURCES: Resource[] = [
  // ---- Schemes ----
  {
    id: 'pm-kisan',
    title: 'PM-KISAN Samman Nidhi',
    description:
      'Income support of ₹6,000/year in three instalments to landholding farmer families. Track status with your registration number.',
    category: 'schemes',
    org: 'Ministry of Agriculture & Farmers Welfare',
    url: 'https://pmkisan.gov.in',
    tags: ['farmer', 'dbt', 'income support', 'agriculture'],
    hint: 'DBT · farmers',
  },
  {
    id: 'pmjay',
    title: 'Ayushman Bharat PM-JAY',
    description:
      'Cashless health cover of ₹5 lakh per family per year at empanelled hospitals. Check eligibility and download your card.',
    category: 'schemes',
    org: 'National Health Authority',
    url: 'https://pmjay.gov.in',
    tags: ['health', 'insurance', 'hospital', 'welfare'],
    hint: 'Health cover',
  },
  {
    id: 'pm-awas',
    title: 'PM Awas Yojana (Gramin & Urban)',
    description:
      'Housing assistance for eligible families without a pucca house. Application status and beneficiary lists are published online.',
    category: 'schemes',
    org: 'Ministry of Rural Development / MoHUA',
    url: 'https://pmayg.nic.in',
    tags: ['housing', 'shelter', 'rural', 'urban'],
    hint: 'Housing',
  },
  {
    id: 'mgnrega',
    title: 'MGNREGA Job Card & Work Portal',
    description:
      'Guaranteed 100 days of wage employment per rural household. View job cards, work requests and wage payments.',
    category: 'schemes',
    org: 'Ministry of Rural Development',
    url: 'https://nrega.nic.in',
    tags: ['employment', 'rural', 'wages', 'job card'],
    hint: 'Rural jobs',
  },
  {
    id: 'nsp',
    title: 'National Scholarship Portal',
    description:
      'Single window for central and state scholarships for school, college and higher-education students.',
    category: 'schemes',
    org: 'Ministry of Electronics & IT (on behalf of GoI)',
    url: 'https://scholarships.gov.in',
    tags: ['education', 'students', 'scholarship'],
    hint: 'Scholarships',
  },
  {
    id: 'pmjdby',
    title: 'Pradhan Mantri Jan Dhan Yojana',
    description:
      'Zero-balance bank accounts with accident insurance and overdraft facility for financial inclusion.',
    category: 'schemes',
    org: 'Department of Financial Services',
    url: 'https://pmjdy.gov.in',
    tags: ['banking', 'financial inclusion', 'account'],
    hint: 'Banking',
  },
  {
    id: 'ejam',
    title: 'e-Shram / NCS — Unorganised Workers',
    description:
      'Register unorganised workers for social-security coverage and find skill jobs on the National Career Service.',
    category: 'schemes',
    org: 'Ministry of Labour & Employment',
    url: 'https://eshram.gov.in',
    tags: ['labour', 'unorganised', 'registration', 'jobs'],
    hint: 'Worker registry',
  },
  {
    id: 'sukanya',
    title: 'Sukanya Samriddhi & Small Savings',
    description:
      'Government small-savings schemes for girl children and households, with current interest rates.',
    category: 'schemes',
    org: 'Ministry of Finance / India Post',
    url: 'https://www.indiapostschemes.gov.in',
    tags: ['savings', 'girl child', 'post office', 'interest'],
    hint: 'Savings',
  },
  {
    id: 'atal-pension',
    title: 'Atal Pension Yojana',
    description:
      'Guaranteed monthly pension for subscribers in the unorganised sector based on contribution size.',
    category: 'schemes',
    org: 'PFRDA',
    url: 'https://www.npscra.nsdl.co.in/scheme-details.php',
    tags: ['pension', 'retirement', 'nsap'],
    hint: 'Pension',
  },
  {
    id: 'pm-vishwakarma',
    title: 'PM Vishwakarma',
    description:
      'Recognition, toolkit incentive, training and credit support for traditional artisans and craftspeople.',
    category: 'schemes',
    org: 'Ministry of MSME',
    url: 'https://pmvishwakarma.gov.in',
    tags: ['artisan', 'crafts', 'skill', 'msme', 'credit'],
    hint: 'Artisans',
  },

  // ---- Portals ----
  {
    id: 'data-gov-in',
    title: 'data.gov.in — Open Government Data',
    description:
      'India\'s national open-data platform: thousands of datasets with APIs, filters by ministry, state and sector.',
    category: 'portals',
    org: 'National Informatics Centre / Open Government Data Division',
    url: 'https://data.gov.in',
    tags: ['open data', 'datasets', 'api', 'statistics'],
    hint: 'National open data',
  },
  {
    id: 'india-gov',
    title: 'India.gov.in — National Portal',
    description:
      'Single gateway to government information and services: directories, forms, schemes and online services.',
    category: 'portals',
    org: 'National Informatics Centre',
    url: 'https://www.india.gov.in',
    tags: ['directory', 'services', 'forms', 'info'],
    hint: 'Gov directory',
  },
  {
    id: 'digital-india',
    title: 'Digital India',
    description:
      'Programme tracker for digital infrastructure, services and digital empowerment initiatives.',
    category: 'portals',
    org: 'MeitY',
    url: 'https://www.digitalindia.gov.in',
    tags: ['digital', 'governance', 'services'],
    hint: 'Digital governance',
  },
  {
    id: 'mygov',
    title: 'MyGov — Citizen Participation',
    description:
      'Consultations, polls, competitions and community discussions run by government ministries.',
    category: 'portals',
    org: 'Government of India',
    url: 'https://www.mygov.in',
    tags: ['consultation', 'participation', 'polls'],
    hint: 'Participate',
  },
  {
    id: 'niti-aayog',
    title: 'NITI Aayog Data & Reports',
    description:
      'Indices, SDG dashboards, policy reports and composite statistics from the national think tank.',
    category: 'portals',
    org: 'NITI Aayog',
    url: 'https://www.niti.gov.in',
    tags: ['reports', 'sdg', 'indices', 'policy'],
    hint: 'Policy data',
  },
  {
    id: 'data-gov',
    title: 'Data.gov (United States)',
    description:
      'US open-data catalog across federal agencies — useful for cross-country comparisons.',
    category: 'portals',
    org: 'US General Services Administration',
    url: 'https://data.gov',
    tags: ['open data', 'international', 'comparative'],
    hint: 'US open data',
  },
  {
    id: 'data-gov-uk',
    title: 'Data.gov.uk',
    description:
      'UK open-data catalogue with API access across departments and local authorities.',
    category: 'portals',
    org: 'UK Government',
    url: 'https://data.gov.uk',
    tags: ['open data', 'international', 'uk'],
    hint: 'UK open data',
  },

  // ---- Stats ----
  {
    id: 'census-india',
    title: 'Census of India',
    description:
      'Decadal census tables: population, literacy, households, religion, language and housing data by district.',
    category: 'stats',
    org: 'Registrar General & Census Commissioner',
    url: 'https://censusindia.gov.in',
    tags: ['census', 'population', 'literacy', 'district'],
    hint: 'Census 2011',
  },
  {
    id: 'mospi',
    title: 'Ministry of Statistics & Programme Implementation',
    description:
      'GDP, inflation (CPI/IIP), industrial production and national account series.',
    category: 'stats',
    org: 'MoSPI',
    url: 'https://mospi.gov.in',
    tags: ['gdp', 'inflation', 'cpi', 'economy'],
    hint: 'Economy stats',
  },
  {
    id: 'planning-libs',
    title: 'Education Statistics (UDISE+ / ASER)',
    description:
      'School-level education indicators, enrolment, infrastructure and learning assessments.',
    category: 'stats',
    org: 'Department of School Education & Literacy',
    url: 'https://www.education.gov.in',
    tags: ['education', 'schools', 'enrolment', 'learning'],
    hint: 'Education data',
  },
  {
    id: 'niti-sdg',
    title: 'SDG India Index',
    description:
      'State-wise progress on the 17 Sustainable Development Goals with year-on-year scores.',
    category: 'stats',
    org: 'NITI Aayog',
    url: 'https://www.niti.gov.in/what-we-do/sustainable-development-goals',
    tags: ['sdg', 'index', 'states', 'development'],
    hint: 'SDG scores',
  },
  {
    id: 'india-meteorological',
    title: 'IMD Weather Data',
    description:
      'Official weather observations, forecasts, warnings and climate normals across India.',
    category: 'stats',
    org: 'India Meteorological Department',
    url: 'https://mausam.imd.gov.in',
    tags: ['weather', 'climate', 'rainfall', 'forecast'],
    hint: 'Weather',
  },
  {
    id: 'crstats',
    title: 'Crime & Law Order Statistics (NCRB)',
    description:
      'Annual crime statistics by state, district and offence category.',
    category: 'stats',
    org: 'National Crime Records Bureau',
    url: 'https://ncrb.gov.in',
    tags: ['crime', 'police', 'statistics'],
    hint: 'Crime data',
  },

  // ---- Laws ----
  {
    id: 'indian-kanoon-law',
    title: 'India Code — Acts of Parliament',
    description:
      'Consolidated central acts with amendments, timelines and ministry-wise indexing.',
    category: 'laws',
    org: 'Legislative Department, Ministry of Law & Justice',
    url: 'https://www.indiacode.nic.in',
    tags: ['acts', 'law', 'legislation', 'central'],
    hint: 'Central laws',
  },
  {
    id: 'prs-legislative',
    title: 'PRS Legislative Research',
    description:
      'Bills, acts, parliamentary sessions, constituency and MP data in a readable format.',
    category: 'laws',
    org: 'PRS Legislative Research (independent)',
    url: 'https://prsindia.org',
    tags: ['bills', 'parliament', 'mps', 'legislation'],
    hint: 'Bills & MPs',
  },
  {
    id: 'rti-portal',
    title: 'RTI Online — File an Information Request',
    description:
      'File Right to Information applications and first appeals online with fee payment and tracking.',
    category: 'transparency',
    org: 'Department of Personnel & Training',
    url: 'https://rtionline.gov.in',
    tags: ['rti', 'transparency', 'application', 'appeal'],
    hint: 'File RTI',
  },
  {
    id: 'sc-judgments',
    title: 'Supreme Court of India Judgments',
    description:
      'Searchable judgments, case status and cause lists of the Supreme Court.',
    category: 'laws',
    org: 'Supreme Court of India',
    url: 'https://www.sci.gov.in',
    tags: ['judgments', 'court', 'case status'],
    hint: 'Court data',
  },
  {
    id: 'hc-judgments',
    title: 'High Court Judgments Directory',
    description:
      'Directory of High Court websites and e-filing/cause-list portals for all states.',
    category: 'laws',
    org: 'eCourts / Department of Justice',
    url: 'https://districts.ecourts.gov.in',
    tags: ['high court', 'ecourts', 'case status'],
    hint: 'eCourts',
  },

  // ---- Tenders ----
  {
    id: 'gem',
    title: 'GeM — Government e-Marketplace',
    description:
      'Public procurement of goods and services by government buyers, with open bids and order history.',
    category: 'tenders',
    org: 'Government e-Marketplace Pvt. Ltd.',
    url: 'https://gem.gov.in',
    tags: ['procurement', 'bids', 'suppliers', 'orders'],
    hint: 'Procurement',
  },
  {
    id: 'cppp',
    title: 'Central Public Procurement Portal',
    description:
      'Live tender notices, corrigenda and work contracts from central ministries and PSUs.',
    category: 'tenders',
    org: 'Directorate General of Supplies & Disposals',
    url: 'https://eprocure.gov.in',
    tags: ['tender', 'notice', 'contract', 'ministry'],
    hint: 'Live tenders',
  },
  {
    id: 'etender-state',
    title: 'State e-Procurement Portals',
    description:
      'Directory links to state-wise e-procurement portals for tenders below central scope.',
    category: 'tenders',
    org: 'Various state governments (via NIC)',
    url: 'https://www.india.gov.in/topics/defence-and-security/procurement',
    tags: ['state', 'tender', 'procurement'],
    hint: 'State tenders',
  },
  {
    id: 'rail-tender',
    title: 'RailNCR / Railway tenders & vacancies',
    description:
      'Railway recruitment notices and tender enquiries aggregated by Railway Recruitment Cells.',
    category: 'tenders',
    org: 'Indian Railways',
    url: 'https://www.rrbcdg.gov.in',
    tags: ['railways', 'jobs', 'recruitment', 'tender'],
    hint: 'Recruitment',
  },

  // ---- Helplines ----
  {
    id: 'helpline-112',
    title: 'Emergency Response Support — 112',
    description:
      'Single all-in-one emergency number for police, fire and ambulance across all states and UTs.',
    category: 'helplines',
    org: 'Ministry of Home Affairs (ERSS)',
    url: 'https://112india.gov.in',
    tags: ['emergency', 'police', 'ambulance', 'fire'],
    hint: 'Dial 112',
  },
  {
    id: 'helpline-women',
    title: 'Women Helpline — 181',
    description:
      '24×7 counselling and rescue support for women facing violence or distress.',
    category: 'helplines',
    org: 'Ministry of Women & Child Development',
    url: 'https://wcd.nic.in',
    tags: ['women', 'safety', 'counselling'],
    hint: 'Dial 181',
  },
  {
    id: 'helpline-child',
    title: 'CHILDLINE — 1098',
    description:
      '24×7 helpline for children in need of care and protection.',
    category: 'helplines',
    org: 'Ministry of Women & Child Development / CHILDLINE India',
    url: 'https://www.childlineindia.org.in',
    tags: ['child', 'welfare', 'rescue'],
    hint: 'Dial 1098',
  },
  {
    id: 'helpline-telemanas',
    title: 'Tele-MANAS Mental Health — 14416',
    description:
      'Free 24×7 mental-health counselling across 20 languages via call, chat or video.',
    category: 'helplines',
    org: 'National Institute of Mental Health & Neuro Sciences / MoHFW',
    url: 'https://telemanas.mohfw.gov.in',
    tags: ['mental health', 'counselling', 'health'],
    hint: 'Dial 14416',
  },
  {
    id: 'helpline-kisan',
    title: 'Kisan Call Centre — 1800-180-1551',
    description:
      'Agricultural advice from experts in 22 local languages, 6 am–10 pm.',
    category: 'helplines',
    org: 'Ministry of Agriculture',
    url: 'https://www.kisan.gov.in',
    tags: ['farmer', 'agriculture', 'advice'],
    hint: 'Farmer helpline',
  },
  {
    id: 'helpline-senior',
    title: 'Elder Line — 14567',
    description:
      'Support for senior citizens: pensions, abuse, emotional and legal guidance.',
    category: 'helplines',
    org: 'Ministry of Social Justice & Empowerment',
    url: 'https://socialjustice.gov.in',
    tags: ['elderly', 'pension', 'support'],
    hint: 'Dial 14567',
  },

  // ---- Finance ----
  {
    id: 'india-budget',
    title: 'Union Budget Portal',
    description:
      'Full budget documents, expenditure/fiscal tables, speeches and scheme-wise allocations.',
    category: 'finance',
    org: 'Ministry of Finance / Press Information Bureau',
    url: 'https://www.indiabudget.gov.in',
    tags: ['budget', 'expenditure', 'allocations', 'fiscal'],
    hint: 'Budget docs',
  },
  {
    id: 'bharatkosh',
    title: 'Bharatkosh — Government Receipts',
    description:
      'Non-tax revenue receipts portal for taxes, fees and permits payable to the government.',
    category: 'finance',
    org: 'Controller General of Accounts',
    url: 'https://bharatkosh.gov.in',
    tags: ['payments', 'receipts', 'tax'],
    hint: 'Gov receipts',
  },
  {
    id: 'cgag',
    title: 'C&AG — Audit Reports',
    description:
      'Public audit reports on union and state finances, performance and compliance audits.',
    category: 'finance',
    org: 'Comptroller & Auditor General of India',
    url: 'https://cag.gov.in',
    tags: ['audit', 'reports', 'accounts'],
    hint: 'Audit reports',
  },
  {
    id: 'rbi-data',
    title: 'RBI Database on Indian Economy',
    description:
      'Interest rates, money supply, balance of payments, banking and financial time series.',
    category: 'finance',
    org: 'Reserve Bank of India',
    url: 'https://dbie.rbi.org.in',
    tags: ['rbi', 'rates', 'banking', 'time series'],
    hint: 'Financial data',
  },
  {
    id: 'sebi',
    title: 'SEBI — Market Data & Filings',
    description:
      'Securities market statistics, corporate filings and investor grievance data.',
    category: 'finance',
    org: 'Securities & Exchange Board of India',
    url: 'https://www.sebi.gov.in',
    tags: ['markets', 'investor', 'filings'],
    hint: 'Market data',
  },
  {
    id: 'cga-accounts',
    title: 'CGA — Finance & Revenue Accounts',
    description:
      'Monthly and annual finance accounts of the Union, appropriation accounts and cash balances.',
    category: 'finance',
    org: 'Controller General of Accounts',
    url: 'https://cga.nic.in',
    tags: ['accounts', 'treasury', 'expenditure', 'fiscal'],
    hint: 'Union accounts',
  },

  // ---- Transparency & Records ----
  {
    id: 'cic',
    title: 'Central Information Commission (CIC)',
    description:
      'Appellate authority under the RTI Act: second appeals, complaints, orders and a public registry of information officers.',
    category: 'transparency',
    org: 'Central Information Commission',
    url: 'https://cic.gov.in',
    tags: ['rti', 'appeal', 'disclosure', 'transparency'],
    hint: 'RTI appeals',
  },
  {
    id: 'rti-act',
    title: 'RTI Act 2005 & DoPT Guidelines',
    description:
      'Full text of the Right to Information Act, rules, manuals and Section 4(1)(b) proactive-disclosure instructions for departments.',
    category: 'transparency',
    org: 'Department of Personnel & Training',
    url: 'https://rti.gov.in',
    tags: ['rti', 'act', 'disclosure', 'manuals'],
    hint: 'RTI Act text',
  },
  {
    id: 'sansad',
    title: 'Sansad — Parliament of India',
    description:
      'Unified portal for Lok Sabha & Rajya Sabha: questions, debate records, committees, member profiles and session schedules.',
    category: 'transparency',
    org: 'Parliament of India',
    url: 'https://sansad.in',
    tags: ['parliament', 'questions', 'debates', 'committees'],
    hint: 'Parliament data',
  },
  {
    id: 'loksabha',
    title: 'Lok Sabha — Questions & Debates',
    description:
      'Question Hour questions, debate transcripts, stenographed records and member attendance of the Lower House.',
    category: 'transparency',
    org: 'Lok Sabha Secretariat',
    url: 'https://loksabha.nic.in',
    tags: ['lok sabha', 'question hour', 'debates', 'attendance'],
    hint: 'Lower house',
  },
  {
    id: 'rajyasabha',
    title: 'Rajya Sabha — Records & Questions',
    description:
      'Upper-house questions, debate records, committee work and legislative business proceedings.',
    category: 'transparency',
    org: 'Rajya Sabha Secretariat',
    url: 'https://rajyasabha.nic.in',
    tags: ['rajya sabha', 'questions', 'debates'],
    hint: 'Upper house',
  },
  {
    id: 'egazette',
    title: 'e-Gazette of India',
    description:
      'Official notifications, ordinances, rules and government orders as published in the Gazette — searchable by part and date.',
    category: 'transparency',
    org: 'Department of Publication, MoHUA',
    url: 'https://egazette.gov.in',
    tags: ['gazette', 'notification', 'rules', 'ordinance'],
    hint: 'Official notifications',
  },
  {
    id: 'pib',
    title: 'PIB Press Releases',
    description:
      'Official announcements, policy rollouts and ministerial statements published daily by the Press Information Bureau.',
    category: 'transparency',
    org: 'Press Information Bureau',
    url: 'https://pib.gov.in',
    tags: ['press release', 'announcements', 'policy', 'media'],
    hint: 'Govt announcements',
  },
  {
    id: 'national-archives',
    title: 'National Archives of India',
    description:
      'Digitised historical records, public-records rules and declassified government collections open to researchers.',
    category: 'transparency',
    org: 'National Archives of India, Ministry of Culture',
    url: 'https://nationalarchives.nic.in',
    tags: ['archives', 'declassified', 'history', 'records'],
    hint: 'Historical records',
  },
  {
    id: 'netaji-files',
    title: 'Declassified Netaji Files',
    description:
      'The government-released declassified files on Netaji Subhas Chandra Bose — fully browsable online.',
    category: 'transparency',
    org: 'National Archives of India / Government of India',
    url: 'https://netajifiles.nic.in',
    tags: ['declassified', 'netaji', 'history', 'files'],
    hint: 'Declassified files',
  },
  {
    id: 'cag-reports-library',
    title: 'CAG Audit Reports & Committee Report Library',
    description:
      'Cross-index of audit reports laid before Parliament and standing-committee reports, hosted with the C&AG publication series.',
    category: 'transparency',
    org: 'Comptroller & Auditor General of India',
    url: 'https://cag.gov.in',
    tags: ['audit', 'cag', 'committee', 'reports'],
    hint: 'Audit reports',
  },
]

export function getResourcesByCategory(category: CategoryId): Resource[] {
  return RESOURCES.filter(r => r.category === category)
}
