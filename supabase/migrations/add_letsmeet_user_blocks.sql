-- 사용자 차단 관계 (차단한 사람 -> 차단당한 사람)
CREATE TABLE IF NOT EXISTS letsmeet_user_blocks (
  blocker_user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  blocked_user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id != blocked_user_id)
);

CREATE INDEX idx_letsmeet_user_blocks_blocker ON letsmeet_user_blocks(blocker_user_id);
