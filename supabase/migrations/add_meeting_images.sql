-- Add image_urls column to letsmeet_meetings table
ALTER TABLE letsmeet_meetings
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
