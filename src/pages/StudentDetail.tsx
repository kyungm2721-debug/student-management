import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { AdvisorNote, Entry, Enroll, Profile, RefStatus, Referral } from '../lib/types';
import { ENROLL, REF, fmt, today } from '../lib/logic';
import EntryItem from '../components/EntryItem';
import { Field, Modal, toast } from '../components/ui';

export default function StudentDetail({ student, entries, referral, note, onClose, onChanged }: {
  student: Profile;
  entries: Entry[];
  referral: Referral | null;
  note: AdvisorNote | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [enroll, setEnroll] = useState<Enroll>(note?.enroll_status ?? '재학');
  const [ref, setRef] = useState<RefStatus>(referral?.status ?? 'none');
  const [memo, setMemo] = useState(note?.memo ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const n = await supabase.from('advisor_notes').upsert({
      student_id: student.id,
      enroll_status: enroll,
      memo,
      updated_at: new Date().toISOString(),
    });
    const r = (referral?.status ?? 'none') !== ref
      ? await supabase.from('referrals').upsert({ student_id: student.id, status: ref, changed_at: today() })
      : null;
    setBusy(false);
    const err = n.error || r?.error;
    if (err) return toast('저장하지 못했어요: ' + err.message);
    toast('저장했어요');
    onChanged();
  };

  const toggleProf = async (e: Entry) => {
    const { error } = await supabase
      .from('entries')
      .update({ prof_done_at: e.prof_done_at ? null : today() })
      .eq('id', e.id);
    if (error) return toast('저장하지 못했어요: ' + error.message);
    toast(e.prof_done_at ? '완료 표시를 취소했어요' : '상담 완료로 표시했어요');
    onChanged();
  };

  const remove = async () => {
    const { error } = await supabase.from('profiles').delete().eq('id', student.id);
    if (error) return toast('삭제하지 못했어요: ' + error.message);
    toast('학생 기록을 삭제했어요');
    onClose();
    onChanged();
  };

  return (
    <Modal title={student.name} eyebrow={`${student.student_no} · ${student.dept} ${student.grade}학년`} onClose={onClose}>
      {student.phone && <p className="mono muted small selectable">{student.phone}</p>}
      <form className="panel stack sunk" onSubmit={save}>
        <div className="grid2">
          <Field id="n-enroll" label="학적 상태">
            <select id="n-enroll" value={enroll} onChange={(e) => setEnroll(e.target.value as Enroll)}>
              {ENROLL.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field id="n-ref" label="학생상담센터 연계">
            <select id="n-ref" value={ref} onChange={(e) => setRef(e.target.value as RefStatus)}>
              {REF.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field id="n-memo" label="교수 메모 (학생에게 보이지 않아요)">
          <textarea id="n-memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Field>
        <div className="row spread">
          <span className="muted small">
            {referral?.changed_at ? `연계 상태 변경: ${fmt(referral.changed_at)}` : '연계 상태는 학생에게 안내 문구로 보여요'}
          </span>
          <button className="primary" type="submit" disabled={busy}>저장</button>
        </div>
      </form>

      <section className="stack tight">
        <h3>상담 기록</h3>
        {entries.length ? (
          <ul className="entries">
            {entries.map((e) => <EntryItem key={e.id} e={e} prof onProfToggle={toggleProf} />)}
          </ul>
        ) : (
          <p className="muted">아직 기록이 없어요.</p>
        )}
      </section>

      <div className="foot spread">
        {confirmDel ? (
          <span className="row tight">
            <span className="c-risk small">이 학생의 모든 기록을 지울까요? 되돌릴 수 없어요.</span>
            <button className="danger" onClick={remove}>삭제</button>
            <button onClick={() => setConfirmDel(false)}>취소</button>
          </span>
        ) : (
          <button className="danger" onClick={() => setConfirmDel(true)}>학생 기록 삭제</button>
        )}
        <button onClick={onClose}>닫기</button>
      </div>
    </Modal>
  );
}
