export const APP_DISPLAY_NAME = '이음터';

export const IOS_APP_STORE_WEB =
  'https://apps.apple.com/app/id6757979087';

export const PLAY_STORE_WEB =
  'https://play.google.com/store/apps/details?id=com.smartcompany.letsMeet';

export function pickStoreUrl(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  return ua.includes('android') ? PLAY_STORE_WEB : IOS_APP_STORE_WEB;
}
