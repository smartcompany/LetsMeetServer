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

export type BlockedUserInfo = {
  user_id: string;
  full_name: string | null;
  profile_image_url: string | null;
};

/**
 * 현재 사용자가 차단한 사용자 목록 (이름·프로필 이미지 포함)
 */
export async function getBlockedUsers(blockerUserId: string): Promise<BlockedUserInfo[]> {
  const { data: blocks, error: blocksError } = await supabase
    .from('letsmeet_user_blocks')
    .select('blocked_user_id')
    .eq('blocker_user_id', blockerUserId);
  if (blocksError || !blocks?.length) return [];

  const ids = blocks.map((r: { blocked_user_id: string }) => r.blocked_user_id);
  const { data: users, error: usersError } = await supabase
    .from('letsmeet_users')
    .select('user_id, full_name, profile_image_url')
    .in('user_id', ids);
  if (usersError || !users?.length) {
    return ids.map((id) => ({ user_id: id, full_name: null, profile_image_url: null }));
  }
  const userMap = new Map(users.map((u: { user_id: string; full_name?: string | null; profile_image_url?: string | null }) => [u.user_id, u]));
  return ids.map((id) => {
    const u = userMap.get(id);
    return {
      user_id: id,
      full_name: u?.full_name ?? null,
      profile_image_url: u?.profile_image_url ?? null,
    };
  });
}
