import { redirect } from 'next/navigation';

import { APP_DISPLAY_NAME, IOS_APP_STORE_WEB } from '@/lib/applink';

export const metadata = {
  title: `${APP_DISPLAY_NAME} — App Store`,
};

/**
 * proxy가 /applink 요청을 기기별 스토어로 리다이렉트합니다.
 * 프록시가 적용되지 않는 환경에서는 App Store를 기본값으로 사용합니다.
 */
export default function AppLinkFallbackPage() {
  redirect(IOS_APP_STORE_WEB);
}
