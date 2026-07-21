import { notFound } from 'next/navigation';

import {
  IOS_APP_STORE_WEB,
  PLAY_STORE_WEB,
} from '@/lib/applink';
import {
  buildApplinkUrl,
  getPublicOrigin,
} from '@/lib/public-origin';
import { buildMeetingLandingScript } from '@/lib/share-app-scheme';

async function getMeeting(id: string) {
  const base = getPublicOrigin();
  const res = await fetch(`${base}/api/meetings/${id}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) return { title: '이음터 - 모임을 찾을 수 없습니다' };
  const base = getPublicOrigin();
  return {
    title: `${meeting.title} - 이음터`,
    description:
      meeting.short_description ||
      meeting.description?.slice(0, 160) ||
      '이음터 모임에 참여해보세요!',
    openGraph: {
      title: `${meeting.title} - 이음터`,
      description:
        meeting.short_description ||
        meeting.description?.slice(0, 160) ||
        '이음터 모임에 참여해보세요!',
      url: `${base}/meeting/${id}`,
    },
  };
}

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    notFound();
  }

  const downloadUrl = buildApplinkUrl();
  const landingScript = buildMeetingLandingScript(id, downloadUrl);
  const appDeepLink = `letsmeet://meeting/${id}`;

  const title = meeting.title || '모임';
  const description = meeting.short_description || meeting.description || '';

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: landingScript }} />
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#FAFAFA',
          color: '#212121',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'white',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 12,
              color: '#212121',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: 15,
                color: '#757575',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {description.slice(0, 200)}
              {description.length > 200 ? '...' : ''}
            </p>
          )}
          <p
            style={{
              fontSize: 14,
              color: '#9E9E9E',
              marginBottom: 24,
            }}
          >
            앱이 설치되어 있으면 자동으로 열립니다. 열리지 않으면 잠시 후
            App Store로 이동합니다.
          </p>
          <a
            href={appDeepLink}
            style={{
              display: 'inline-block',
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#2196F3',
              color: 'white',
              borderRadius: 12,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 16,
              textDecoration: 'none',
              marginBottom: 12,
            }}
          >
            앱에서 열기
          </a>
          <a
            href={downloadUrl}
            style={{
              display: 'inline-block',
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#F3F4F6',
              color: '#212121',
              borderRadius: 12,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 16,
              textDecoration: 'none',
            }}
          >
            앱 다운로드
          </a>
          <noscript>
            <p
              style={{
                fontSize: 14,
                marginTop: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <a href={IOS_APP_STORE_WEB} style={{ color: '#2196F3' }}>
                App Store에서 설치
              </a>
              <a href={PLAY_STORE_WEB} style={{ color: '#2196F3' }}>
                Google Play에서 설치
              </a>
              <a href={downloadUrl} style={{ color: '#757575' }}>
                앱 다운로드
              </a>
            </p>
          </noscript>
        </div>
      </div>
    </>
  );
}
