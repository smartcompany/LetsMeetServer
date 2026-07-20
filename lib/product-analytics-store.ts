import { supabase } from '@/lib/db/supabase';

const TABLE = 'letsmeet_product_events';
const RAW_LIMIT = 10000;

export const PRODUCT_EVENT_NAMES = [
  'first_open',
  'app_open',
  'home_viewed',
  'tab_selected',
  'login_required',
  'login_started',
  'login_succeeded',
  'login_cancelled',
  'profile_setup_viewed',
  'profile_setup_completed',
  'meeting_detail_opened',
  'meeting_apply_started',
  'meeting_apply_succeeded',
  'meeting_apply_failed',
  'meeting_create_opened',
  'meeting_create_ai_opened',
  'meeting_create_ai_submitted',
  'meeting_create_ai_succeeded',
  'meeting_create_ai_failed',
  'meeting_create_submitted',
  'meeting_create_succeeded',
  'meeting_create_failed',
  'meeting_share_tapped',
  'chat_opened',
  'feed_viewed',
  'feed_create_opened',
  'feed_create_succeeded',
  'profile_opened',
  'settings_opened',
  'deep_link_opened',
  'search_used',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type ProductEventInput = {
  eventId: string;
  occurredAt: string;
  installId: string;
  sessionId: string;
  eventName: ProductEventName;
  platform: 'ios' | 'android' | 'web' | 'other';
  appVersion: string;
  locale: string;
  properties: Record<string, string | number | boolean>;
};

type DbRow = {
  event_id: string;
  occurred_at: string;
  received_at: string;
  install_id: string;
  user_id: string | null;
  session_id: string;
  event_name: ProductEventName;
  platform: string;
  app_version: string;
  locale: string;
  properties: Record<string, string | number | boolean> | null;
};

export async function recordProductEvents(
  events: ProductEventInput[],
  userId: string | null,
): Promise<void> {
  const rows = events.map((event) => ({
    event_id: event.eventId,
    occurred_at: event.occurredAt,
    install_id: event.installId,
    user_id: userId,
    session_id: event.sessionId,
    event_name: event.eventName,
    platform: event.platform,
    app_version: event.appVersion,
    locale: event.locale,
    properties: event.properties,
  }));

  const { error } = await supabase.from(TABLE).upsert(rows, {
    onConflict: 'event_id',
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Failed to record analytics: ${error.message}`);
}

export type AnalyticsFunnelStep = {
  eventName: ProductEventName;
  label: string;
  installs: number;
  rateFromPrevious: number | null;
};

export type AnalyticsJourney = {
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
    eventName: ProductEventName;
    properties: Record<string, string | number | boolean>;
  }>;
};

export type ProductAnalyticsDashboardData = {
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
  activationFunnel: AnalyticsFunnelStep[];
  createFunnel: AnalyticsFunnelStep[];
  aiFunnel: AnalyticsFunnelStep[];
  eventCounts: Record<string, number>;
  stageCounts: Record<string, number>;
  featureAdoption: {
    logins: number;
    applies: number;
    creates: number;
    aiCreates: number;
    shares: number;
    chats: number;
  };
  journeys: AnalyticsJourney[];
};

function percentage(value: number, base: number): number {
  return base <= 0 ? 0 : Math.round((value / base) * 1000) / 10;
}

function stageFor(
  names: Set<string>,
  applyCount: number,
  createCount: number,
): string {
  if (createCount >= 1) return '모임 생성 완료';
  if (names.has('meeting_create_opened')) return '모임 생성 시작 후 미완료';
  if (applyCount >= 1) return '모임 신청 완료';
  if (names.has('meeting_apply_started')) return '모임 신청 시도 후 미완료';
  if (names.has('meeting_detail_opened')) return '모임 상세 조회';
  if (names.has('home_viewed')) return '홈 진입';
  if (names.has('login_succeeded')) return '로그인만 완료';
  return '최초 실행만';
}

function buildFunnel(
  rowsByInstall: Map<string, DbRow[]>,
  steps: Array<{
    eventName: ProductEventName;
    label: string;
    anyOf?: ProductEventName[];
  }>,
): AnalyticsFunnelStep[] {
  let previous: number | null = null;
  return steps.map((step) => {
    const acceptedNames = new Set(step.anyOf ?? [step.eventName]);
    const installs = [...rowsByInstall.values()].filter((rows) =>
      rows.some((row) => acceptedNames.has(row.event_name)),
    ).length;
    const result = {
      eventName: step.eventName,
      label: step.label,
      installs,
      rateFromPrevious:
        previous === null ? null : percentage(installs, previous),
    };
    previous = installs;
    return result;
  });
}

function uniqueWith(
  journeys: AnalyticsJourney[],
  eventName: ProductEventName,
): number {
  return journeys.filter((journey) =>
    journey.events.some((event) => event.eventName === eventName),
  ).length;
}

export async function getProductAnalyticsDashboardData(
  periodDays = 28,
): Promise<ProductAnalyticsDashboardData> {
  const empty: ProductAnalyticsDashboardData = {
    configured: true,
    periodDays,
    summary: {
      activeInstalls: 0,
      firstOpens: 0,
      homeViewers: 0,
      detailViewers: 0,
      applyStarters: 0,
      applyCompleters: 0,
      createCompleters: 0,
    },
    activationFunnel: [],
    createFunnel: [],
    aiFunnel: [],
    eventCounts: {},
    stageCounts: {},
    featureAdoption: {
      logins: 0,
      applies: 0,
      creates: 0,
      aiCreates: 0,
      shares: 0,
      chats: 0,
    },
    journeys: [],
  };

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - periodDays);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
    .limit(RAW_LIMIT);

  if (error) {
    if (error.message.includes('does not exist')) {
      return { ...empty, configured: false };
    }
    throw new Error(`Failed to load analytics: ${error.message}`);
  }

  const rows = (data ?? []) as DbRow[];
  const rowsByInstall = new Map<string, DbRow[]>();
  const eventCounts: Record<string, number> = {};
  for (const row of rows) {
    eventCounts[row.event_name] = (eventCounts[row.event_name] ?? 0) + 1;
    const existing = rowsByInstall.get(row.install_id) ?? [];
    existing.push(row);
    rowsByInstall.set(row.install_id, existing);
  }

  const journeys = [...rowsByInstall.entries()]
    .map(([installId, installRows]): AnalyticsJourney => {
      const chronological = [...installRows].sort((a, b) =>
        a.occurred_at.localeCompare(b.occurred_at),
      );
      const latest = chronological[chronological.length - 1];
      const names = new Set(chronological.map((row) => row.event_name));
      const detailViewCount = chronological.filter(
        (row) => row.event_name === 'meeting_detail_opened',
      ).length;
      const applyCount = chronological.filter(
        (row) => row.event_name === 'meeting_apply_succeeded',
      ).length;
      const createCount = chronological.filter(
        (row) => row.event_name === 'meeting_create_succeeded',
      ).length;
      return {
        installId,
        shortId: installId.replaceAll('-', '').slice(0, 8).toUpperCase(),
        platform: latest.platform,
        locale: latest.locale,
        appVersion: latest.app_version,
        firstSeenAt: chronological[0].occurred_at,
        lastSeenAt: latest.occurred_at,
        stage: stageFor(names, applyCount, createCount),
        detailViewCount,
        applyCount,
        createCount,
        aiSuccessCount: chronological.filter(
          (row) => row.event_name === 'meeting_create_ai_succeeded',
        ).length,
        loginCount: chronological.filter(
          (row) => row.event_name === 'login_succeeded',
        ).length,
        events: chronological.map((row) => ({
          occurredAt: row.occurred_at,
          eventName: row.event_name,
          properties: row.properties ?? {},
        })),
      };
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

  const stageCounts: Record<string, number> = {};
  for (const journey of journeys) {
    stageCounts[journey.stage] = (stageCounts[journey.stage] ?? 0) + 1;
  }

  return {
    configured: true,
    periodDays,
    summary: {
      activeInstalls: journeys.length,
      firstOpens: uniqueWith(journeys, 'first_open'),
      homeViewers: uniqueWith(journeys, 'home_viewed'),
      detailViewers: uniqueWith(journeys, 'meeting_detail_opened'),
      applyStarters: uniqueWith(journeys, 'meeting_apply_started'),
      applyCompleters: uniqueWith(journeys, 'meeting_apply_succeeded'),
      createCompleters: uniqueWith(journeys, 'meeting_create_succeeded'),
    },
    activationFunnel: buildFunnel(rowsByInstall, [
      { eventName: 'first_open', label: '최초 실행' },
      { eventName: 'home_viewed', label: '홈 진입' },
      { eventName: 'meeting_detail_opened', label: '모임 상세 조회' },
      { eventName: 'meeting_apply_started', label: '모임 신청 시작' },
      { eventName: 'meeting_apply_succeeded', label: '모임 신청 완료' },
    ]),
    createFunnel: buildFunnel(rowsByInstall, [
      { eventName: 'meeting_create_opened', label: '모임 만들기 진입' },
      { eventName: 'meeting_create_submitted', label: '모임 제출' },
      { eventName: 'meeting_create_succeeded', label: '모임 생성 완료' },
    ]),
    aiFunnel: buildFunnel(rowsByInstall, [
      { eventName: 'meeting_create_ai_opened', label: 'AI 요청 팝업' },
      { eventName: 'meeting_create_ai_submitted', label: 'AI 요청 제출' },
      { eventName: 'meeting_create_ai_succeeded', label: 'AI 생성 성공' },
    ]),
    eventCounts,
    stageCounts,
    featureAdoption: {
      logins: uniqueWith(journeys, 'login_succeeded'),
      applies: uniqueWith(journeys, 'meeting_apply_succeeded'),
      creates: uniqueWith(journeys, 'meeting_create_succeeded'),
      aiCreates: uniqueWith(journeys, 'meeting_create_ai_succeeded'),
      shares: uniqueWith(journeys, 'meeting_share_tapped'),
      chats: uniqueWith(journeys, 'chat_opened'),
    },
    journeys: journeys.slice(0, 200),
  };
}
