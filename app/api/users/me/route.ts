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
      full_name: data.full_name,
      profile_image_url: data.profile_image_url,
      gender: data.gender,
      bio: data.bio,
      background_image_url: data.background_image_url,
      trust_score: data.trust_score,
      life_scene_id: data.life_scene_id,
      self_statement_id: data.self_statement_id,
      interaction_style_id: data.interaction_style_id,
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
    if (!body.full_name || body.full_name.trim().length < 2) {
      return NextResponse.json(
        { error: '이름은 2자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!body.life_scene_id || !body.interaction_style_id) {
      return NextResponse.json(
        { error: '좋아하는 시간과 같이 있으면은 필수입니다.' },
        { status: 400 }
      );
    }

    // gender 값 검증 (male / female 만 허용, 없으면 생략)
    if (body.gender && body.gender !== 'male' && body.gender !== 'female') {
      return NextResponse.json(
        { error: 'Invalid gender value' },
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
        full_name: body.full_name.trim(),
        life_scene_id: body.life_scene_id,
        self_statement_id: body.self_statement_id ?? null,
        interaction_style_id: body.interaction_style_id,
        trust_score: 70,
      };

      if (body.profile_image_url) {
        userData.profile_image_url = body.profile_image_url;
      }
      if (body.gender) {
        userData.gender = body.gender;
      }
      if (body.bio) {
        userData.bio = body.bio;
      }
      if (body.background_image_url) {
        userData.background_image_url = body.background_image_url;
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
        full_name: body.full_name.trim(),
        life_scene_id: body.life_scene_id,
        self_statement_id: body.self_statement_id ?? null,
        interaction_style_id: body.interaction_style_id,
      };

      if (body.profile_image_url !== undefined) {
        updateData.profile_image_url = body.profile_image_url;
      }
      if (body.gender !== undefined) {
        updateData.gender = body.gender;
      }
      if (body.bio !== undefined) {
        updateData.bio = body.bio;
      }
      if (body.background_image_url !== undefined) {
        updateData.background_image_url = body.background_image_url;
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
        full_name: data.full_name,
        profile_image_url: data.profile_image_url,
        gender: data.gender,
        bio: data.bio,
        background_image_url: data.background_image_url,
        trust_score: data.trust_score,
        life_scene_id: data.life_scene_id,
        self_statement_id: data.self_statement_id,
        interaction_style_id: data.interaction_style_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        is_active: data.is_active,
        custom_token: customToken, // Firebase 커스텀 토큰 반환
      });
    }

    return NextResponse.json({
      id: data.user_id,
      user_id: data.user_id,
      full_name: data.full_name,
      profile_image_url: data.profile_image_url,
      gender: data.gender,
      bio: data.bio,
      background_image_url: data.background_image_url,
      trust_score: data.trust_score,
      life_scene_id: data.life_scene_id,
      self_statement_id: data.self_statement_id,
      interaction_style_id: data.interaction_style_id,
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

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const uid = authUser.firebaseUid;

    const { error } = await supabase
      .from('letsmeet_users')
      .delete()
      .eq('user_id', uid);

    if (error) {
      console.error('Delete user error:', error);
      return NextResponse.json(
        { error: '계정 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Firebase Auth 계정도 서버에서 함께 삭제 (가능한 경우)
    try {
      const { auth } = getFirebaseAdmin();
      await auth.deleteUser(uid);
    } catch (firebaseError) {
      // 이미 삭제되었거나 권한 문제 등으로 실패할 수 있으므로, 서버 계정 삭제는 성공으로 간주
      console.error('Firebase delete user error:', firebaseError);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: '계정 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

