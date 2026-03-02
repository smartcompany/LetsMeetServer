import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';
import { checkBannedWords } from '@/lib/validate-banned-words';
import { getBlockedUserIds } from '@/lib/user-blocks';

export async function GET(request: NextRequest) {
  try {
    // 피드 목록은 비로그인 사용자도 열람 가능 (공개 콘텐츠)
    const user = await verifyToken(request);

    const { data, error } = await supabase
      .from('letsmeet_feeds')
      .select(`
        *,
        author:letsmeet_users!author_id(full_name, profile_image_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get feeds error:', error);
      return NextResponse.json(
        { error: 'Failed to get feeds' },
        { status: 500 }
      );
    }

    let feeds = data || [];
    if (user) {
      const blockedIds = await getBlockedUserIds(user.firebaseUid);
      if (blockedIds.length > 0) {
        feeds = feeds.filter((f: { author_id: string }) => !blockedIds.includes(f.author_id));
      }
    }

    // 각 피드에 대해 현재 사용자의 좋아요 여부 확인 (로그인 시에만)
    const feedsWithAuthorInfo = await Promise.all(
      feeds.map(async (feed: { id: string; author?: { full_name?: string; profile_image_url?: string }; author_id?: string }) => {
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
    console.error('Get feeds error:', error);
    return NextResponse.json(
      { error: 'Failed to get feeds' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, image_urls } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const bannedWord = checkBannedWords(content);
    if (bannedWord) {
      return NextResponse.json(
        { error: `허용되지 않는 표현이 포함되어 있습니다: ${bannedWord}`, field: 'content' },
        { status: 400 }
      );
    }

    const { data: feedData, error: insertError } = await supabase
      .from('letsmeet_feeds')
      .insert({
        author_id: user.firebaseUid,
        content,
        image_urls: image_urls || [],
      })
      .select(`
        *,
        author:letsmeet_users!author_id(full_name, profile_image_url)
      `)
      .single();

    if (insertError) {
      console.error('Create feed error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create feed' },
        { status: 500 }
      );
    }

    const response = {
      ...feedData,
          author_name: feedData.author?.full_name || '알 수 없음',
      author_profile_image: feedData.author?.profile_image_url || null,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create feed error:', error);
    return NextResponse.json(
      { error: 'Failed to create feed' },
      { status: 500 }
    );
  }
}
