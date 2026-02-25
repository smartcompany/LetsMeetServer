-- Row Level Security (RLS) 활성화
-- 적용 후 Supabase 대시보드에서 테이블이 RESTRICTED로 표시됩니다.
-- 중요: API 서버는 반드시 service_role 키를 사용해야 합니다. (anon 키는 RLS에 의해 접근 불가)

ALTER TABLE letsmeet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE letsmeet_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE letsmeet_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE letsmeet_meeting_evaluations ENABLE ROW LEVEL SECURITY;

-- feeds 관련 테이블이 있으면 함께 활성화
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'letsmeet_feeds') THEN
    ALTER TABLE letsmeet_feeds ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'letsmeet_feed_likes') THEN
    ALTER TABLE letsmeet_feed_likes ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'letsmeet_feed_comments') THEN
    ALTER TABLE letsmeet_feed_comments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 정책이 없으면 모든 접근이 거부됩니다.
-- API는 service_role 키로 접속하면 RLS를 우회하므로 그대로 동작합니다.
-- (서버 환경변수에 SUPABASE_SERVICE_ROLE_KEY 설정 후 코드에서 해당 키 사용 필요)
