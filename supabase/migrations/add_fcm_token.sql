-- FCM 토큰 저장 (푸시 알림용)
ALTER TABLE letsmeet_users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
