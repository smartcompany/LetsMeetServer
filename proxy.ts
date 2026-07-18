import { NextRequest, NextResponse } from 'next/server';

import { pickStoreUrl } from '@/lib/applink';

/**
 * /applink는 기기별 앱 스토어로 보내고,
 * API 요청에는 Flutter 웹 등을 위한 CORS 헤더를 추가합니다.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/applink') {
    const userAgent = request.headers.get('user-agent') ?? '';
    const response = NextResponse.redirect(pickStoreUrl(userAgent), 302);
    // CDN/공유 캐시가 기기별 리다이렉트를 섞지 않도록
    response.headers.set('Vary', 'User-Agent');
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  // API 라우트에만 CORS 적용
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // OPTIONS preflight 요청 처리
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  // Dart http 패키지: charset 없으면 latin1 → 한글/이모지 깨짐 방지
  response.headers.set('Content-Type', 'application/json; charset=utf-8');
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/applink'],
};
