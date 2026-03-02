import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { getBlockedUserIds } from '@/lib/user-blocks';

/**
 * GET /api/users/me/blocked-ids
 * 현재 사용자가 차단한 user_id 목록 반환
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ids = await getBlockedUserIds(user.firebaseUid);
    return NextResponse.json({ blocked_user_ids: ids });
  } catch (e) {
    console.error('[blocked-ids]', e);
    return NextResponse.json(
      { error: 'Failed to get blocked list' },
      { status: 500 }
    );
  }
}
