import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Entry, Kind, Period, Profile, Referral, Settings } from '../lib/types';
import { PERIODS, defaultPeriod, fmt, periodHint, periodState, termAssess, termLabel, termOf, today } from '../lib/logic';
import EntryItem from '../components/EntryItem';
import EntryForm from '../components/EntryForm';
import ProfileForm from './ProfileForm';
import { Modal, toast } from '../components/ui';

export default function StudentHome({ me, onProfileSaved, preview, onExitPreview }: {
  me: Profile;
  onProfileSaved: () => void;
  preview: boolean;
  onExitPreview: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<{ kind: Kind; period: Period } | null>(null);
  const [editProfile, setEditProfile] = useState(false);

  const load = useCallback(async () => {
    const [e, r, s] = await Promise.all([
      supabase.from('entries').select('*').eq('student_id', me.id).order('created_at', { ascending: false }),
      supabase.from('referrals').select('*').eq('student_id', me.id).maybeSingle(),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (e.error) toast('기록을 불러오지 못했어요: ' + e.error.message);
    setEntries((e.data as Entry[]) ?? []);
    setReferral((r.data as Referral) ?? null);
    setSettings((s.data as Settings) ?? null);
  }, [me.id]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const markDone = async (e: Entry) => {
    const { error } = await supabase.from('entries').update({ student_done_at: today() }).eq('id', e.id);
    if (error) return toast('저장하지 못했어요: ' + error.message);
    toast('상담 완료로 기록했어요');
    load();
  };

  if (!entries) return <div className="skeleton"><div /><div /></div>;

  const t = termOf();
  const a = termAssess(entries, t);
  const refStatus = referral && referral.status !== 'none' ? referral.status : null;
  const showCenter = Boolean(a?.center || refStatus);
  const centerHead =
    refStatus === 'advised' ? '교수님이 학생상담센터 상담을 권해 드렸어요'
    : refStatus === 'linked' ? '학생상담센터와 연결되었어요'
    : refStatus === 'closed' ? '학생상담센터 상담이 마무리되었어요'
    : '혼자 고민하지 않아도 괜찮아요';

  return (
    <div className="stack">
      {preview && (
        <div className="notice">
          <strong>학생 화면 미리보기입니다.</strong>
          <p>여기서 남긴 기록은 실제로 저장되고, 교수님 목록에도 나타나요.</p>
          <div className="row"><button onClick={onExitPreview}>교수 화면으로 돌아가기</button></div>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="label">{me.dept} · {me.grade}학년 · <span className="mono">{me.student_no}</span></span>
            <h2>{me.name}님, 안녕하세요</h2>
          </div>
          <button className="ghost" onClick={() => setEditProfile(true)}>내 정보 수정</button>
        </div>
        <div className="actions">
          <button className="primary action" onClick={() => setForm({ kind: 'regular', period: defaultPeriod() })}>
            <strong>정기상담 체크하기</strong><span>학기 초 · 학기 말 · 방학 중 상담</span>
          </button>
          <button className="action" onClick={() => setForm({ kind: 'anytime', period: defaultPeriod() })}>
            <strong>상시상담 신청하기</strong><span>고민이 생겼을 때 언제든</span>
          </button>
        </div>
      </section>

      {showCenter && (
        <div className="notice">
          <strong>{centerHead}</strong>
          <p>
            {!refStatus && '남겨 준 내용을 교수님이 확인하고 연락드릴게요. 바로 이야기하고 싶다면 학생상담센터를 찾아가도 좋아요.\n\n'}
            {settings?.center_info || '학생상담센터 위치와 연락처는 교수님이 곧 안내해 드릴 거예요.'}
          </p>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>{termLabel(t)} 정기상담</h2>
          <span className="muted small">학기마다 세 번 체크해요</span>
        </div>
        <div className="periods">
          {PERIODS.map(([p, l]) => {
            const s = periodState(entries, t, p);
            const label =
              s.st === 'done' ? `상담 완료 · ${fmt(s.date)}`
              : s.st === 'req' ? `신청함 · 희망일 ${fmt(s.date)}`
              : s.st === 'due' ? '아직 하지 않았어요'
              : '아직 기간이 아니에요';
            return (
              <div key={p} className={`period ${s.st}`}>
                <span className="label">{l} · {periodHint(t, p)}</span>
                <span className="state">{label}</span>
                {s.st !== 'done' && (
                  <button onClick={() => setForm({ kind: 'regular', period: p })}>
                    {s.st === 'req' ? '다시 체크하기' : '체크하기'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack tight">
        <h2>내 상담 기록</h2>
        {entries.length ? (
          <ul className="entries">
            {entries.map((e) => <EntryItem key={e.id} e={e} prof={false} onStudentDone={markDone} />)}
          </ul>
        ) : (
          <div className="panel empty">
            <strong>아직 남긴 기록이 없어요</strong>
            정기상담 체크나 상시상담 신청을 하면 여기에 쌓입니다.
          </div>
        )}
      </section>

      {form && (
        <EntryForm
          studentId={me.id}
          initKind={form.kind}
          initPeriod={form.period}
          onClose={() => setForm(null)}
          onSaved={load}
        />
      )}
      {editProfile && (
        <Modal title="내 정보 수정" onClose={() => setEditProfile(false)}>
          <ProfileForm
            userId={me.id}
            initial={me}
            onCancel={() => setEditProfile(false)}
            onSaved={() => { setEditProfile(false); onProfileSaved(); }}
          />
        </Modal>
      )}
    </div>
  );
}
