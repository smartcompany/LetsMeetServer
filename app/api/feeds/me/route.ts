import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('letsmeet_feeds')
      .select(`
        *,
        author:letsmeet_users!author_id(nickname, profile_image_url)
      `)
      .eq('author_id', user.firebaseUid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get my feeds error:', error);
      return NextResponse.json(
        { error: 'Failed to get my feeds' },
        { status: 500 }
      );
    }

    // 각 피드에 대해 현재 사용자의 좋아요 여부 확인
    const feedsWithAuthorInfo = await Promise.all(
      (data || []).map(async (feed) => {
        let isLiked = false;
        if (user) {
          const { data: likeData } = await supabase
            .from('letsmeet_feed_likes')
            .select('id')
            .eq('feed_id', feed.id)
            .eq('user_id', user.firebaseUid)
            .maybeSingle();
          isLiked = !!likeData;
        }

        return {
          ...feed,
          author_nickname: feed.author?.nickname || '알 수 없음',
          author_profile_image: feed.author?.profile_image_url || null,
          is_liked: isLiked,
        };
      })
    );

    return NextResponse.json(feedsWithAuthorInfo || []);
  } catch (error) {
    console.error('Get my feeds error:', error);
    return NextResponse.json(
      { error: 'Failed to get my feeds' },
      { status: 500 }
    );
  }
}
