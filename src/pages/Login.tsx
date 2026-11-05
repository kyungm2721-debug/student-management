import { useState, type FormEvent } from 'react';
import { supabase, allowedDomain } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const google = async () => {
    setErr('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: allowedDomain ? { hd: allowedDomain } : undefined,
      },
    });
    if (error) setErr('구글 로그인을 시작하지 못했어요: ' + error.message);
  };

  const magic = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const addr = email.trim();
    if (allowedDomain && !addr.toLowerCase().endsWith('@' + allowedDomain.toLowerCase())) {
      setErr(`${allowedDomain} 이메일만 사용할 수 있어요.`);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setErr('메일을 보내지 못했어요: ' + error.message);
    else setSent(true);
  };

  return (
    <section className="panel login">
      <span className="label">로그인</span>
      <h2>상담카드에 들어가기</h2>
      <p className="muted">학생은 자기 상담 기록만 볼 수 있고, 지도교수님은 지도학생 전체 현황을 봅니다.</p>
      <button className="primary wide" onClick={google}>구글 계정으로 로그인</button>
      <div className="divider"><span>또는 이메일 링크로</span></div>
      {sent ? (
        <div className="notice">
          <strong>{email} 로 로그인 링크를 보냈어요.</strong>
          <p>메일함에서 링크를 누르면 바로 들어올 수 있어요.</p>
        </div>
      ) : (
        <form onSubmit={magic} className="row">
          <input
            type="email"
            id="login-email"
            aria-label="이메일"
            placeholder={allowedDomain ? `학번@${allowedDomain}` : '이메일 주소'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">링크 받기</button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
