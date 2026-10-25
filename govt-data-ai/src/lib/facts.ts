import { Fact, StateFact } from '@/types/govt'

export const STATE_FACTS: StateFact[] = [
  { state: 'Andhra Pradesh', capital: 'Amaravati', literacy: 67.35, population: '4.96 crore' },
  { state: 'Arunachal Pradesh', capital: 'Itanagar', literacy: 65.38, population: '1.38 lakh' },
  { state: 'Assam', capital: 'Dispur', literacy: 72.19, population: '3.12 crore' },
  { state: 'Bihar', capital: 'Patna', literacy: 61.8, population: '10.41 crore' },
  { state: 'Chhattisgarh', capital: 'Raipur', literacy: 70.28, population: '2.55 crore' },
  { state: 'Goa', capital: 'Panaji', literacy: 88.7, population: '14.59 lakh' },
  { state: 'Gujarat', capital: 'Gandhinagar', literacy: 78.03, population: '6.04 crore' },
  { state: 'Haryana', capital: 'Chandigarh', literacy: 75.6, population: '2.54 crore' },
  { state: 'Himachal Pradesh', capital: 'Shimla', literacy: 82.8, population: '68.65 lakh' },
  { state: 'Jharkhand', capital: 'Ranchi', literacy: 66.41, population: '3.30 crore' },
  { state: 'Karnataka', capital: 'Bengaluru', literacy: 75.6, population: '6.11 crore' },
  { state: 'Kerala', capital: 'Thiruvananthapuram', literacy: 94.0, population: '3.34 crore' },
  { state: 'Madhya Pradesh', capital: 'Bhopal', literacy: 69.32, population: '7.26 crore' },
  { state: 'Maharashtra', capital: 'Mumbai', literacy: 82.34, population: '11.24 crore' },
  { state: 'Manipur', capital: 'Imphal', literacy: 76.94, population: '28.56 lakh' },
  { state: 'Meghalaya', capital: 'Shillong', literacy: 74.43, population: '29.66 lakh' },
  { state: 'Mizoram', capital: 'Aizawl', literacy: 91.33, population: '10.97 lakh' },
  { state: 'Nagaland', capital: 'Kohima', literacy: 79.55, population: '19.79 lakh' },
  { state: 'Odisha', capital: 'Bhubaneswar', literacy: 72.87, population: '4.20 crore' },
  { state: 'Punjab', capital: 'Chandigarh', literacy: 75.84, population: '2.77 crore' },
  { state: 'Rajasthan', capital: 'Jaipur', literacy: 66.11, population: '6.85 crore' },
  { state: 'Sikkim', capital: 'Gangtok', literacy: 81.42, population: '6.11 lakh' },
  { state: 'Tamil Nadu', capital: 'Chennai', literacy: 80.09, population: '7.21 crore' },
  { state: 'Telangana', capital: 'Hyderabad', literacy: 66.5, population: '3.50 crore' },
  { state: 'Tripura', capital: 'Agartala', literacy: 87.22, population: '3.67 lakh' },
  { state: 'Uttar Pradesh', capital: 'Lucknow', literacy: 67.68, population: '19.98 crore' },
  { state: 'Uttarakhand', capital: 'Dehradun', literacy: 78.82, population: '1.01 crore' },
  { state: 'West Bengal', capital: 'Kolkata', literacy: 76.26, population: '9.13 crore' },
  { state: 'Delhi', capital: 'New Delhi', literacy: 86.21, population: '1.68 crore' },
  { state: 'Jammu and Kashmir', capital: 'Srinagar (summer) / Jammu (winter)', literacy: 67.16, population: '1.25 crore' },
  { state: 'Puducherry', capital: 'Puducherry', literacy: 85.77, population: '12.48 lakh' },
  { state: 'Chandigarh', capital: 'Chandigarh', literacy: 86.03, population: '10.55 lakh' },
]

export const FACTS: Fact[] = [
  {
    id: 'f-literacy-india',
    match: ['literacy rate of india', 'india literacy', 'indian literacy rate', 'national literacy'],
    question: 'What is the literacy rate of India?',
    answer:
      'India\'s overall literacy rate was 74.04% in Census 2011 (up from 64.8% in 2001). Male literacy was 82.14% and female literacy 65.46%.',
    source: 'Census of India 2011',
    sourceUrl: 'https://censusindia.gov.in/census.website/data/census-tables',
    asOf: 'Census 2011',
  },
  {
    id: 'f-population-india',
    match: ['population of india', 'india population', 'how many people in india', 'indian population'],
    question: 'What is the population of India?',
    answer:
      'As per Census 2011, India\'s population was 121.09 crore (1.21 billion) — 62.32 crore males and 58.76 crore females. India became the world\'s most populous country in 2023 per UN estimates.',
    source: 'Census of India 2011 / UN World Population Prospects',
    sourceUrl: 'https://censusindia.gov.in',
    asOf: 'Census 2011',
  },
  {
    id: 'f-states-count',
    match: ['how many states', 'number of states', 'states and ut', 'how many union territories'],
    question: 'How many states and union territories does India have?',
    answer:
      'India has 28 states and 8 union territories (after J&K became a UT in 2019 and Ladakh was carved out in 2020).',
    source: 'Government of India / India.gov.in',
    sourceUrl: 'https://www.india.gov.in/my-government/india-at-a-glance',
    asOf: 'Current',
  },
  {
    id: 'f-literacy-kerala',
    match: ['literacy rate of kerala', 'kerala literacy', 'kerala literacy rate'],
    question: 'Which state has the highest literacy rate?',
    answer:
      'Kerala had the highest literacy rate in India at 94.0% (Census 2011), followed by Mizoram (91.33%) and Tripura (87.22%). Bihar was lowest at 61.8%.',
    source: 'Census of India 2011',
    sourceUrl: 'https://censusindia.gov.in',
    asOf: 'Census 2011',
  },
  {
    id: 'f-emergency-number',
    match: ['emergency number', 'police number', '112', 'emergency helpline number', 'ambulance number'],
    question: 'What is the all-in-one emergency number in India?',
    answer:
      'Dial 112 — the Emergency Response Support System (ERSS) covers police, fire and ambulance across all states and union territories.',
    source: 'Ministry of Home Affairs, ERSS',
    sourceUrl: 'https://112india.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-budget-size',
    match: ['union budget', 'india budget size', 'budget 2024', 'budget 2025', 'total budget', 'budget outlay'],
    question: 'How big is the Union Budget?',
    answer:
      'The Union Budget 2024-25 total expenditure was about ₹48.21 lakh crore, with capital expenditure of ₹11.11 lakh crore. Budget documents are published on the India Budget portal.',
    source: 'Union Budget 2024-25, Ministry of Finance',
    sourceUrl: 'https://www.indiabudget.gov.in',
    asOf: 'BE 2024-25',
  },
  {
    id: 'f-rti',
    match: ['rti', 'right to information', 'file rti', 'rti application', 'how to file rti'],
    question: 'How do I file an RTI application?',
    answer:
      'File online at rtionline.gov.in (₹10 fee, online payment) or by post to the Public Information Officer of the concerned department. First appeals can also be filed online within 30 days.',
    source: 'DoPT, RTI Online',
    sourceUrl: 'https://rtionline.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-ayushman',
    match: ['ayushman bharat', 'pmjay', 'health card', 'health insurance scheme', '5 lakh health'],
    question: 'What does Ayushman Bharat PM-JAY cover?',
    answer:
      'PM-JAY provides cashless hospitalisation cover of ₹5 lakh per family per year at empanelled public and private hospitals. Check eligibility on pmjay.gov.in or call 14555.',
    source: 'National Health Authority',
    sourceUrl: 'https://pmjay.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-pmkisan',
    match: ['pm kisan', 'kisan samman', '6000 farmer', 'farmer income support'],
    question: 'What is PM-KISAN?',
    answer:
      'PM-KISAN gives eligible landholding farmer families ₹6,000 per year in three equal instalments of ₹2,000 directly into their bank accounts via DBT.',
    source: 'PM-KISAN portal, Ministry of Agriculture',
    sourceUrl: 'https://pmkisan.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-employment-rate',
    match: ['unemployment rate', 'employment rate india', 'jobless rate', 'unemployment india'],
    question: 'What is India\'s unemployment rate?',
    answer:
      'PLFS annual survey data shows an all-India usual-status unemployment rate of around 3.2% (2023-24). Latest rounds are published by MoSPI — see the PLFS report for youth and educated-subgroup detail.',
    source: 'Periodic Labour Force Survey, MoSPI',
    sourceUrl: 'https://mospi.gov.in/periodic-labour-force-survey-plfs',
    asOf: 'PLFS 2023-24',
  },
  {
    id: 'f-gdp',
    match: ['gdp', 'india gdp', 'growth rate', 'economic growth', 'gdp of india'],
    question: 'What is India\'s GDP?',
    answer:
      'India\'s real GDP growth was about 8.2% in FY 2023-24, with nominal GDP around ₹295 lakh crore. The official series and quarterly numbers come from MoSPI\'s National Accounts Statistics.',
    source: 'MoSPI, National Accounts Statistics',
    sourceUrl: 'https://mospi.gov.in',
    asOf: 'FY 2023-24',
  },
  {
    id: 'f-pincode',
    match: ['pincode', 'pin code', 'postcode', 'postal code lookup'],
    question: 'How do I find a PIN code?',
    answer:
      'Use India Post\'s PIN Code finder (IndiaPost.gov.in) or the PIN Code Directory dataset — enter a locality to get the 6-digit PIN and post office details.',
    source: 'India Post',
    sourceUrl: 'https://www.indiapost.gov.in/VAS/Pages/FindPinCode.aspx',
    asOf: 'Current',
  },
  {
    id: 'f-open-data',
    match: ['open data', 'govt datasets', 'government data portal', 'download govt data', 'data.gov.in'],
    question: 'Where can I download official government datasets?',
    answer:
      'data.gov.in hosts thousands of datasets with APIs and CSV downloads, filterable by ministry, state and sector. For local governance data, also see the district statistics and Census tables.',
    source: 'Open Government Data Division / data.gov.in',
    sourceUrl: 'https://data.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-consultation',
    match: ['give suggestion to government', 'mygov', 'public consultation', 'citizen participation'],
    question: 'How can citizens give suggestions to the government?',
    answer:
      'MyGov (mygov.in) runs official consultations, polls and discussions where ministries publish draft policies for citizen comments.',
    source: 'MyGov, Government of India',
    sourceUrl: 'https://www.mygov.in',
    asOf: 'Current',
  },
  {
    id: 'f-cic',
    match: [
      'central information commission',
      'cic',
      'rti appeal',
      'who hears rti',
      'second appeal rti',
    ],
    question: 'Who hears RTI appeals?',
    answer:
      'A first appeal goes to the First Appellate Authority inside the department; a second appeal is heard by the Central Information Commission (CIC), whose orders are binding on the public authority.',
    source: 'Central Information Commission',
    sourceUrl: 'https://cic.gov.in',
    asOf: 'RTI Act 2005',
  },
  {
    id: 'f-gazette',
    match: [
      'gazette',
      'gazette notification',
      'where to find notification',
      'official notification',
      'egazette',
    ],
    question: 'Where are gazette notifications published?',
    answer:
      'The e-Gazette portal (egazette.gov.in) publishes the Gazette of India — Parts I, II and III — including rules, ordinances and government orders, searchable by part and date.',
    source: 'Department of Publication, MoHUA',
    sourceUrl: 'https://egazette.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-cag',
    match: [
      'what is cag',
      'comptroller and auditor general',
      'cag report',
      'who audits government',
      'audit reports',
    ],
    question: 'What does the CAG do?',
    answer:
      'The Comptroller and Auditor General of India audits all government receipts and expenditure, and lays fiscal, performance and compliance audit reports before Parliament and the state legislatures.',
    source: 'C&AG of India',
    sourceUrl: 'https://cag.gov.in',
    asOf: 'Current',
  },
  {
    id: 'f-parliament-questions',
    match: [
      'parliament questions',
      'question hour',
      'lok sabha questions',
      'parliament debates',
      'sansad',
      'where to find debates',
    ],
    question: 'Where can I read parliamentary questions and debates?',
    answer:
      'Sansad.in is the unified Parliament portal for questions, debate records and committees; the Lok Sabha and Rajya Sabha secretariat sites publish question-hour records, attendance and session schedules.',
    source: 'Parliament of India',
    sourceUrl: 'https://sansad.in',
    asOf: 'Current',
  },
  {
    id: 'f-declassified',
    match: [
      'declassified files',
      'declassified records',
      'national archives',
      'historical government records',
      'netaji files',
    ],
    question: 'Are declassified government files available online?',
    answer:
      'Yes — the National Archives of India digitises public records and declassified collections, including the government-released declassified Netaji files, all browsable online.',
    source: 'National Archives of India',
    sourceUrl: 'https://nationalarchives.nic.in',
    asOf: 'Current',
  },
  {
    id: 'f-proactive-disclosure',
    match: [
      'proactive disclosure',
      'section 4',
      'mandatory disclosure',
      'disclosure rules',
      'rti section 4 1 b',
    ],
    question: 'What is proactive disclosure under the RTI Act?',
    answer:
      'Section 4(1)(b) requires every public authority to publish categories of information — powers, duties, decisions, budgets, contracts and beneficiary schemes — proactively on its website and in a public information manual, without anyone having to file an RTI.',
    source: 'RTI Act 2005, DoPT',
    sourceUrl: 'https://rti.gov.in',
    asOf: 'RTI Act 2005',
  },
]

export function findStateFact(name: string): StateFact | undefined {
  const q = name.trim().toLowerCase()
  return STATE_FACTS.find(s => s.state.toLowerCase() === q)
}
