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

    // 작성자 정보를 평탄화하여 반환
    const feedsWithAuthorInfo = data?.map(feed => ({
      ...feed,
      author_nickname: feed.author?.nickname || '알 수 없음',
      author_profile_image: feed.author?.profile_image_url || null,
    }));

    return NextResponse.json(feedsWithAuthorInfo || []);
  } catch (error) {
    console.error('Get my feeds error:', error);
    return NextResponse.json(
      { error: 'Failed to get my feeds' },
      { status: 500 }
    );
  }
}
