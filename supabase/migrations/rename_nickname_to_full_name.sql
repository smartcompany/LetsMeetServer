-- nickname 제거, full_name만 사용하도록 마이그레이션
-- 1. full_name이 비어있는 경우 nickname 값으로 채우기
UPDATE letsmeet_users
SET full_name = COALESCE(NULLIF(TRIM(full_name), ''), nickname)
WHERE full_name IS NULL OR TRIM(full_name) = '';

-- 2. 여전히 full_name이 비어있는 레코드에 기본값 설정 (안전을 위해)
UPDATE letsmeet_users
SET full_name = '사용자'
WHERE full_name IS NULL OR TRIM(full_name) = '';

-- 3. full_name NOT NULL 제약 추가
ALTER TABLE letsmeet_users
ALTER COLUMN full_name SET NOT NULL;

-- 4. nickname 컬럼 삭제
ALTER TABLE letsmeet_users
DROP COLUMN IF EXISTS nickname;
