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
    const body = await request.json();
    
    // 카카오 로그인인 경우 kakao_id를 body에서 받음
    let uid: string;
    let kakaoId: string | undefined;
    
    if (body.kakao_id) {
      // 카카오 로그인: kakao_id로 UID 생성
      kakaoId = body.kakao_id;
      uid = `kakao:${kakaoId}`;
    } else {
      // 구글/애플 로그인: Firebase 토큰 검증
      const authUser = await verifyToken(request);
      if (!authUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      uid = authUser.firebaseUid;
    }

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
      .eq('user_id', uid)
      .single();

    let data;
    let isNewUser = false;
    
    if (findError || !existingUser) {
      // 사용자가 없으면 생성
      isNewUser = true;
      const userData: any = {
        user_id: uid,
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
        .eq('user_id', uid)
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

    // 카카오 로그인이고 새 사용자인 경우 Firebase 커스텀 토큰 생성
    if (kakaoId && isNewUser) {
      const { auth } = getFirebaseAdmin();
      
      // Firebase 사용자가 없으면 생성
      try {
        await auth.getUser(uid);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Firebase 사용자 생성 (커스텀 토큰 생성 시 자동 생성됨)
        }
      }
      
      // Firebase 커스텀 토큰 생성
      const customToken = await auth.createCustomToken(uid, {
        provider: 'kakao',
        kakaoId,
      });
      
      // 응답에 커스텀 토큰 포함
      return NextResponse.json({
        id: data.user_id,
        user_id: data.user_id,
        nickname: data.nickname,
        profile_image_url: data.profile_image_url,
        trust_score: data.trust_score,
        interests: data.interests,
        created_at: data.created_at,
        updated_at: data.updated_at,
        is_active: data.is_active,
        custom_token: customToken, // Firebase 커스텀 토큰 반환
      });
    }

    return NextResponse.json({
      id: data.user_id,
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
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

