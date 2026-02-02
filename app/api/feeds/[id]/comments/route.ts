import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(
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

    const { data, error } = await supabase
      .from('letsmeet_feed_comments')
      .select(`
        *,
        user:letsmeet_users!user_id(full_name, profile_image_url)
      `)
      .eq('feed_id', feedId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get comments error:', error);
      return NextResponse.json(
        { error: 'Failed to get comments' },
        { status: 500 }
      );
    }

    const commentsWithUserInfo = data?.map(comment => ({
      ...comment,
      user_name: comment.user?.full_name || '알 수 없음',
      user_profile_image: comment.user?.profile_image_url || null,
    }));

    return NextResponse.json(commentsWithUserInfo || []);
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Failed to get comments' },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const { data: commentData, error: insertError } = await supabase
      .from('letsmeet_feed_comments')
      .insert({
        feed_id: feedId,
        user_id: user.firebaseUid,
        content: content.trim(),
      })
      .select(`
        *,
        user:letsmeet_users!user_id(full_name, profile_image_url)
      `)
      .single();

    if (insertError) {
      console.error('Create comment error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    const response = {
      ...commentData,
      user_name: commentData.user?.full_name || '알 수 없음',
      user_profile_image: commentData.user?.profile_image_url || null,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
