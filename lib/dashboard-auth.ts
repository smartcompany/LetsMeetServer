import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

const COOKIE_NAME = 'dashboard_token';
const SECRET = process.env.DASHBOARD_SECRET || 'dashboard-dev-secret-change-in-production';

export type DashboardPayload = { dashboard: true };

export function createDashboardToken(): string {
  return jwt.sign(
    { dashboard: true } as DashboardPayload,
    SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyDashboardToken(token: string): DashboardPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as DashboardPayload;
    return decoded?.dashboard ? decoded : null;
  } catch {
    return null;
  }
}

export function getDashboardToken(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

export function verifyDashboardRequest(request: NextRequest): boolean {
  const token = getDashboardToken(request);
  if (!token) return false;
  return verifyDashboardToken(token) !== null;
}

export function getDashboardCookieConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    },
  };
}
