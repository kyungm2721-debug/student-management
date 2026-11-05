import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { Field, toast } from '../components/ui';

/** 처음 들어온 학생의 상담카드 만들기 + 내 정보 수정 (initial 이 있으면 수정) */
export default function ProfileForm({ userId, initial, onSaved, onCancel }: {
  userId: string;
  initial?: Profile;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    student_no: initial?.student_no ?? '',
    dept: initial?.dept ?? '',
    grade: String(initial?.grade ?? 1),
    phone: initial?.phone ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.student_no.trim() || !f.dept.trim()) {
      toast('이름, 학번, 학과를 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    const row = {
      name: f.name.trim(),
      student_no: f.student_no.trim(),
      dept: f.dept.trim(),
      grade: Number(f.grade),
      phone: f.phone.trim() || null,
    };
    const { error } = initial
      ? await supabase.from('profiles').update(row).eq('id', userId)
      : await supabase.from('profiles').insert({ id: userId, role: 'student', ...row });
    setBusy(false);
    if (error) {
      toast('저장하지 못했어요: ' + error.message);
      return;
    }
    toast(initial ? '내 정보를 저장했어요' : '상담카드를 만들었어요');
    onSaved();
  };

  return (
    <form className={initial ? 'stack' : 'panel stack'} onSubmit={submit}>
      {!initial && (
        <div>
          <span className="label">처음 오셨네요</span>
          <h2>상담카드를 만들어 주세요</h2>
          <p className="muted">한 번만 입력하면 돼요. 이 정보와 상담 기록은 지도교수님만 볼 수 있어요.</p>
        </div>
      )}
      <div className="grid2">
        <Field id="p-name" label="이름"><input id="p-name" value={f.name} onChange={set('name')} /></Field>
        <Field id="p-sno" label="학번"><input id="p-sno" value={f.student_no} onChange={set('student_no')} /></Field>
        <Field id="p-dept" label="학과"><input id="p-dept" value={f.dept} onChange={set('dept')} /></Field>
        <Field id="p-grade" label="학년">
          <select id="p-grade" value={f.grade} onChange={set('grade')}>
            {[1, 2, 3, 4, 5].map((g) => (
              <option key={g} value={g}>{g === 5 ? '5학년 이상' : `${g}학년`}</option>
            ))}
          </select>
        </Field>
        <Field id="p-phone" label="연락처 (선택)"><input id="p-phone" type="tel" value={f.phone} onChange={set('phone')} /></Field>
      </div>
      <div className="foot">
        {onCancel && <button type="button" onClick={onCancel}>취소</button>}
        <button className="primary" type="submit" disabled={busy}>{initial ? '저장' : '상담카드 만들기'}</button>
      </div>
    </form>
  );
}
