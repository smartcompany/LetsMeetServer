import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function optionsResponse(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export function jsonResponse(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
) {
  const origin = request.headers.get('origin');
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return NextResponse.json(body, { ...init, headers });
}
