import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { APP_DISPLAY_NAME, pickStoreUrl } from '@/lib/applink';

export const metadata = {
  title: `${APP_DISPLAY_NAME}`,
};

/**
 * proxy가 /applink 요청을 기기별 목적지로 리다이렉트합니다.
 * 프록시가 없으면 UA로 동일 분기 (모바일 스토어 / PC·Mac 웹).
 */
export default async function AppLinkFallbackPage() {
  const h = await headers();
  redirect(pickStoreUrl(h.get('user-agent') ?? ''));
}
