import { getWebAppOrigin } from '@/lib/public-origin';

export const APP_DISPLAY_NAME = '이음터';

export const IOS_APP_STORE_WEB =
  'https://apps.apple.com/kr/app/id6757979087';

export const PLAY_STORE_WEB =
  'https://play.google.com/store/apps/details?id=com.smartcompany.letsMeet&hl=ko&gl=KR';

/** 모바일 → 스토어, PC/Mac → Flutter 웹 */
export function pickStoreUrl(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return PLAY_STORE_WEB;
  if (/iphone|ipad|ipod/.test(ua)) return IOS_APP_STORE_WEB;
  return getWebAppOrigin();
}
