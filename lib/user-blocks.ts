import { supabase } from '@/lib/db/supabase';

/**
 * 현재 사용자가 차단한 user_id 목록 반환 (빈 배열 가능)
 */
export async function getBlockedUserIds(blockerUserId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('letsmeet_user_blocks')
    .select('blocked_user_id')
    .eq('blocker_user_id', blockerUserId);
  if (error) return [];
  return (data || []).map((r: { blocked_user_id: string }) => r.blocked_user_id);
}
