import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * POST /api/users/[id]/block
 * 현재 사용자가 [id] 사용자를 차단. DB에 저장.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: blockedUserId } = await params;
    if (!blockedUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (blockedUserId === user.firebaseUid) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('letsmeet_user_blocks')
      .upsert(
        {
          blocker_user_id: user.firebaseUid,
          blocked_user_id: blockedUserId,
        },
        { onConflict: 'blocker_user_id,blocked_user_id' }
      );

    if (error) {
      console.error('[block user]', error);
      return NextResponse.json(
        { error: 'Failed to block user' },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('[block user]', e);
    return NextResponse.json(
      { error: 'Failed to block user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]/block
 * 현재 사용자가 [id] 사용자 차단 해제.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: blockedUserId } = await params;
    if (!blockedUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('letsmeet_user_blocks')
      .delete()
      .eq('blocker_user_id', user.firebaseUid)
      .eq('blocked_user_id', blockedUserId);

    if (error) {
      console.error('[unblock user]', error);
      return NextResponse.json(
        { error: 'Failed to unblock user' },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('[unblock user]', e);
    return NextResponse.json(
      { error: 'Failed to unblock user' },
      { status: 500 }
    );
  }
}
