# RLS(Row Level Security) 설정 가이드

## UNRESTRICTED → RESTRICTED 로 바꾸는 방법

### 1. 마이그레이션 실행

Supabase 대시보드에서 **SQL Editor**를 열고 아래 파일 내용을 실행하거나,  
로컬에서는 Supabase CLI로 마이그레이션을 적용합니다.

```bash
supabase db push
# 또는
supabase migration up
```

또는 **Dashboard → SQL Editor**에서 `migrations/enable_rls.sql` 내용을 붙여넣어 실행합니다.

### 2. 서버에 Service Role 키 설정

RLS를 켜면 **anon 키**로는 정책에 허용된 작업만 가능합니다.  
현재 API는 모든 테이블을 자유롭게 쓰므로, 서버만 **service_role** 키를 쓰도록 해야 합니다.

1. **Supabase Dashboard** → **Settings** → **API**
2. **Project API keys**에서 `service_role` (secret) 키 복사
3. **서버 환경 변수**에 추가 (절대 클라이언트/프론트에 노출하지 마세요)
   - Vercel: Project → Settings → Environment Variables
   - 로컬: `.env.local`에 추가

   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (실제 키 값)
   ```

4. `lib/db/supabase.ts`는 이미 `SUPABASE_SERVICE_ROLE_KEY`가 있으면 그걸 쓰고, 없으면 기존 anon 키를 사용합니다.

### 3. 적용 순서 요약

1. **먼저** 서버 환경에 `SUPABASE_SERVICE_ROLE_KEY` 설정
2. **그 다음** `enable_rls.sql` 마이그레이션 실행
3. API 서버 재시작(또는 재배포) 후 동작 확인

이후 대시보드 **Table Editor**에서 테이블 옆에 **RESTRICTED**로 표시되면 RLS가 적용된 상태입니다.
