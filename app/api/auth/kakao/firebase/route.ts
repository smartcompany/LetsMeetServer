import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { supabase } from '@/lib/db/supabase';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json();

    if (!access_token) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // 카카오 API로 사용자 정보 가져오기
    const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!kakaoResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid Kakao access token' },
        { status: 401 }
      );
    }

    const kakaoUser = await kakaoResponse.json();
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email;
    const nickname = kakaoUser.kakao_account?.profile?.nickname || `카카오${kakaoId.slice(-4)}`;

    // Check if user exists by kakao_id or create new user in Supabase
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (!user) {
      // Create new user in Supabase (only store kakao_id, minimal info)
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          kakao_id: kakaoId,
          phone_number: null,
          nickname, // Only for initial display, user can change later
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

      user = newUser;
    }

    // Firebase 커스텀 토큰 생성
    const { auth } = getFirebaseAdmin();
    const firebaseUid = `kakao:${kakaoId}`;
    
    // Firebase 사용자가 없으면 생성
    try {
      await auth.getUser(firebaseUid);
    } catch {
      // 사용자가 없으면 생성
      await auth.createUser({
        uid: firebaseUid,
        email: email || undefined,
        displayName: nickname,
      });
    }

    // 커스텀 토큰 생성
    const customToken = await auth.createCustomToken(firebaseUid, {
      userId: user.id,
      kakaoId,
    });

    return NextResponse.json({
      custom_token: customToken,
    });
  } catch (error) {
    console.error('Kakao Firebase login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: `Failed to login with Kakao: ${errorMessage}` },
      { status: 500 }
    );
  }
}
