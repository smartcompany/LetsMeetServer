import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

const COOKIE_NAME = 'dashboard_token';
const SECRET = process.env.DASHBOARD_SECRET || 'dashboard-dev-secret-change-in-production';

export type DashboardPayload = {
  dashboard: true;
  email?: string;
};

/** 대시보드 접근 허용 Google 계정 */
const ALLOWED_DASHBOARD_EMAILS = ['gunnylove@gmail.com'];

export function getAllowedDashboardEmails(): string[] {
  return ALLOWED_DASHBOARD_EMAILS;
}

export function isDashboardEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAllowedDashboardEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function createDashboardToken(email?: string): string {
  const payload: DashboardPayload = { dashboard: true };
  if (email) payload.email = email.toLowerCase();
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
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
