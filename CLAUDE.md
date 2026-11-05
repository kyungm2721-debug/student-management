# 지도학생 상담카드 — 프로젝트 안내 (Claude Code용)

## 무엇을 만드는 앱인가
대학 지도교수용 상담 관리 웹앱. 학생이 직접 로그인해 정기상담을 체크하거나 상시상담을 신청하면 상담 기록이 자동으로 쌓인다. 자가진단 결과로 휴학 가능성·학사 부적응 학생을 구별해 학생상담센터로 연결하고, 최종 목표는 **재학생 유지율 향상**이다.

- 정기상담: 학기마다 3번 — 학기 초(3–4월/9–10월), 학기 말(5–6월/11–12월), 방학 중(7–8월/1–2월)
- 상시상담: 학생이 필요할 때마다
- 학기 계산: 3–8월 = 그해 1학기, 9–12월 = 그해 2학기, 1–2월 = 전년도 2학기(겨울방학)

## 기술 스택
- Vite + React 18 + TypeScript (SPA)
- Supabase: Auth(구글 OAuth, 이메일 매직링크) + Postgres + RLS
- 서버 코드 없음. 보안은 전부 `supabase/schema.sql` 의 RLS 정책과 트리거가 담당

## 폴더 구조
```
supabase/schema.sql      테이블, RLS, 트리거 (Supabase SQL Editor에서 실행)
src/lib/logic.ts         자가진단 항목·위험 단계 계산·학기/시기 계산 (핵심 규칙은 여기만)
src/lib/types.ts         DB 행 타입
src/lib/supabase.ts      클라이언트, 환경변수
src/App.tsx              세션 → 프로필 → 학생/교수 화면 분기
src/pages/Login.tsx      구글 로그인, 이메일 링크 로그인
src/pages/ProfileForm.tsx 상담카드 만들기/내 정보 수정
src/pages/StudentHome.tsx 학생 화면
src/pages/ProfessorHome.tsx 교수 대시보드 (요약, 필터, 명단 표)
src/pages/StudentDetail.tsx 교수용 학생 상세 (학적, 연계, 메모, 완료 처리, 삭제)
src/pages/SettingsForm.tsx 교수 이름, 학생상담센터 안내 문구
src/components/          EntryForm(상담 기록 입력), EntryItem(기록 한 건), ui(Modal, toast, Field)
```

## 데이터와 권한 (반드시 지킬 것)
| 테이블 | 학생 본인 | 다른 학생 | 교수(role='professor') |
|---|---|---|---|
| profiles | 읽기·쓰기(role 변경 불가) | 불가 | 전부 |
| entries | 읽기·추가, 수정은 student_done_at 만 | 불가 | 전부 |
| referrals (상담센터 연계 상태) | 읽기 | 불가 | 전부 |
| advisor_notes (학적, 비공개 메모) | 불가 | 불가 | 전부 |
| settings | 읽기 | 읽기 | 수정 |

- 학생에게 위험 단계(안정/관심/주의/위험)를 **보여주지 않는다.** 필요할 때 상담센터 안내 문구만 보인다.
- 위험 단계 규칙은 `logic.ts` 의 `assess()` / `termAssess()` 에만 둔다. 화면에서 따로 계산하지 말 것.
- 권한을 바꾸면 `supabase/rls_check.sql` 을 SQL Editor 에서 돌려 확인 (트랜잭션으로 되돌림, 데이터 안 남음)
- 교수 지정은 SQL로만 (트리거가 API 로 role 바꾸는 것을 교수 포함 모두 막음): `update profiles set role='professor' where id=(select id from auth.users where email='...')`

## 자가진단 규칙 요약
- 즉시 위험: 휴학 고민, 자퇴·전과·편입 고민, 우울·무기력
- 가중치 합 5점 이상 주의, 2–4점 관심, 0–1점 안정
- 휴학 위험 표시: 휴학/자퇴 고민 또는 경제·건강 항목 2개 이상
- 학사 부적응 표시: 학업 관련 항목 2개 이상
- 교수 화면은 학기 중 가장 높은 단계를 보여준다

## 명령어
```
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입 검사 + 빌드
```

## 현재 상태와 다음 할 일
- v0.1: 이 저장소의 첫 버전. 작성 환경에서 npm 설치가 막혀 있어 **실제 Supabase와 연결해 돌려 보지 못했다.** 모의 Supabase로 화면·클릭 흐름만 확인했다.
- 먼저 `npm install && npm run build` 로 타입 오류부터 잡을 것.
- 그다음 후보 작업:
  1. Supabase Realtime 구독으로 교수 화면 자동 갱신 (지금은 새로고침 버튼 + 창 포커스 시 다시 불러오기)
  2. 상담 신청이 들어오면 교수에게 이메일 알림 (Supabase Edge Function)
  3. 여러 교수 지원: profiles 에 advisor_id 추가, RLS 를 "내 지도학생만"으로 변경
  4. CSV 내보내기 (학기별 상담 현황)
  5. 이메일 도메인 제한을 클라이언트가 아니라 DB(트리거)에서도 강제
- UI 문구는 한국어, 짧고 친절하게. 학생에게 겁주는 표현 금지.
