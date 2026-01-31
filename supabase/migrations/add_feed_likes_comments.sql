-- Feed Likes table
CREATE TABLE letsmeet_feed_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID NOT NULL REFERENCES letsmeet_feeds(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feed_id, user_id)
);

CREATE INDEX idx_letsmeet_feed_likes_feed ON letsmeet_feed_likes(feed_id);
CREATE INDEX idx_letsmeet_feed_likes_user ON letsmeet_feed_likes(user_id);

-- Feed Comments table
CREATE TABLE letsmeet_feed_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID NOT NULL REFERENCES letsmeet_feeds(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES letsmeet_users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_letsmeet_feed_comments_feed ON letsmeet_feed_comments(feed_id);
CREATE INDEX idx_letsmeet_feed_comments_user ON letsmeet_feed_comments(user_id);
CREATE INDEX idx_letsmeet_feed_comments_created ON letsmeet_feed_comments(created_at);

-- Trigger for feed comments updated_at
CREATE TRIGGER update_letsmeet_feed_comments_updated_at BEFORE UPDATE ON letsmeet_feed_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update feed like_count and comment_count
CREATE OR REPLACE FUNCTION update_feed_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'letsmeet_feed_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE letsmeet_feeds SET like_count = like_count + 1 WHERE id = NEW.feed_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE letsmeet_feeds SET like_count = like_count - 1 WHERE id = OLD.feed_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'letsmeet_feed_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE letsmeet_feeds SET comment_count = comment_count + 1 WHERE id = NEW.feed_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE letsmeet_feeds SET comment_count = comment_count - 1 WHERE id = OLD.feed_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Triggers for feed counts
CREATE TRIGGER update_feed_like_count AFTER INSERT OR DELETE ON letsmeet_feed_likes
    FOR EACH ROW EXECUTE FUNCTION update_feed_counts();

CREATE TRIGGER update_feed_comment_count AFTER INSERT OR DELETE ON letsmeet_feed_comments
    FOR EACH ROW EXECUTE FUNCTION update_feed_counts();
