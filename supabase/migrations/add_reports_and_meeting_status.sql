-- 신고 테이블: 신고 접수 + AI 분류 결과 저장
CREATE TABLE IF NOT EXISTS letsmeet_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id VARCHAR(128) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('meeting', 'feed', 'comment')),
  target_id TEXT NOT NULL,
  target_user_id VARCHAR(128) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  detail TEXT,
  extra JSONB,
  ai_verdict VARCHAR(30) CHECK (ai_verdict IN ('meeting_suspend', 'needs_review', 'no_issue')),
  ai_verdict_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_reports_target ON letsmeet_reports(target_type, target_id);
CREATE INDEX idx_letsmeet_reports_reporter ON letsmeet_reports(reporter_user_id);
CREATE INDEX idx_letsmeet_reports_created ON letsmeet_reports(created_at DESC);

-- 모임 상태 ENUM 정의 (문자 오타 방지, 테스트 시 편의)
DO $$ BEGIN
  CREATE TYPE meeting_status_enum AS ENUM (
    'open',
    'closed',
    'completed',
    'cancelled',
    'suspended',
    'under_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL; -- 이미 있으면 스킵
END $$;

-- 기존 CHECK 제거 후 컬럼을 ENUM으로 변경
ALTER TABLE letsmeet_meetings DROP CONSTRAINT IF EXISTS letsmeet_meetings_status_check;
ALTER TABLE letsmeet_meetings
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE meeting_status_enum USING status::meeting_status_enum,
  ALTER COLUMN status SET DEFAULT 'open'::meeting_status_enum;
