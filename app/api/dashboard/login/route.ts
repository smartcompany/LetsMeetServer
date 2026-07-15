import { NextRequest, NextResponse } from 'next/server';
import {
  createDashboardToken,
  getDashboardCookieConfig,
  isDashboardEmailAllowed,
} from '@/lib/dashboard-auth';
import { getFirebaseAdmin } from '@/lib/firebase/admin';

/**
 * POST /api/dashboard/login
 * Body: { idToken } — Firebase Google Sign-In ID token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = typeof body.idToken === 'string' ? body.idToken : '';

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const { auth } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(idToken);
    const email = decoded.email ?? null;

    if (!decoded.email_verified) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
    }

    if (!isDashboardEmailAllowed(email)) {
      return NextResponse.json(
        { error: '허용되지 않은 계정입니다.' },
        { status: 403 }
      );
    }

    const token = createDashboardToken(email ?? undefined);
    const { name, options } = getDashboardCookieConfig();
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(name, token, options);
    return res;
  } catch (e) {
    console.error('[dashboard login]', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
