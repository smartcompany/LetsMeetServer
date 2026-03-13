-- RLS 활성화: letsmeet_user_blocks, letsmeet_reports
-- API 서버는 service_role 키로 접속하므로 RLS를 우회해 그대로 동작합니다.

ALTER TABLE letsmeet_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE letsmeet_reports ENABLE ROW LEVEL SECURITY;
