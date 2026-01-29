-- Feeds table
CREATE TABLE letsmeet_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_feeds_author ON letsmeet_feeds(author_id);
CREATE INDEX idx_letsmeet_feeds_created ON letsmeet_feeds(created_at);

-- Trigger for feeds table
CREATE TRIGGER update_letsmeet_feeds_updated_at BEFORE UPDATE ON letsmeet_feeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
