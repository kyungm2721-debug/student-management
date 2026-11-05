import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, configured, allowedDomain } from './lib/supabase';
import type { Profile } from './lib/types';
import { termLabel, termOf } from './lib/logic';
import { Toaster } from './components/ui';
import Login from './pages/Login';
import ProfileForm from './pages/ProfileForm';
import StudentHome from './pages/StudentHome';
import ProfessorHome from './pages/ProfessorHome';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session) return setProfile(undefined);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) console.error(error);
    setProfile((data as Profile) ?? null);
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const email = session?.user.email ?? '';
  const domainBlocked = Boolean(session && allowedDomain && !email.toLowerCase().endsWith('@' + allowedDomain.toLowerCase()));
  const isProf = profile?.role === 'professor';
  const role = !profile ? '' : isProf ? (preview ? '학생 화면 미리보기' : '지도교수') : '학생';

  let body;
  if (!configured) {
    body = (
      <div className="notice warn">
        <strong>Supabase 설정이 필요해요.</strong>
        <p>.env 파일에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 넣고 다시 실행해 주세요. README.md 를 참고하세요.</p>
      </div>
    );
  } else if (!ready) {
    body = <div className="skeleton"><div /><div /></div>;
  } else if (!session) {
    body = <Login />;
  } else if (domainBlocked) {
    body = (
      <div className="notice warn">
        <strong>학교 이메일로 로그인해 주세요.</strong>
        <p>{allowedDomain} 계정만 사용할 수 있어요. 지금 로그인한 계정: {email}</p>
        <div className="row"><button onClick={() => supabase.auth.signOut()}>로그아웃</button></div>
      </div>
    );
  } else if (profile === undefined) {
    body = <div className="skeleton"><div /><div /></div>;
  } else if (profile === null) {
    body = <ProfileForm userId={session.user.id} onSaved={loadProfile} />;
  } else if (isProf && !preview) {
    body = <ProfessorHome me={profile} onPreview={() => setPreview(true)} />;
  } else {
    body = <StudentHome me={profile} onProfileSaved={loadProfile} preview={preview} onExitPreview={() => setPreview(false)} />;
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>지도학생 상담카드</h1>
          <p>학생이 직접 체크하면 상담 기록이 자동으로 남습니다</p>
        </div>
        <div className="meta">
          {role && <span className="chip">{role}</span>}
          <span className="chip"><b>{termLabel(termOf())}</b></span>
          {session && <button className="ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>}
        </div>
      </header>
      <main>{body}</main>
      <Toaster />
    </div>
  );
}
