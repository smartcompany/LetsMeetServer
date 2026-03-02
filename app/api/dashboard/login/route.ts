import { NextRequest, NextResponse } from 'next/server';
import { createDashboardToken, getDashboardCookieConfig } from '@/lib/dashboard-auth';

/**
 * POST /api/dashboard/login
 * Body: { username, password }
 * env: DASHBOARD_USERNAME, DASHBOARD_PASSWORD, DASHBOARD_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username ?? '';
    const password = body.password ?? '';

    const expectedUser = process.env.DASHBOARD_USERNAME || '';
    const expectedPass = process.env.DASHBOARD_PASSWORD || '';

    if (!expectedUser || !expectedPass) {
      return NextResponse.json(
        { error: 'Dashboard login not configured' },
        { status: 503 }
      );
    }

    if (username !== expectedUser || password !== expectedPass) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const token = createDashboardToken();
    const { name, options } = getDashboardCookieConfig();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(name, token, options);
    return res;
  } catch (e) {
    console.error('[dashboard login]', e);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
