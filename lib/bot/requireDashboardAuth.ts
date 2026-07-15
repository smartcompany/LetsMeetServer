import { NextRequest, NextResponse } from 'next/server';
import { verifyDashboardRequest } from '@/lib/dashboard-auth';

/** 대시보드 인증 실패 시 401 Response, 성공 시 null */
export function requireDashboardAuth(request: NextRequest): NextResponse | null {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
