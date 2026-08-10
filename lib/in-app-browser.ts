/** X·카카오·FB 등 인앱 WebView UA (Tabata applink/social 와 동일) */
export const IN_APP_BROWSER_UA_RE =
  /(Twitter|X\/[\d.]+|FBIOS|FBAN|FBAV|Line\/|KakaoTalk|Kakao|Daum|KAKAOTALK|Whatsapp|Telegram|Snapchat|Slack|LinkedIn|FB_IAB|Instagram|Pinterest|musical_ly|ByteDance|Aweme|; wv\))/i;

export function isInAppBrowserUserAgent(userAgent: string): boolean {
  return IN_APP_BROWSER_UA_RE.test(userAgent);
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /android|iphone|ipad|ipod/i.test(userAgent);
}
