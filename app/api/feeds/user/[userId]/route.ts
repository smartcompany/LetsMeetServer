import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const user = await verifyToken(request);

    const { data, error } = await supabase
      .from('letsmeet_feeds')
      .select(`
        *,
        author:letsmeet_users!author_id(full_name, profile_image_url)
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get user feeds error:', error);
      return NextResponse.json(
        { error: 'Failed to get user feeds' },
        { status: 500 }
      );
    }

    const feedsWithAuthorInfo = await Promise.all(
      (data || []).map(async (feed) => {
        let isLiked = false;
        if (user != null) {
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
          author_name: feed.author?.full_name || '알 수 없음',
          author_profile_image: feed.author?.profile_image_url || null,
          is_liked: isLiked,
        };
      })
    );

    return NextResponse.json(feedsWithAuthorInfo || []);
  } catch (error) {
    console.error('Get user feeds error:', error);
    return NextResponse.json(
      { error: 'Failed to get user feeds' },
      { status: 500 }
    );
  }
}
