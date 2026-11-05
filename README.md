# 지도학생 상담카드

학생이 직접 로그인해 상담을 체크하면 기록이 자동으로 남고, 지도교수는 위험군과 학생상담센터 연계를 한눈에 관리하는 웹앱입니다.

## 처음 설정하기 (약 20분)

### 1. Supabase 프로젝트 만들기 (무료)
1. https://supabase.com 에 가입하고 **New project** 를 만듭니다.
2. 왼쪽 **SQL Editor** 에서 `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run** 합니다.
3. (권장) 새 쿼리에 `supabase/rls_check.sql` 을 붙여넣고 **Run** 합니다. 오류 없이 Success 가 나오면 권한 설정이 제대로 된 것입니다. 테스트 데이터는 남지 않습니다.
4. **Project Settings > API** 에서 `Project URL` 과 `anon public` 키를 복사합니다.

### 2. 로그인 방법 켜기
- **이메일 링크**: 기본으로 켜져 있습니다.
- **구글 로그인**: Authentication > Providers > Google 을 켜고, Google Cloud Console 에서 만든 OAuth 클라이언트 ID/비밀번호를 넣습니다. (Supabase 화면의 안내를 따라 하면 됩니다)
- Authentication > URL Configuration 의 **Site URL** 에 앱 주소를 넣습니다. (개발 중에는 `http://localhost:5173`)

### 3. 앱 실행
```
cp .env.example .env      # 복사한 URL 과 키를 .env 에 붙여넣기
npm install
npm run dev
```
브라우저에서 http://localhost:5173 을 엽니다.

### 4. 지도교수 지정
1. 교수님이 앱에 로그인해 상담카드를 한 번 만듭니다.
2. Supabase SQL Editor 에서 실행:
```sql
update public.profiles set role = 'professor'
  where id = (select id from auth.users where email = '교수님이메일@school.ac.kr');
```
3. 새로고침하면 교수 화면이 나옵니다.

### 5. 배포 (선택)
Vercel 또는 Netlify 에 이 폴더를 올리고, 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 넣으면 됩니다. 배포 주소를 Supabase 의 Site URL 에도 추가하세요.

## 학교 이메일만 허용하기
`.env` 의 `VITE_ALLOWED_EMAIL_DOMAIN` 에 `school.ac.kr` 처럼 도메인을 넣으면 그 이메일만 로그인할 수 있습니다.

## 개인정보
상담 기록은 민감한 개인정보입니다. 운영 전에 학교의 개인정보 처리 기준과 동의 절차를 확인하세요. 자가진단은 상담을 돕는 참고 자료이며 전문 심리 검사를 대신하지 않습니다.
