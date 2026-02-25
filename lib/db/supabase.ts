import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
/** 서버 전용. RLS 적용 시 DB 접근에 필수. 클라이언트에 노출 금지 */
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
/** anon 키. 클라이언트용. 서버에서는 service_role 없을 때만 fallback */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

// RLS 사용 시 서버는 반드시 SUPABASE_SERVICE_ROLE_KEY 사용 (anon은 정책에 막힘)
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: { persistSession: false },
});

