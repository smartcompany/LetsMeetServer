-- AI 판단 사유 저장 (로깅·검토용)
ALTER TABLE letsmeet_reports
  ADD COLUMN IF NOT EXISTS ai_reason TEXT;
