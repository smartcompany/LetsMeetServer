import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function PUT(
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
    const { content, image_urls } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // 피드 소유자 확인
    const { data: existingFeed } = await supabase
      .from('letsmeet_feeds')
      .select('author_id')
      .eq('id', feedId)
      .single();

    if (!existingFeed) {
      return NextResponse.json(
        { error: 'Feed not found' },
        { status: 404 }
      );
    }

    if (existingFeed.author_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { data: feedData, error: updateError } = await supabase
      .from('letsmeet_feeds')
      .update({
        content,
        image_urls: image_urls || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', feedId)
      .select(`
        *,
        author:letsmeet_users!author_id(full_name, profile_image_url)
      `)
      .single();

    if (updateError) {
      console.error('Update feed error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update feed' },
        { status: 500 }
      );
    }

    const response = {
      ...feedData,
      author_name: feedData.author?.full_name || '알 수 없음',
      author_profile_image: feedData.author?.profile_image_url || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update feed error:', error);
    return NextResponse.json(
      { error: 'Failed to update feed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // 피드 소유자 확인
    const { data: existingFeed } = await supabase
      .from('letsmeet_feeds')
      .select('author_id')
      .eq('id', feedId)
      .single();

    if (!existingFeed) {
      return NextResponse.json(
        { error: 'Feed not found' },
        { status: 404 }
      );
    }

    if (existingFeed.author_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from('letsmeet_feeds')
      .delete()
      .eq('id', feedId);

    if (deleteError) {
      console.error('Delete feed error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete feed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Delete feed error:', error);
    return NextResponse.json(
      { error: 'Failed to delete feed' },
      { status: 500 }
    );
  }
}
