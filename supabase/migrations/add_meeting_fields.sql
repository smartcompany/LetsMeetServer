-- Add additional fields to letsmeet_meetings table for meeting creation
-- This migration adds new fields required for the meeting creation feature

-- Add category column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'category'
  ) THEN
    ALTER TABLE letsmeet_meetings ADD COLUMN category VARCHAR(50);
  END IF;
END $$;

-- Add participation_fee column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'participation_fee'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    ADD COLUMN participation_fee INTEGER DEFAULT 0 CHECK (participation_fee >= 0);
  END IF;
END $$;

-- Add gender_restriction column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'gender_restriction'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    ADD COLUMN gender_restriction VARCHAR(20) DEFAULT 'all' 
    CHECK (gender_restriction IN ('all', 'male', 'female'));
  END IF;
END $$;

-- Add age_range_min column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'age_range_min'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    ADD COLUMN age_range_min INTEGER CHECK (age_range_min IS NULL OR age_range_min >= 0);
  END IF;
END $$;

-- Add age_range_max column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'age_range_max'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    ADD COLUMN age_range_max INTEGER CHECK (age_range_max IS NULL OR age_range_max >= 0);
  END IF;
END $$;

-- Add approval_type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letsmeet_meetings' AND column_name = 'approval_type'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    ADD COLUMN approval_type VARCHAR(20) DEFAULT 'immediate' 
    CHECK (approval_type IN ('immediate', 'approval_required'));
  END IF;
END $$;

-- Update max_participants constraint to allow 2-20 (was 3-6)
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'letsmeet_meetings_max_participants_check'
  ) THEN
    ALTER TABLE letsmeet_meetings 
    DROP CONSTRAINT letsmeet_meetings_max_participants_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE letsmeet_meetings
  ADD CONSTRAINT letsmeet_meetings_max_participants_check 
  CHECK (max_participants >= 2 AND max_participants <= 20);
END $$;
