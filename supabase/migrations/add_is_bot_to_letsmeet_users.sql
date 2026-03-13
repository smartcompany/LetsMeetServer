-- 봇 대시보드에서 사용자별 봇 선택 여부 저장 (기본값 false)
ALTER TABLE letsmeet_users
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN letsmeet_users.is_bot IS '봇 대시보드에서 AI 봇으로 사용할 계정 여부';
