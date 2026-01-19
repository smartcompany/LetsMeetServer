import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Firebase UID나 이메일로 사용자 찾기
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.userId)
      .single();

    // Supabase 사용자가 없으면 Firebase 정보로 생성
    if (error || !data) {
      // 이메일로 다시 시도
      if (authUser.email) {
        const emailResult = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .single();
        
        if (emailResult.data) {
          data = emailResult.data;
          error = null;
        } else {
          // 새 사용자 생성
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              phone_number: null,
              email: authUser.email,
              nickname: authUser.email?.split('@')[0] || '사용자',
              trust_score: 70,
              trust_level: 'stable',
              interests: [],
            })
            .select()
            .single();

          if (createError) {
            return NextResponse.json(
              { error: 'Failed to create user' },
              { status: 500 }
            );
          }
          data = newUser;
        }
      } else {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    if (error || !data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: data.id,
      phone_number: data.phone_number,
      nickname: data.nickname,
      profile_image_url: data.profile_image_url,
      trust_score: data.trust_score,
      trust_level: data.trust_level,
      interests: data.interests,
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_active: data.is_active,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.nickname) updateData.nickname = body.nickname;
    if (body.profile_image_url) updateData.profile_image_url = body.profile_image_url;
    if (body.interests) {
      if (body.interests.length > 3) {
        return NextResponse.json(
          { error: 'Maximum 3 interests allowed' },
          { status: 400 }
        );
      }
      updateData.interests = body.interests;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      phone_number: data.phone_number,
      nickname: data.nickname,
      profile_image_url: data.profile_image_url,
      trust_score: data.trust_score,
      trust_level: data.trust_level,
      interests: data.interests,
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_active: data.is_active,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

