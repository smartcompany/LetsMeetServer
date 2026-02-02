import { notFound } from 'next/navigation';

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

async function getMeeting(id: string) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/meetings/${id}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) return { title: 'LetsMeet - 모임을 찾을 수 없습니다' };
  const base = getBaseUrl();
  return {
    title: `${meeting.title} - LetsMeet`,
    description: meeting.short_description || meeting.description?.slice(0, 160) || 'Let\'s Meet 모임에 참여해보세요!',
    openGraph: {
      title: `${meeting.title} - LetsMeet`,
      description: meeting.short_description || meeting.description?.slice(0, 160) || 'Let\'s Meet 모임에 참여해보세요!',
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

  const appDeepLink = `letsmeet://meeting/${id}`;
  const title = meeting.title || '모임';
  const description = meeting.short_description || meeting.description || '';

  return (
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
          Let&apos;s Meet 앱에서 모임 상세를 확인하고 참여해보세요.
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
          }}
        >
          앱에서 열기
        </a>
        <p
          style={{
            fontSize: 12,
            color: '#9E9E9E',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          앱이 설치되어 있으면 자동으로 열립니다
        </p>
      </div>
    </div>
  );
}
