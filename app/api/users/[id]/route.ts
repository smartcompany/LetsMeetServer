import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * 다른 사용자의 공개 프로필 조회
 * 프로필 상세 페이지 및 채팅 등에서 사용
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('letsmeet_users')
      .select(
        'user_id, full_name, profile_image_url, background_image_url, gender, bio, trust_score, interests, created_at, updated_at, is_active'
      )
      .eq('user_id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.user_id,
      user_id: data.user_id,
      full_name: data.full_name || '',
      profile_image_url: data.profile_image_url || null,
      background_image_url: data.background_image_url || null,
      gender: data.gender || null,
      bio: data.bio || null,
      trust_score: data.trust_score ?? 0,
      interests: data.interests ?? [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_active: data.is_active ?? true,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    );
  }
}
