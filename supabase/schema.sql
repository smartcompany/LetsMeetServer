-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (user_id = Firebase UID as primary key)
CREATE TABLE letsmeet_users (
  user_id VARCHAR(128) PRIMARY KEY, -- Firebase UID (e.g., kakao:4708212300)
  full_name VARCHAR(100) NOT NULL,
  profile_image_url TEXT,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  bio TEXT,
  background_image_url TEXT,
  trust_score INTEGER DEFAULT 70 CHECK (trust_score >= 0 AND trust_score <= 100),
  life_scene_id VARCHAR(50),
  self_statement_id VARCHAR(50),
  interaction_style_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_letsmeet_users_trust_score ON letsmeet_users(trust_score);
--
 Meetings table
CREATE TABLE letsmeet_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  meeting_date TIMESTAMP NOT NULL,
  location VARCHAR(200) NOT NULL,
  location_detail TEXT,
  max_participants INTEGER NOT NULL CHECK (max_participants >= 2 AND max_participants <= 20),
  interests TEXT[] NOT NULL DEFAULT '{}',
  category VARCHAR(50),
  participation_fee INTEGER DEFAULT 0 CHECK (participation_fee >= 0),
  gender_restriction VARCHAR(20) DEFAULT 'all' CHECK (gender_restriction IN ('all', 'male', 'female')),
  age_range_min INTEGER CHECK (age_range_min IS NULL OR age_range_min >= 0),
  age_range_max INTEGER CHECK (age_range_max IS NULL OR age_range_max >= 0),
  approval_type VARCHAR(20) DEFAULT 'immediate' CHECK (approval_type IN ('immediate', 'approval_required')),
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

