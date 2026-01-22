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
    const uid = `kakao:${kakaoId}`;

    // Supabase에서 사용자 프로필 확인
    const { data: existingUser, error: findError } = await supabase
      .from('letsmeet_users')
      .select('*')
      .eq('user_id', uid)
      .single();

    // 프로필이 이미 있으면 Firebase 커스텀 토큰 생성
    if (!findError && existingUser) {
      const { auth } = getFirebaseAdmin();
      
      // Firebase 커스텀 토큰 생성 (사용자가 없으면 자동 생성됨)
      const customToken = await auth.createCustomToken(uid, {
        provider: 'kakao',
        kakaoId,
      });
      
      console.log('✅ [Kakao Login] 기존 사용자 - Firebase 커스텀 토큰 생성');
      
      return NextResponse.json({
        uid: uid,
        kakao_id: kakaoId,
        custom_token: customToken, // 프로필이 있으면 커스텀 토큰 반환
      });
    }

    // 프로필이 없으면 UID와 kakao_id만 반환 (프로필 설정 완료 시 커스텀 토큰 생성)
    console.log('✅ [Kakao Login] 신규 사용자 - UID만 반환');
    
    return NextResponse.json({
      uid: uid,
      kakao_id: kakaoId,
    });
  } catch (error) {
    console.error('❌ [Kakao Firebase Login] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Error';
    
    console.error('❌ [Kakao Firebase Login] Error details:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
    });
    
    // Firebase Admin 관련 에러인지 확인
    if (errorMessage.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || 
        errorMessage.includes('credential') ||
        errorMessage.includes('permission')) {
      return NextResponse.json(
        { error: 'Firebase configuration error. Please check FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: `Failed to login with Kakao: ${errorMessage}` },
      { status: 500 }
    );
  }
}
