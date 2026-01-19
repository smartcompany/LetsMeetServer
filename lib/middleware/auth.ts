import { NextRequest } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

export interface AuthUser {
  userId: string;
  firebaseUid: string;
  email?: string;
}

export async function verifyToken(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.substring(7);
    const { auth } = getFirebaseAdmin();
    
    // Firebase ID 토큰 검증
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // 커스텀 클레임에서 userId 가져오기 (없으면 Firebase UID 사용)
    const userId = decodedToken.uid;
    const customClaims = decodedToken.custom_claims || {};
    const supabaseUserId = customClaims.userId;

    return {
      userId: supabaseUserId || userId,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
