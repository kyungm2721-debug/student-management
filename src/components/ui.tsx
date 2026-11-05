import { useEffect, useState, type ReactNode } from 'react';

export function Modal({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div>
            {eyebrow && <span className="label">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="ghost" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

let pushToast: ((m: string) => void) | null = null;
export const toast = (m: string) => pushToast?.(m);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    pushToast = (m) => {
      setMsg(m);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      pushToast = null;
      window.clearTimeout(t);
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
