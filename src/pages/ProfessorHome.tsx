import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AdvisorNote, Entry, Profile, Referral, Settings } from '../lib/types';
import { LEVELS, PERIODS, REFL, fmt, isDone, periodState, termAssess, termLabel, termOf } from '../lib/logic';
import { toast } from '../components/ui';
import StudentDetail from './StudentDetail';
import SettingsForm from './SettingsForm';

type Filter = 'all' | 'risk' | 'pending' | 'missing' | 'center';
const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['risk', '위험·주의'],
  ['pending', '상담 신청 대기'],
  ['missing', '정기상담 미완료'],
  ['center', '상담센터 연계'],
];

export default function ProfessorHome({ me, onPreview }: { me: Profile; onPreview: () => void }) {
  const [students, setStudents] = useState<Profile[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [referrals, setReferrals] = useState<Record<string, Referral>>({});
  const [notes, setNotes] = useState<Record<string, AdvisorNote>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [term, setTerm] = useState(termOf());
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    const [p, e, r, n, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('name'),
      supabase.from('entries').select('*').order('created_at', { ascending: false }),
      supabase.from('referrals').select('*'),
      supabase.from('advisor_notes').select('*'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const err = p.error || e.error || r.error || n.error;
    if (err) toast('불러오지 못했어요: ' + err.message);
    setStudents((p.data as Profile[]) ?? []);
    setEntries((e.data as Entry[]) ?? []);
    setReferrals(Object.fromEntries(((r.data as Referral[]) ?? []).map((x) => [x.student_id, x])));
    setNotes(Object.fromEntries(((n.data as AdvisorNote[]) ?? []).map((x) => [x.student_id, x])));
    setSettings((s.data as Settings) ?? null);
  }, [me.id]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const byStudent = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    for (const e of entries) (m[e.student_id] ??= []).push(e);
    return m;
  }, [entries]);

  const rows = useMemo(
    () =>
      (students ?? [])
        .map((s) => {
          const es = byStudent[s.id] ?? [];
          return {
            s,
            per: PERIODS.map(([p]) => periodState(es, term, p)),
            a: termAssess(es, term),
            pending: es.filter((e) => e.mode === 'request' && !isDone(e)).length,
            lastAt: es[0]?.created_at ?? '',
            ref: referrals[s.id]?.status ?? 'none',
            enroll: notes[s.id]?.enroll_status ?? '재학',
          };
        })
        .sort((x, y) => (y.a?.level ?? -1) - (x.a?.level ?? -1) || x.s.name.localeCompare(y.s.name, 'ko')),
    [students, byStudent, referrals, notes, term],
  );

  if (!students) return <div className="skeleton"><div /><div /><div /></div>;

  const n = rows.length;
  const terms = Array.from(new Set([termOf(), ...entries.map((e) => e.term)])).sort().reverse();
  const risk = rows.filter((r) => r.a && r.a.level >= 2).length;
  const riskHi = rows.filter((r) => r.a?.level === 3).length;
  const pending = rows.reduce((s, r) => s + r.pending, 0);
  const needRef = rows.filter((r) => r.a?.center && r.ref === 'none').length;
  const linked = rows.filter((r) => r.ref === 'advised' || r.ref === 'linked').length;
  const base = rows.filter((r) => r.enroll !== '졸업');
  const kept = base.filter((r) => r.enroll === '재학').length;
  const ret = base.length ? Math.round((kept / base.length) * 100) : null;

  const query = q.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (query && ![r.s.name, r.s.student_no ?? '', r.s.dept ?? ''].some((v) => v.toLowerCase().includes(query))) return false;
    if (filter === 'risk') return Boolean(r.a && (r.a.level >= 2 || r.a.leave || r.a.acad));
    if (filter === 'pending') return r.pending > 0;
    if (filter === 'missing') return r.per.some((p) => p.st === 'due' || p.st === 'req');
    if (filter === 'center') return Boolean(r.a?.center) || r.ref !== 'none';
    return true;
  });

  const MK = { done: 'done', req: 'req', due: 'miss', later: '' } as const;
  const MKL = { done: '완료', req: '신청함', due: '미완료', later: '기간 전' } as const;

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="row">
          <label className="label" htmlFor="term">학기</label>
          <select id="term" className="auto" value={term} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => <option key={t} value={t}>{termLabel(t)}</option>)}
          </select>
        </div>
        <div className="row">
          <button onClick={load}>새로고침</button>
          <button onClick={onPreview}>학생 화면 미리보기</button>
          <button onClick={() => setShowSettings(true)}>설정</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="label">지도학생</span><span className="num">{n}<small>명</small></span><span className="sub">상담카드를 만든 학생</span></div>
        <div className="stat">
          <span className="label">정기상담 완료</span>
          <div className="bars">
            {PERIODS.map(([p, l], i) => {
              const c = rows.filter((r) => r.per[i].st === 'done').length;
              return (
                <div className="bar" key={p}>
                  <span>{l}</span><i><b style={{ width: `${n ? (c / n) * 100 : 0}%` }} /></i><em>{c}/{n}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stat"><span className="label">위험·주의 학생</span><span className={`num ${risk ? 'c-risk' : ''}`}>{risk}<small>명</small></span><span className="sub">위험 {riskHi}명 · 학기 중 가장 높은 단계 기준</span></div>
        <div className="stat"><span className="label">상담 신청 대기</span><span className={`num ${pending ? 'c-info' : ''}`}>{pending}<small>건</small></span><span className="sub">학생이 신청했고 아직 완료 전</span></div>
        <div className="stat"><span className="label">상담센터 연계</span><span className="num">{linked}<small>명</small></span><span className="sub">{needRef ? <>연계 권장인데 미조치 <b className="c-warn">{needRef}명</b></> : '미조치 학생 없음'}</span></div>
        <div className="stat"><span className="label">재학 유지율</span><span className="num">{ret === null ? '—' : <>{ret}<small>%</small></>}</span><span className="sub">재학 {kept}명 / 졸업 제외 {base.length}명</span></div>
      </div>

      <div className="toolbar">
        <div className="filters" role="group" aria-label="학생 필터">
          {FILTERS.map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input type="search" className="search" placeholder="이름, 학번, 학과 검색" aria-label="학생 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {n === 0 ? (
        <div className="panel empty">
          <strong>아직 등록한 학생이 없어요</strong>
          앱 주소를 학생들에게 알려 주세요. 학생이 로그인해 상담카드를 만드는 순간 여기에 나타납니다.
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>학생</th><th>정기상담 (초·말·방)</th><th>자가진단 (학기 중 최고)</th><th>신청 대기</th><th>최근 기록</th><th>상담센터</th><th>학적</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={7} className="empty">조건에 맞는 학생이 없어요.</td></tr>}
              {shown.map((r) => (
                <tr key={r.s.id} tabIndex={0} onClick={() => setOpenId(r.s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenId(r.s.id)}>
                  <td><div className="nm">{r.s.name}</div><div className="sm mono">{r.s.student_no} · {r.s.dept} {r.s.grade}학년</div></td>
                  <td>
                    <span className="marks">
                      {r.per.map((p, i) => (
                        <span key={i} className={`mk ${MK[p.st]}`} title={`${PERIODS[i][1]}: ${MKL[p.st]}`}>{['초', '말', '방'][i]}</span>
                      ))}
                    </span>
                  </td>
                  <td>
                    {r.a ? (
                      <>
                        <span className={`pill lv-${r.a.level}`}>{LEVELS[r.a.level]}</span>{' '}
                        {r.a.leave && <span className="tag leave">휴학</span>}{' '}
                        {r.a.acad && <span className="tag acad">학사</span>}
                      </>
                    ) : <span className="sm">기록 없음</span>}
                  </td>
                  <td className="mono">{r.pending ? <b className="c-info">{r.pending}건</b> : <span className="sm">—</span>}</td>
                  <td className="sm">{r.lastAt ? fmt(r.lastAt) : '—'}</td>
                  <td>{r.ref !== 'none' ? REFL[r.ref] : r.a?.center ? <span className="tag center">연계 권장</span> : <span className="sm">—</span>}</td>
                  <td>{r.enroll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        정기상담 표시: <span className="mk done">초</span> 완료 · <span className="mk req">말</span> 신청함 · <span className="mk miss">방</span> 기간이 지났는데 미완료 · <span className="mk">방</span> 아직 기간 전. 위험 단계는 학생 자가진단으로 자동 계산돼요.
      </p>

      {openId && (
        <StudentDetail
          student={students.find((s) => s.id === openId)!}
          entries={byStudent[openId] ?? []}
          referral={referrals[openId] ?? null}
          note={notes[openId] ?? null}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
      {showSettings && <SettingsForm initial={settings} onClose={() => setShowSettings(false)} onSaved={load} />}
    </div>
  );
}
