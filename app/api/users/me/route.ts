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

    // Supabase에서 사용자 찾기 (Firebase UID 또는 custom claims의 userId로)
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.userId)
      .single();

    // 사용자를 찾지 못했으면 Firebase UID로 kakao_id로 검색 시도
    if (error || !data) {
      const { auth } = getFirebaseAdmin();
      const firebaseUser = await auth.getUser(authUser.firebaseUid);
      const customClaims = firebaseUser.customClaims || {};
      const kakaoId = customClaims.kakaoId;
      
      if (kakaoId) {
        const { data: kakaoUser, error: kakaoError } = await supabase
          .from('users')
          .select('*')
          .eq('kakao_id', kakaoId)
          .single();
        
        if (kakaoUser) {
          data = kakaoUser;
          error = null;
        }
      }
    }

    // 사용자가 없으면 404 반환 (프로필 설정 완료 시 생성됨)
    if (error || !data) {
      return NextResponse.json(
        { error: 'User not found. Please complete profile setup.' },
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
      .from('users')
      .select('*')
      .eq('id', authUser.userId)
      .single();

    let data;
    
    if (findError || !existingUser) {
      // 사용자가 없으면 생성 (UUID 자동 생성)
      const userData: any = {
        nickname: body.nickname.trim(),
        interests: body.interests,
        trust_score: 70,
        trust_level: 'stable',
        phone_number: null,
      };

      if (body.profile_image_url) {
        userData.profile_image_url = body.profile_image_url;
      }

      if (kakaoId) {
        userData.kakao_id = kakaoId;
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
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
      
      // 생성된 UUID를 Firebase custom claims에 userId로 저장
      const { auth } = getFirebaseAdmin();
      await auth.setCustomUserClaims(authUser.firebaseUid, {
        ...customClaims,
        userId: newUser.id,
      });
      
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
        .from('users')
        .update(updateData)
        .eq('id', authUser.userId)
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
      id: data.id,
      phone_number: data.phone_number,
      kakao_id: data.kakao_id,
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

