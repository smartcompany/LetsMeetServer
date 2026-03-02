-- 관리자 수동 처리 결과 저장 (모임 정지 / 이상 없음)
ALTER TABLE letsmeet_reports
  ADD COLUMN IF NOT EXISTS admin_verdict VARCHAR(30) CHECK (admin_verdict IN ('meeting_suspend', 'no_issue'));
ALTER TABLE letsmeet_reports
  ADD COLUMN IF NOT EXISTS admin_verdict_at TIMESTAMP WITH TIME ZONE;
