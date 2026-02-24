-- 모임 사후 평가 테이블
-- evaluator: 평가 작성자, meeting_rating: 모임 만족도(선택), participant_scores: { userId: 1~5 }
CREATE TABLE IF NOT EXISTS letsmeet_meeting_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES letsmeet_meetings(id) ON DELETE CASCADE,
  evaluator_user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  meeting_rating INTEGER CHECK (meeting_rating IS NULL OR (meeting_rating >= 1 AND meeting_rating <= 5)),
  participant_scores JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meeting_id, evaluator_user_id)
);

CREATE INDEX IF NOT EXISTS idx_letsmeet_meeting_evaluations_meeting ON letsmeet_meeting_evaluations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_letsmeet_meeting_evaluations_evaluator ON letsmeet_meeting_evaluations(evaluator_user_id);
