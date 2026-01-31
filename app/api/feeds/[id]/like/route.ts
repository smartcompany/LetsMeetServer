import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: feedId } = await params;

    // 이미 좋아요를 눌렀는지 확인
    const { data: existingLike } = await supabase
      .from('letsmeet_feed_likes')
      .select('id')
      .eq('feed_id', feedId)
      .eq('user_id', user.firebaseUid)
      .maybeSingle();

    if (existingLike) {
      // 좋아요 취소
      const { error: deleteError } = await supabase
        .from('letsmeet_feed_likes')
        .delete()
        .eq('feed_id', feedId)
        .eq('user_id', user.firebaseUid);

      if (deleteError) {
        console.error('Unlike error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to unlike' },
          { status: 500 }
        );
      }

      return NextResponse.json({ liked: false });
    } else {
      // 좋아요 추가
      const { error: insertError } = await supabase
        .from('letsmeet_feed_likes')
        .insert({
          feed_id: feedId,
          user_id: user.firebaseUid,
        });

      if (insertError) {
        console.error('Like error:', insertError);
        return NextResponse.json(
          { error: 'Failed to like' },
          { status: 500 }
        );
      }

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
