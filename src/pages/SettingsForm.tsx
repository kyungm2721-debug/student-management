import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Settings } from '../lib/types';
import { Field, Modal, toast } from '../components/ui';

export default function SettingsForm({ initial, onClose, onSaved }: {
  initial: Settings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [profName, setProfName] = useState(initial?.prof_name ?? '');
  const [center, setCenter] = useState(initial?.center_info ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('settings')
      .update({ prof_name: profName.trim(), center_info: center.trim() })
      .eq('id', 1);
    if (error) return toast('저장하지 못했어요: ' + error.message);
    toast('설정을 저장했어요');
    onSaved();
    onClose();
  };

  return (
    <Modal title="설정" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field id="s-prof" label="지도교수 이름">
          <input id="s-prof" value={profName} onChange={(e) => setProfName(e.target.value)} />
        </Field>
        <Field id="s-center" label="학생상담센터 안내 문구">
          <textarea
            id="s-center"
            placeholder="예: 학생회관 2층 학생상담센터 · 02-000-0000 · 평일 9–18시 · 온라인 예약 가능"
            value={center}
            onChange={(e) => setCenter(e.target.value)}
          />
        </Field>
        <p className="muted small">자가진단 결과 상담센터 연계가 필요하거나, 교수님이 연계를 표시한 학생에게 보여요.</p>
        <div className="foot">
          <button type="button" onClick={onClose}>취소</button>
          <button className="primary" type="submit">저장</button>
        </div>
      </form>
    </Modal>
  );
}
