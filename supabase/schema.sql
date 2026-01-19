-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  profile_image_url TEXT,
  trust_score INTEGER DEFAULT 70 CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_level VARCHAR(10) DEFAULT 'stable' CHECK (trust_level IN ('trust', 'stable', 'caution', 'restricted')),
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_trust_score ON users(trust_score);
CREATE INDEX idx_users_interests ON users USING GIN(interests);

-- Meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_meetings_host ON meetings(host_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_interests ON meetings USING GIN(interests);

-- Applications table
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  applied_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_applications_meeting ON applications(meeting_id);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('attended', 'no_show', 'cancelled')),
  cancelled_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_attendance_meeting ON attendance(meeting_id);
CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_status ON attendance(status);

-- Chats table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chats_meeting ON chats(meeting_id);
CREATE INDEX idx_chats_created ON chats(created_at);

-- User Score History table
CREATE TABLE user_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_change INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL CHECK (reason IN ('attendance', 'no_show', 'late_cancel', 'host_experience', 'time_recovery', 'positive_action')),
  related_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_score_history_user ON user_score_history(user_id);
CREATE INDEX idx_score_history_created ON user_score_history(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for meetings table
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

