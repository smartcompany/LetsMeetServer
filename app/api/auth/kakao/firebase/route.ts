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

    // Firebase 커스텀 토큰 생성 (FaceReader 방식)
    // Note: Supabase 사용자는 프로필 설정 완료 시 생성됨
    console.log('🔵 [Kakao Firebase Login] Firebase Admin SDK 가져오기...');
    const { auth } = getFirebaseAdmin();
    console.log('✅ [Kakao Firebase Login] Firebase Admin SDK 가져오기 성공');
    
    const uid = `kakao:${kakaoId}`;
    console.log('🔵 [Kakao Firebase Login] Firebase Custom Token 생성 시작 - UID:', uid);
    
    // 커스텀 토큰 생성 (Firebase가 사용자를 자동으로 생성함)
    const customToken = await auth.createCustomToken(uid, {
      provider: 'kakao',
      kakaoId,
    });
    
    console.log('✅ [Kakao Firebase Login] Firebase Custom Token 생성 성공');

    return NextResponse.json({
      custom_token: customToken,
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
