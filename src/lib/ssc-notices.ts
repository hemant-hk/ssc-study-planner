export interface SscNoticeDate {
  label: string;
  value: string;
  important?: boolean;
}

export interface SscNotice {
  exam: string;
  title: string;
  issuedOn: string;
  status: "Active Now" | "Upcoming" | "Closed";
  summary: string;
  dates: SscNoticeDate[];
  examLink: string;
  applyLink?: string;
}

export const SSC_NOTICES: SscNotice[] = [
  {
    exam: "SSC CGL 2026",
    title: "CGL Tier-I Exam Schedule Announced",
    issuedOn: "12 September 2026",
    status: "Upcoming",
    summary: "12,256 Group B & C posts · Draft: ASO, Inspector, Auditor, Tax Assistant & more.",
    dates: [
      { label: "Notification Released", value: "21 May 2026" },
      { label: "Application Window", value: "21 May – 22 June 2026" },
      { label: "Tier-I Exam (CBE)", value: "30 Sep – 30 Oct 2026", important: true },
      { label: "Tier-II Exam", value: "December 2026" },
    ],
    examLink: "https://ssc.gov.in",
  },
  {
    exam: "SSC CHSL 2026",
    title: "Online Applications Open — Apply Now",
    issuedOn: "7 September 2026",
    status: "Active Now",
    summary: "2,536 tentative vacancies · LDC, JSA & DEO posts.",
    dates: [
      { label: "Notification Released", value: "7 September 2026" },
      { label: "Application Start", value: "7 September 2026" },
      { label: "Last Date to Apply", value: "7 October 2026 (23:00)", important: true },
      { label: "Fee Payment Last Date", value: "8 October 2026" },
      { label: "Correction Window", value: "14 – 16 October 2026" },
      { label: "Tier-I Exam", value: "To be notified" },
    ],
    examLink: "https://ssc.gov.in",
    applyLink: "https://ssc.gov.in",
  },
];

export function getDaysLeft(dateStr: string, now = new Date()): number {
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return -1;
  const months: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };
  const monthIdx = months[match[2]];
  if (monthIdx === undefined) return -1;
  const target = new Date(Number(match[3]), monthIdx, Number(match[1]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}