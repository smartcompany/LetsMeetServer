-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (user_id = Firebase UID as primary key)
CREATE TABLE letsmeet_users (
  user_id VARCHAR(128) PRIMARY KEY, -- Firebase UID (e.g., kakao:4708212300)
  nickname VARCHAR(50) NOT NULL,
  profile_image_url TEXT,
  trust_score INTEGER DEFAULT 70 CHECK (trust_score >= 0 AND trust_score <= 100),
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_letsmeet_users_trust_score ON letsmeet_users(trust_score);
CREATE INDEX idx_letsmeet_users_interests ON letsmeet_users USING GIN(interests);

-- Meetings table
CREATE TABLE letsmeet_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  meeting_date TIMESTAMP NOT NULL,
  location VARCHAR(200) NOT NULL,
  location_detail TEXT,
  max_participants INTEGER NOT NULL CHECK (max_participants >= 3 AND max_participants <= 6),
  interests TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_meetings_host ON letsmeet_meetings(host_id);
CREATE INDEX idx_letsmeet_meetings_date ON letsmeet_meetings(meeting_date);
CREATE INDEX idx_letsmeet_meetings_status ON letsmeet_meetings(status);
CREATE INDEX idx_letsmeet_meetings_interests ON letsmeet_meetings USING GIN(interests);

-- Applications table
CREATE TABLE letsmeet_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES letsmeet_meetings(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_letsmeet_applications_meeting ON letsmeet_applications(meeting_id);
CREATE INDEX idx_letsmeet_applications_user ON letsmeet_applications(user_id);
CREATE INDEX idx_letsmeet_applications_status ON letsmeet_applications(status);

-- Attendance table
CREATE TABLE letsmeet_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES letsmeet_meetings(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('attended', 'no_show', 'cancelled')),
  cancelled_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_letsmeet_attendance_meeting ON letsmeet_attendance(meeting_id);
CREATE INDEX idx_letsmeet_attendance_user ON letsmeet_attendance(user_id);
CREATE INDEX idx_letsmeet_attendance_status ON letsmeet_attendance(status);

-- Chats table
CREATE TABLE letsmeet_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES letsmeet_meetings(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_chats_meeting ON letsmeet_chats(meeting_id);
CREATE INDEX idx_letsmeet_chats_created ON letsmeet_chats(created_at);

-- User Score History table
CREATE TABLE letsmeet_user_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  score_change INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL CHECK (reason IN ('attendance', 'no_show', 'late_cancel', 'host_experience', 'time_recovery', 'positive_action')),
  related_meeting_id UUID REFERENCES letsmeet_meetings(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_score_history_user ON letsmeet_user_score_history(user_id);
CREATE INDEX idx_letsmeet_score_history_created ON letsmeet_user_score_history(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_letsmeet_users_updated_at BEFORE UPDATE ON letsmeet_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for meetings table
CREATE TRIGGER update_letsmeet_meetings_updated_at BEFORE UPDATE ON letsmeet_meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

