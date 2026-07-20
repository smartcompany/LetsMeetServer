'use client';

import { useCallback, useEffect, useState } from 'react';

type FunnelStep = {
  eventName: string;
  label: string;
  installs: number;
  rateFromPrevious: number | null;
};

type Journey = {
  installId: string;
  shortId: string;
  platform: string;
  locale: string;
  appVersion: string;
  firstSeenAt: string;
  lastSeenAt: string;
  stage: string;
  detailViewCount: number;
  applyCount: number;
  createCount: number;
  aiSuccessCount: number;
  loginCount: number;
  events: Array<{
    occurredAt: string;
    eventName: string;
    properties: Record<string, string | number | boolean>;
  }>;
};

type DashboardData = {
  configured: boolean;
  periodDays: number;
  summary: {
    activeInstalls: number;
    firstOpens: number;
    homeViewers: number;
    detailViewers: number;
    applyStarters: number;
    applyCompleters: number;
    createCompleters: number;
  };
  activationFunnel: FunnelStep[];
  createFunnel: FunnelStep[];
  aiFunnel: FunnelStep[];
  stageCounts: Record<string, number>;
  featureAdoption: {
    logins: number;
    applies: number;
    creates: number;
    aiCreates: number;
    shares: number;
    chats: number;
  };
  journeys: Journey[];
};

const eventLabels: Record<string, string> = {
  first_open: '최초 실행',
  app_open: '앱 실행',
  home_viewed: '홈 진입',
  tab_selected: '탭 선택',
  login_required: '로그인 필요',
  login_started: '로그인 시작',
  login_succeeded: '로그인 완료',
  login_cancelled: '로그인 취소',
  profile_setup_viewed: '프로필 설정 진입',
  profile_setup_completed: '프로필 설정 완료',
  meeting_detail_opened: '모임 상세 조회',
  meeting_apply_started: '모임 신청 시작',
  meeting_apply_succeeded: '모임 신청 완료',
  meeting_apply_failed: '모임 신청 실패',
  meeting_create_opened: '모임 만들기 진입',
  meeting_create_ai_opened: 'AI 요청 팝업',
  meeting_create_ai_submitted: 'AI 요청 제출',
  meeting_create_ai_succeeded: 'AI 생성 성공',
  meeting_create_ai_failed: 'AI 생성 실패',
  meeting_create_submitted: '모임 제출',
  meeting_create_succeeded: '모임 생성 완료',
  meeting_create_failed: '모임 생성 실패',
  meeting_share_tapped: '모임 공유',
  chat_opened: '채팅 진입',
  feed_viewed: '피드 조회',
  feed_create_opened: '피드 작성 진입',
  feed_create_succeeded: '피드 작성 완료',
  profile_opened: '프로필 조회',
  settings_opened: '설정 진입',
  deep_link_opened: '딥링크 진입',
  search_used: '검색 사용',
};

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">
        {value.toLocaleString('ko-KR')}
      </div>
    </div>
  );
}

function Funnel({ title, steps }: { title: string; steps: FunnelStep[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <h3 className="font-medium text-zinc-800">{title}</h3>
      <div className="mt-3 space-y-2">
        {steps.map((step) => (
          <div key={step.eventName} className="flex items-center gap-3 text-sm">
            <span className="min-w-28 text-zinc-600">{step.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-100">
              <div
                className="h-full rounded bg-violet-500"
                style={{
                  width: `${
                    steps[0]?.installs
                      ? Math.max(2, (step.installs / steps[0].installs) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="w-20 text-right font-medium text-zinc-800">
              {step.installs}명
              {step.rateFromPrevious !== null
                ? ` (${step.rateFromPrevious}%)`
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductAnalyticsPanel() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/dashboard/product-analytics?days=${days}`,
        { credentials: 'include' },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '분석 조회 실패');
      setData(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '분석 조회 실패',
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-zinc-900">사용자 실행 로그 · 여정 분석</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            익명 설치 ID 기준 · 어디서 멈추는지 퍼널과 타임라인으로 확인
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value={7}>최근 7일</option>
            <option value={28}>최근 28일</option>
            <option value={90}>최근 90일</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            새로고침
          </button>
        </div>
      </div>

      {loading && <p className="py-8 text-center text-zinc-500">불러오는 중...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!loading && data && !data.configured && (
        <p className="mt-4 text-sm text-amber-700">
          Supabase에 <code>letsmeet_product_events</code> 테이블이 없습니다.
          마이그레이션을 적용해 주세요.
        </p>
      )}
      {!loading && data?.configured && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetricCard label="활성 설치" value={data.summary.activeInstalls} />
            <MetricCard label="최초 실행" value={data.summary.firstOpens} />
            <MetricCard label="홈 진입" value={data.summary.homeViewers} />
            <MetricCard label="상세 조회" value={data.summary.detailViewers} />
            <MetricCard label="신청 시작" value={data.summary.applyStarters} />
            <MetricCard label="신청 완료" value={data.summary.applyCompleters} />
            <MetricCard label="모임 생성" value={data.summary.createCompleters} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Funnel title="참가 퍼널" steps={data.activationFunnel} />
            <Funnel title="모임 생성 퍼널" steps={data.createFunnel} />
            <Funnel title="AI 소개 퍼널" steps={data.aiFunnel} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <h3 className="font-medium text-zinc-800">멈춘 단계 (설치 수)</h3>
              <div className="mt-3 space-y-2 text-sm">
                {Object.entries(data.stageCounts).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between">
                    <span className="text-zinc-600">{stage}</span>
                    <strong>{count}명</strong>
                  </div>
                ))}
                {Object.keys(data.stageCounts).length === 0 && (
                  <p className="text-zinc-500">아직 데이터 없음</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <h3 className="font-medium text-zinc-800">기능 사용 설치 수</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <span>로그인 {data.featureAdoption.logins}명</span>
                <span>신청 {data.featureAdoption.applies}명</span>
                <span>모임 생성 {data.featureAdoption.creates}명</span>
                <span>AI 소개 {data.featureAdoption.aiCreates}명</span>
                <span>공유 {data.featureAdoption.shares}명</span>
                <span>채팅 {data.featureAdoption.chats}명</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="font-medium text-zinc-800">사용자별 실행 타임라인</h3>
            </div>
            <div className="max-h-[640px] overflow-auto">
              {data.journeys.map((journey) => (
                <div
                  key={journey.installId}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(
                        expandedId === journey.installId
                          ? null
                          : journey.installId,
                      )
                    }
                    className="grid w-full gap-2 px-4 py-3 text-left hover:bg-zinc-50 sm:grid-cols-[110px_1fr_180px_210px]"
                  >
                    <strong className="text-sm">{journey.shortId}</strong>
                    <span className="text-sm text-zinc-700">{journey.stage}</span>
                    <span className="text-xs text-zinc-500">
                      상세 {journey.detailViewCount} · 신청 {journey.applyCount} ·
                      생성 {journey.createCount} · AI {journey.aiSuccessCount}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {journey.platform} · {journey.locale} ·{' '}
                      {new Date(journey.lastSeenAt).toLocaleString('ko-KR')}
                    </span>
                  </button>
                  {expandedId === journey.installId && (
                    <ol className="space-y-2 bg-zinc-50 px-6 py-4">
                      {journey.events.map((event, index) => (
                        <li
                          key={`${event.occurredAt}-${index}`}
                          className="flex flex-wrap gap-x-3 text-xs"
                        >
                          <time className="text-zinc-400">
                            {new Date(event.occurredAt).toLocaleString('ko-KR')}
                          </time>
                          <strong className="text-zinc-700">
                            {eventLabels[event.eventName] ?? event.eventName}
                          </strong>
                          {Object.keys(event.properties).length > 0 && (
                            <span className="text-zinc-500">
                              {Object.entries(event.properties)
                                .map(([key, value]) => `${key}=${value}`)
                                .join(' · ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              {data.journeys.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">
                  아직 수집된 이벤트가 없습니다. 앱 업데이트 후 데이터가 쌓입니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
