-- 지도학생 상담카드 · RLS 점검 스크립트
-- schema.sql 을 실행한 뒤, Supabase SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 가짜 사용자(학생 A, 학생 B, 교수 P)를 만들어 권한을 확인하고, 마지막에 ROLLBACK 으로 전부 되돌립니다.
-- 실제 데이터는 남지 않습니다. 오류 없이 "Success" 가 나오면 통과, "FAIL: ..." 오류가 나오면 그 항목이 빈틈입니다.

begin;

-- ───── 준비 (관리자 권한) ─────
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'rls-p@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, role, name) values
  ('00000000-0000-0000-0000-00000000000a', 'student',   '학생A'),
  ('00000000-0000-0000-0000-00000000000b', 'student',   '학생B'),
  ('00000000-0000-0000-0000-00000000000f', 'professor', '교수P');

insert into public.entries (student_id, term, kind, mode, date, checks) values
  ('00000000-0000-0000-0000-00000000000a', '2026-2', 'anytime', 'request', current_date, '{mood}'),
  ('00000000-0000-0000-0000-00000000000b', '2026-2', 'anytime', 'request', current_date, '{leave}');

insert into public.advisor_notes (student_id, memo) values
  ('00000000-0000-0000-0000-00000000000a', '학생A 비공개 메모');
insert into public.referrals (student_id, status) values
  ('00000000-0000-0000-0000-00000000000b', 'advised');

-- ───── 학생 A 로 로그인한 상태 ─────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  -- 읽기 범위
  select count(*) into n from public.profiles;       assert n = 1, 'FAIL: 학생A가 다른 사람 프로필을 봄 (' || n || ')';
  select count(*) into n from public.entries;        assert n = 1, 'FAIL: 학생A가 다른 학생 기록을 봄 (' || n || ')';
  select count(*) into n from public.advisor_notes;  assert n = 0, 'FAIL: 학생A가 교수 메모를 봄';
  select count(*) into n from public.referrals;      assert n = 0, 'FAIL: 학생A가 다른 학생 연계 상태를 봄';
  select count(*) into n from public.settings;       assert n = 1, 'FAIL: 학생A가 설정(상담센터 안내)을 못 봄';

  -- 자기 role 바꾸기 → 막혀야 함
  begin
    update public.profiles set role = 'professor' where id = auth.uid();
    raise exception 'FAIL: 학생이 자기 role 을 바꿈';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- prof_done_at 바꾸기 → 막혀야 함
  begin
    update public.entries set prof_done_at = current_date where student_id = auth.uid();
    raise exception 'FAIL: 학생이 prof_done_at 을 바꿈';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- 자가진단 체크 지우기 → 막혀야 함
  begin
    update public.entries set checks = '{}' where student_id = auth.uid();
    raise exception 'FAIL: 학생이 남긴 자가진단을 고침';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- '상담 마쳤어요' → 되어야 함
  update public.entries set student_done_at = current_date where student_id = auth.uid();
  get diagnostics n = row_count;  assert n = 1, 'FAIL: 학생이 상담 마쳤어요를 못 누름';

  -- 다른 학생 기록 수정 → 0건이어야 함
  update public.entries set student_done_at = current_date where student_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;  assert n = 0, 'FAIL: 학생A가 학생B 기록을 고침';

  -- 다른 학생 이름으로 기록 추가 → 막혀야 함
  begin
    insert into public.entries (student_id, term, kind, mode, date)
      values ('00000000-0000-0000-0000-00000000000b', '2026-2', 'anytime', 'request', current_date);
    raise exception 'FAIL: 학생A가 학생B 이름으로 기록을 추가함';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- 교수 확인이 된 상태로 기록 추가 → 막혀야 함
  begin
    insert into public.entries (student_id, term, kind, mode, date, prof_done_at)
      values (auth.uid(), '2026-2', 'anytime', 'done', current_date, current_date);
    raise exception 'FAIL: 학생이 prof_done_at 을 넣은 채로 기록을 추가함';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;

  -- 자기 기록 삭제 → 0건이어야 함
  delete from public.entries where student_id = auth.uid();
  get diagnostics n = row_count;  assert n = 0, 'FAIL: 학생이 자기 기록을 삭제함';

  -- 연계 상태·메모·설정 쓰기 → 막혀야 함
  begin
    insert into public.referrals (student_id, status) values (auth.uid(), 'closed');
    raise exception 'FAIL: 학생이 연계 상태를 씀';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.advisor_notes (student_id, memo) values (auth.uid(), 'x');
    raise exception 'FAIL: 학생이 교수 메모를 씀';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  update public.settings set center_info = 'x';
  get diagnostics n = row_count;  assert n = 0, 'FAIL: 학생이 설정을 바꿈';
end $$;

-- ───── 교수 P 로 로그인한 상태 ─────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.entries where student_id in
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
  assert n = 2, 'FAIL: 교수가 학생 기록을 다 못 봄 (' || n || ')';
  select count(*) into n from public.advisor_notes where student_id = '00000000-0000-0000-0000-00000000000a';
  assert n = 1, 'FAIL: 교수가 메모를 못 봄';

  update public.entries set prof_done_at = current_date where student_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;  assert n = 1, 'FAIL: 교수가 상담 완료 처리를 못 함';

  insert into public.referrals (student_id, status) values ('00000000-0000-0000-0000-00000000000a', 'advised')
    on conflict (student_id) do update set status = excluded.status;

  -- 교수도 앱(API)에서는 role 을 못 바꿈 (SQL Editor 에서만)
  begin
    update public.profiles set role = 'professor' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FAIL: 교수가 API 로 학생을 교수로 올림';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ───── 로그인 안 한 상태(anon) ─────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.profiles;       assert n = 0, 'FAIL: 비로그인 사용자가 프로필을 봄';
  select count(*) into n from public.entries;        assert n = 0, 'FAIL: 비로그인 사용자가 기록을 봄';
  select count(*) into n from public.settings;       assert n = 0, 'FAIL: 비로그인 사용자가 설정을 봄';
end $$;

reset role;
rollback;
