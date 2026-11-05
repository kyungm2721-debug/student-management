import type { Entry, Period, RefStatus, Enroll } from './types';

/* ───── 자가진단 체크리스트 ─────
 * w: 가중치, tag: acad(학사 부적응) / leave(휴학 위험), crit: 체크하면 바로 '위험', center: 상담센터 권장 */
export interface CheckItem {
  id: string;
  t: string;
  w: number;
  tag?: 'acad' | 'leave';
  crit?: boolean;
  center?: boolean;
}
export const CHECKS: { g: string; items: CheckItem[] }[] = [
  {
    g: '학업',
    items: [
      { id: 'follow', t: '수업 내용을 따라가기 어렵다', w: 2, tag: 'acad' },
      { id: 'absence', t: '결석이나 지각이 잦아졌다', w: 2, tag: 'acad' },
      { id: 'grade', t: '성적이 많이 떨어졌거나 학사경고가 걱정된다', w: 2, tag: 'acad' },
      { id: 'fit', t: '전공이 나와 맞지 않는다고 느낀다', w: 2, tag: 'acad' },
    ],
  },
  {
    g: '진로·학적',
    items: [
      { id: 'career', t: '진로나 졸업 후 계획이 막막하다', w: 1 },
      { id: 'leave', t: '휴학을 고민하고 있다', w: 3, tag: 'leave', crit: true },
      { id: 'dropout', t: '자퇴, 전과, 편입을 고민하고 있다', w: 3, tag: 'leave', crit: true },
    ],
  },
  {
    g: '생활',
    items: [
      { id: 'money', t: '등록금이나 생활비 때문에 어렵다', w: 2, tag: 'leave' },
      { id: 'work', t: '아르바이트 때문에 공부할 시간이 부족하다', w: 1, tag: 'acad' },
      { id: 'relation', t: '친구나 동기와의 관계가 어렵다', w: 1 },
      { id: 'health', t: '건강 문제로 학교생활이 힘들다', w: 2, tag: 'leave' },
    ],
  },
  {
    g: '마음',
    items: [
      { id: 'stress', t: '스트레스나 불안이 심하다', w: 2 },
      { id: 'mood', t: '우울하거나 무기력한 날이 많다', w: 3, crit: true, center: true },
      { id: 'wantcenter', t: '전문 상담을 받아보고 싶다', w: 2, center: true },
    ],
  },
];
export const ITEM: Record<string, CheckItem> = Object.fromEntries(
  CHECKS.flatMap((g) => g.items).map((i) => [i.id, i]),
);

export const LEVELS = ['안정', '관심', '주의', '위험'] as const;

export interface Assessment {
  score: number;
  level: 0 | 1 | 2 | 3;
  leave: boolean; // 휴학 위험
  acad: boolean; // 학사 부적응
  center: boolean; // 상담센터 연계 권장
}

/** 위험 단계: 즉시위험 항목 → 위험, 5점 이상 → 주의, 2~4점 → 관심, 0~1점 → 안정 */
export function assess(checks: string[] | null | undefined): Assessment {
  const list = checks ?? [];
  let score = 0, crit = false, acad = 0, leaveN = 0, center = false;
  for (const id of list) {
    const i = ITEM[id];
    if (!i) continue;
    score += i.w;
    if (i.crit) crit = true;
    if (i.tag === 'acad') acad++;
    if (i.tag === 'leave') leaveN++;
    if (i.center) center = true;
  }
  const level = (crit ? 3 : score >= 5 ? 2 : score >= 2 ? 1 : 0) as Assessment['level'];
  return {
    score,
    level,
    leave: list.includes('leave') || list.includes('dropout') || leaveN >= 2,
    acad: acad >= 2,
    center: center || level === 3,
  };
}

/* ───── 날짜·학기 ───── */
const pad = (n: number) => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export function fmt(ds: string | null | undefined): string {
  if (!ds) return '';
  const [y, m, d] = ds.slice(0, 10).split('-').map(Number);
  return (y !== new Date().getFullYear() ? `${y}. ` : '') + `${m}월 ${d}일`;
}

/** 3–8월 = 1학기(여름방학 포함), 9–12월 = 2학기, 1–2월 = 전년도 2학기(겨울방학) */
export function termOf(ds?: string): string {
  const [y, m] = (ds ?? today()).split('-').map(Number);
  if (m >= 3 && m <= 8) return `${y}-1`;
  if (m >= 9) return `${y}-2`;
  return `${y - 1}-2`;
}
export const termLabel = (t: string) => {
  const [y, s] = t.split('-');
  return `${y}학년도 ${s}학기`;
};

export const PERIODS: [Period, string][] = [
  ['start', '학기 초'],
  ['end', '학기 말'],
  ['vac', '방학 중'],
];
export const PLABEL: Record<Period, string> = { start: '학기 초', end: '학기 말', vac: '방학 중' };

export function periodHint(t: string, p: Period): string {
  const first = t.endsWith('-1');
  const h = first
    ? { start: '3–4월', end: '5–6월', vac: '7–8월 여름방학' }
    : { start: '9–10월', end: '11–12월', vac: '1–2월 겨울방학' };
  return h[p];
}

/** 해당 학기에서 이미 시기가 된(=했어야 하는) 정기상담 */
export function duePeriods(t: string): Period[] {
  const cur = termOf();
  if (t < cur) return ['start', 'end', 'vac'];
  if (t > cur) return [];
  const m = new Date().getMonth() + 1;
  if (t.endsWith('-1')) {
    if (m <= 4) return ['start'];
    if (m <= 6) return ['start', 'end'];
    return ['start', 'end', 'vac'];
  }
  if (m >= 9 && m <= 10) return ['start'];
  if (m >= 11) return ['start', 'end'];
  return ['start', 'end', 'vac'];
}
export const defaultPeriod = (): Period => {
  const d = duePeriods(termOf());
  return d[d.length - 1] ?? 'start';
};

/* ───── 상담 상태 ───── */
export const isDone = (e: Entry) => Boolean(e.student_done_at || e.prof_done_at);
export const doneDate = (e: Entry) => e.student_done_at ?? e.prof_done_at ?? '';

export type PeriodState = { st: 'done' | 'req' | 'due' | 'later'; date?: string };
export function periodState(entries: Entry[], term: string, p: Period): PeriodState {
  const es = entries.filter((e) => e.term === term && e.kind === 'regular' && e.period === p);
  const d = es.find(isDone);
  if (d) return { st: 'done', date: doneDate(d) };
  const r = es.find((e) => e.mode === 'request');
  if (r) return { st: 'req', date: r.date };
  return { st: duePeriods(term).includes(p) ? 'due' : 'later' };
}
export function latestCheck(entries: Entry[], term?: string): Entry | null {
  return (
    entries
      .filter((e) => !term || e.term === term)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

/** 한 학기 동안 남긴 자가진단을 합친 결과: 가장 높은 단계, 표시는 한 번이라도 나온 것.
 *  나중에 가벼운 체크를 남겨도 앞서 나온 위험 신호가 사라지지 않게 하려는 것 */
export function termAssess(entries: Entry[], term: string): Assessment | null {
  const es = entries.filter((e) => e.term === term);
  if (!es.length) return null;
  return es.map((e) => assess(e.checks)).reduce((a, b) => ({
    score: Math.max(a.score, b.score),
    level: Math.max(a.level, b.level) as Assessment['level'],
    leave: a.leave || b.leave,
    acad: a.acad || b.acad,
    center: a.center || b.center,
  }));
}

export const REF: [RefStatus, string][] = [
  ['none', '없음'],
  ['advised', '연계 권유'],
  ['linked', '연계 완료'],
  ['closed', '상담 종결'],
];
export const REFL: Record<RefStatus, string> = Object.fromEntries(REF) as Record<RefStatus, string>;
export const ENROLL: Enroll[] = ['재학', '휴학', '자퇴·제적', '졸업'];
