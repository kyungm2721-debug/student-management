-- 지도학생 상담카드 · Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 보안 원칙: 학생은 자기 기록만, 지도교수(role = 'professor')는 전체를 봅니다.

create extension if not exists pgcrypto;

-- ───────────── 테이블 ─────────────

-- 학생/교수 기본 정보 (auth.users 와 1:1)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'student' check (role in ('student', 'professor')),
  name        text not null,
  student_no  text,
  dept        text,
  grade       int check (grade between 1 and 6),
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 상담 기록 (정기상담 체크 / 상시상담 신청)
create table if not exists public.entries (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  term             text not null,                       -- 예: '2026-2'
  kind             text not null check (kind in ('regular', 'anytime')),
  period           text check (period in ('start', 'end', 'vac')),
  mode             text not null check (mode in ('request', 'done')),
  date             date not null,                       -- 희망 날짜 또는 상담한 날짜
  time_pref        text,
  checks           text[] not null default '{}',        -- 자가진단 항목 id 목록
  message          text,
  student_done_at  date,                                -- 학생이 '상담 마쳤어요'
  prof_done_at     date,                                -- 교수 확인 완료
  created_at       timestamptz not null default now(),
  constraint entries_period_matches_kind check ((kind = 'regular') = (period is not null))
);
create index if not exists entries_student_idx on public.entries(student_id);
create index if not exists entries_term_idx on public.entries(term);

-- 학생상담센터 연계 상태 (학생 본인도 읽을 수 있음)
create table if not exists public.referrals (
  student_id  uuid primary key references public.profiles(id) on delete cascade,
  status      text not null default 'none' check (status in ('none', 'advised', 'linked', 'closed')),
  changed_at  date not null default current_date
);

-- 교수 전용: 학적 상태, 비공개 메모
create table if not exists public.advisor_notes (
  student_id     uuid primary key references public.profiles(id) on delete cascade,
  enroll_status  text not null default '재학' check (enroll_status in ('재학', '휴학', '자퇴·제적', '졸업')),
  memo           text not null default '',
  updated_at     timestamptz not null default now()
);

-- 설정 (한 줄짜리)
create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  prof_name    text not null default '',
  center_info  text not null default ''
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ───────────── 권한 헬퍼 ─────────────

create or replace function public.is_professor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'professor');
$$;

-- role 은 SQL Editor 에서만 바꿀 수 있게 (auth.uid() 가 null 일 때만 허용)
-- 학생은 물론, 앱에 로그인한 교수도 API 로 다른 사람을 교수로 올리거나 내릴 수 없다
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception '역할(role)은 바꿀 수 없습니다';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 학생은 기록을 남긴 뒤에는 '상담 마쳤어요'(student_done_at)만 바꿀 수 있게
-- 교수 확인 칸(prof_done_at), 소유자, 자가진단 체크, 작성 시각 등은 수정 불가
-- (앞서 남긴 위험 신호를 나중에 지우거나 기록을 다른 학기로 옮기지 못하게 하려는 것)
create or replace function public.guard_entry()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_professor() then
    if new.prof_done_at is distinct from old.prof_done_at then
      raise exception '교수 확인 항목은 바꿀 수 없습니다';
    end if;
    if new.student_id is distinct from old.student_id then
      raise exception '기록 소유자는 바꿀 수 없습니다';
    end if;
    if (to_jsonb(new) - 'student_done_at') is distinct from (to_jsonb(old) - 'student_done_at') then
      raise exception '남긴 기록은 고칠 수 없어요. 새로 기록을 남겨 주세요';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists entries_guard on public.entries;
create trigger entries_guard before update on public.entries
  for each row execute function public.guard_entry();

-- ───────────── RLS ─────────────

alter table public.profiles      enable row level security;
alter table public.entries       enable row level security;
alter table public.referrals     enable row level security;
alter table public.advisor_notes enable row level security;
alter table public.settings      enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_professor());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() and role = 'student');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_professor())
  with check (id = auth.uid() or public.is_professor());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.is_professor());

-- entries
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select
  using (student_id = auth.uid() or public.is_professor());
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert
  with check (student_id = auth.uid() and prof_done_at is null);
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update
  using (student_id = auth.uid() or public.is_professor())
  with check (student_id = auth.uid() or public.is_professor());
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete
  using (public.is_professor());

-- referrals: 학생은 자기 것 읽기만, 교수는 전부
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals for select
  using (student_id = auth.uid() or public.is_professor());
drop policy if exists referrals_write on public.referrals;
create policy referrals_write on public.referrals for all
  using (public.is_professor()) with check (public.is_professor());

-- advisor_notes: 교수만
drop policy if exists notes_all on public.advisor_notes;
create policy notes_all on public.advisor_notes for all
  using (public.is_professor()) with check (public.is_professor());

-- settings: 로그인한 사람은 읽기, 교수만 수정
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select
  using (auth.uid() is not null);
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update
  using (public.is_professor()) with check (public.is_professor());

-- ───────────── 지도교수 지정 ─────────────
-- 교수님이 앱에 한 번 로그인해 상담카드를 만든 뒤, 아래 이메일을 바꿔 실행하세요.
-- update public.profiles set role = 'professor'
--   where id = (select id from auth.users where email = 'professor@example.com');
