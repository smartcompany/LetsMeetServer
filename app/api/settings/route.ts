import { NextResponse } from 'next/server';
import settings from './settings.json' assert { type: 'json' };

/**
 * GET /api/settings
 * 앱 설정 반환 (모임 카테고리, 광고 등)
 * meetingCategory: 서버에서 제어하는 모임 카테고리 계층
 * 광고 관련: ios_ad, android_ad, ref, down_load_url 등 (AdService 호환)
 */
export async function GET() {
  try {
    return NextResponse.json(settings, { status: 200 });
  } catch (e) {
    console.error('[settings] Failed to load settings:', e);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}
