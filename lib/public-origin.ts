/** SSR/API 자기 호출·공유 링크용 공개 origin (API 서버) */
export function getPublicOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://lets-meet-server.vercel.app';
}

/** Flutter 웹 호스트 (PC/Mac 랜딩) */
export function getWebAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WEB_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'https://lets-meet-lime.vercel.app';
}

export function buildApplinkUrl(origin?: string): string {
  return `${origin ?? getPublicOrigin()}/applink`;
}

export function buildMeetingPageUrl(meetingId: string, origin?: string): string {
  return `${origin ?? getPublicOrigin()}/meeting/${encodeURIComponent(meetingId)}`;
}

export function buildWebMeetingUrl(meetingId: string, origin?: string): string {
  return `${origin ?? getWebAppOrigin()}/meeting/${encodeURIComponent(meetingId)}`;
}
