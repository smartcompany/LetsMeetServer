-- Add application_questions column to letsmeet_meetings table
-- 참여 신청 전 답변을 요청하는 질문 목록 (TEXT 배열)
ALTER TABLE letsmeet_meetings
ADD COLUMN IF NOT EXISTS application_questions TEXT[] DEFAULT '{}';
