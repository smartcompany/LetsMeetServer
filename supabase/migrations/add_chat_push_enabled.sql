-- 채팅 푸시 알림 on/off 설정
ALTER TABLE letsmeet_users ADD COLUMN IF NOT EXISTS chat_push_enabled BOOLEAN DEFAULT true;
