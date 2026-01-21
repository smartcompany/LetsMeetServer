import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Supabase에서 사용자 찾기 (Firebase UID를 user_id로 사용)
    let { data, error } = await supabase
      .from('letsmeet_users')
      .select('*')
      .eq('user_id', authUser.firebaseUid)
      .single();

    // 사용자가 없으면 404 반환 (프로필 설정 완료 시 생성됨)
    if (error || !data) {
      return NextResponse.json(
        { error: 'User not found. Please complete profile setup.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: data.user_id, // user_id를 id로 반환 (클라이언트 호환성)
      user_id: data.user_id,
      nickname: data.nickname,
      profile_image_url: data.profile_image_url,
      trust_score: data.trust_score,
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
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Firebase custom claims에서 kakaoId 가져오기
    const { auth } = getFirebaseAdmin();
    const firebaseUser = await auth.getUser(authUser.firebaseUid);
    const customClaims = firebaseUser.customClaims || {};
    const kakaoId = customClaims.kakaoId;

    // 필수 필드 검증
    if (!body.nickname || body.nickname.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nickname is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!body.interests || body.interests.length === 0) {
      return NextResponse.json(
        { error: 'At least one interest is required' },
        { status: 400 }
      );
    }

    if (body.interests.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 interests allowed' },
        { status: 400 }
      );
    }

    // 기존 사용자 확인
    let { data: existingUser, error: findError } = await supabase
      .from('letsmeet_users')
      .select('*')
      .eq('user_id', authUser.firebaseUid)
      .single();

    let data;
    
    if (findError || !existingUser) {
      // 사용자가 없으면 생성 (Firebase UID를 user_id로 사용)
      const userData: any = {
        user_id: authUser.firebaseUid, // Firebase UID를 user_id로 사용
        nickname: body.nickname.trim(),
        interests: body.interests,
        trust_score: 70,
      };

      if (body.profile_image_url) {
        userData.profile_image_url = body.profile_image_url;
      }

      const { data: newUser, error: createError } = await supabase
        .from('letsmeet_users')
        .insert(userData)
        .select()
        .single();

      if (createError) {
        console.error('Create user error:', createError);
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        );
      }
      
      data = newUser;
    } else {
      // 사용자가 있으면 업데이트
      const updateData: any = {
        nickname: body.nickname.trim(),
        interests: body.interests,
      };

      if (body.profile_image_url) {
        updateData.profile_image_url = body.profile_image_url;
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('letsmeet_users')
        .update(updateData)
        .eq('user_id', authUser.firebaseUid)
        .select()
        .single();

      if (updateError) {
        console.error('Update user error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update user profile' },
          { status: 500 }
        );
      }
      
      data = updatedUser;
    }

    const error = null;


    return NextResponse.json({
      id: data.user_id,
      user_id: data.user_id,
      phone_number: data.phone_number,
      nickname: data.nickname,
      profile_image_url: data.profile_image_url,
      trust_score: data.trust_score,
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

