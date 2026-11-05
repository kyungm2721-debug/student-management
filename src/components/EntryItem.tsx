import type { Entry } from '../lib/types';
import { ITEM, LEVELS, PLABEL, assess, doneDate, fmt, isDone, termLabel } from '../lib/logic';

/** 상담 기록 한 건. prof=true 이면 위험 단계와 교수용 버튼을 보여 줌 */
export default function EntryItem({ e, prof, onStudentDone, onProfToggle }: {
  e: Entry;
  prof: boolean;
  onStudentDone?: (e: Entry) => void;
  onProfToggle?: (e: Entry) => void;
}) {
  const kind = e.kind === 'regular' ? `정기상담 · ${e.period ? PLABEL[e.period] : ''}` : '상시상담';
  const done = isDone(e);
  const a = assess(e.checks);
  return (
    <li className="entry">
      <div className="entry-top">
        <div className="row tight">
          <strong>{kind}</strong>
          <span className="muted small">{termLabel(e.term)} · 기록 {fmt(e.created_at)}</span>
          {prof && (
            <>
              <span className={`pill lv-${a.level}`}>{LEVELS[a.level]}</span>
              {a.leave && <span className="tag leave">휴학 위험</span>}
              {a.acad && <span className="tag acad">학사 부적응</span>}
              {a.center && <span className="tag center">상담센터 권장</span>}
            </>
          )}
        </div>
        {done ? (
          <span className="status done">
            상담 완료 · {fmt(doneDate(e))}{!e.student_done_at && ' (교수 확인)'}
          </span>
        ) : e.mode === 'request' ? (
          <span className="status req">신청 · 희망일 {fmt(e.date)}{e.time_pref ? ` ${e.time_pref}` : ''}</span>
        ) : null}
      </div>
      {e.checks.length ? (
        <div className="checks">{e.checks.map((id) => ITEM[id] && <span key={id}>{ITEM[id].t}</span>)}</div>
      ) : (
        <span className="muted small">체크한 항목 없음</span>
      )}
      {e.message && <div className="msg">{e.message}</div>}
      {prof && onProfToggle && (e.prof_done_at || !done) && (
        <div className="row">
          <button className={e.prof_done_at ? 'ghost' : ''} onClick={() => onProfToggle(e)}>
            {e.prof_done_at ? '완료 표시 취소' : '상담 완료 처리'}
          </button>
        </div>
      )}
      {!prof && onStudentDone && !done && e.mode === 'request' && (
        <div className="row"><button onClick={() => onStudentDone(e)}>상담 마쳤어요</button></div>
      )}
    </li>
  );
}
