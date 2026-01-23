-- Add answer1 and answer2 columns to letsmeet_applications table
ALTER TABLE letsmeet_applications
ADD COLUMN IF NOT EXISTS answer1 TEXT,
ADD COLUMN IF NOT EXISTS answer2 TEXT;
