import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Kind, Mode, Period } from '../lib/types';
import { CHECKS, PERIODS, periodHint, termLabel, termOf, today } from '../lib/logic';
import { Field, Modal, toast } from './ui';

export default function EntryForm({ studentId, initKind, initPeriod, onClose, onSaved }: {
  studentId: string;
  initKind: Kind;
  initPeriod: Period;
  onClose: () => void;
  onSaved: () => void;
}) {
  const term = termOf();
  const [kind, setKind] = useState<Kind>(initKind);
  const [period, setPeriod] = useState<Period>(initPeriod);
  const [mode, setMode] = useState<Mode>('request');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [checks, setChecks] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setChecks((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return toast('날짜를 골라 주세요.');
    setBusy(true);
    const { error } = await supabase.from('entries').insert({
      student_id: studentId,
      term,
      kind,
      period: kind === 'regular' ? period : null,
      mode,
      date,
      time_pref: mode === 'request' ? time.trim() || null : null,
      checks,
      message: message.trim() || null,
      student_done_at: mode === 'done' ? date : null,
    });
    setBusy(false);
    if (error) return toast('저장하지 못했어요: ' + error.message);
    toast(mode === 'done' ? '상담 기록을 남겼어요' : '상담을 신청했어요. 교수님이 확인할 거예요');
    onSaved();
    onClose();
  };

  return (
    <Modal title={kind === 'regular' ? '정기상담 체크' : '상시상담 신청'} eyebrow={termLabel(term)} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <fieldset>
          <legend>상담 종류</legend>
          <div className="seg">
            <label><input type="radio" name="kind" checked={kind === 'regular'} onChange={() => setKind('regular')} />정기상담</label>
            <label><input type="radio" name="kind" checked={kind === 'anytime'} onChange={() => setKind('anytime')} />상시상담</label>
          </div>
        </fieldset>
        {kind === 'regular' && (
          <fieldset>
            <legend>어느 시기 정기상담인가요?</legend>
            <div className="seg">
              {PERIODS.map(([p, l]) => (
                <label key={p}>
                  <input type="radio" name="period" checked={period === p} onChange={() => setPeriod(p)} />
                  {l} <span className="muted small">{periodHint(term, p)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>상담 진행</legend>
          <div className="seg">
            <label><input type="radio" name="mode" checked={mode === 'request'} onChange={() => setMode('request')} />상담을 신청할게요</label>
            <label><input type="radio" name="mode" checked={mode === 'done'} onChange={() => setMode('done')} />교수님과 상담을 마쳤어요</label>
          </div>
          <div className="grid2">
            <Field id="e-date" label={mode === 'done' ? '상담한 날짜' : '희망 날짜'}>
              <input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {mode === 'request' && (
              <Field id="e-time" label="희망 시간대 (선택)">
                <input id="e-time" placeholder="예: 오후 2시 이후, 화·목 공강" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend>자가진단 체크리스트</legend>
          <p className="muted small">요즘 나에게 해당하는 것을 모두 골라 주세요. 해당 없으면 비워 두셔도 돼요.</p>
          {CHECKS.map((g) => (
            <div className="cgroup" key={g.g}>
              <span className="label">{g.g}</span>
              {g.items.map((i) => (
                <label className="cbox" key={i.id}>
                  <input type="checkbox" checked={checks.includes(i.id)} onChange={() => toggle(i.id)} />
                  <span>{i.t}</span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        <Field id="e-msg" label="교수님께 하고 싶은 이야기 (선택)">
          <textarea
            id="e-msg"
            placeholder="고민이나 궁금한 점, 상담에서 이야기 나눈 내용을 자유롭게 적어 주세요."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <div className="foot">
          <button type="button" onClick={onClose}>취소</button>
          <button className="primary" type="submit" disabled={busy}>기록 남기기</button>
        </div>
      </form>
    </Modal>
  );
}
