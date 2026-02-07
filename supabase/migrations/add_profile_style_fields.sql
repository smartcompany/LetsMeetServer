-- Replace interests with profile style fields
-- life_scene_id, self_statement_id: required for profile
-- interaction_style_id: required for profile

ALTER TABLE letsmeet_users
ADD COLUMN IF NOT EXISTS life_scene_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS self_statement_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS interaction_style_id VARCHAR(50);

-- Drop interests column and index (run after data migration if needed)
-- For fresh installs, schema.sql has interests - we'll update schema.sql
-- For existing DBs: optionally migrate interests -> default style, then drop
ALTER TABLE letsmeet_users DROP COLUMN IF EXISTS interests;
DROP INDEX IF EXISTS idx_letsmeet_users_interests;
