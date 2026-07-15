'use client';

import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '@/lib/firebase/client';
import BotControlPanel from './components/BotControlPanel';

type ReportRow = {
  id: string;
  target_type: 'meeting' | 'feed';
  target_id: string;
  target_title_or_content: string;
  host_or_author_name: string | null;
  host_or_author_id: string;
  reason: string;
  detail: string | null;
  reporter_user_id: string;
  reporter_name: string | null;
  ai_verdict: string | null;
  ai_reason: string | null;
  ai_verdict_at: string | null;
  created_at: string;
  admin_verdict: string | null;
};

const API = process.env.NEXT_PUBLIC_API_BASE || '';

type TargetDetail = {
  type: 'meeting' | 'feed';
  title: string | null;
  content: string;
  image_urls: string[];
};

type DashboardTab = 'reports' | 'bot';

function getVerdictLabel(v: string | null): string {
  if (!v) return '-';
  const map: Record<string, string> = {
    meeting_suspend: '모임 정지',
    needs_review: '검토 필요',
    no_issue: '이상 없음',
  };
  return map[v] || v;
}

const MS_24H = 24 * 60 * 60 * 1000;
function isOver24h(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() > MS_24H;
}

export default function DashboardPage() {
  const [tab, setTab] = useState<DashboardTab>('reports');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [detail, setDetail] = useState<TargetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminSelections, setAdminSelections] = useState<Record<string, 'meeting_suspend' | 'no_issue' | ''>>({});
  const [updateLoading, setUpdateLoading] = useState(false);
  const [filter24h, setFilter24h] = useState<'all' | 'over24' | 'within24'>('all');

  const fetchTargetDetail = async (targetType: 'meeting' | 'feed', targetId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(
        `${API}/api/dashboard/target/${targetType}/${targetId}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = await res.json();
      setDetail({
        type: data.type,
        title: data.title ?? null,
        content: data.content ?? '',
        image_urls: data.image_urls ?? [],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (r: ReportRow) => {
    fetchTargetDetail(r.target_type, r.target_id);
  };

  const fetchReports = async (priorSelections?: Record<string, 'meeting_suspend' | 'no_issue' | ''>) => {
    const res = await fetch(`${API}/api/dashboard/reports`, { credentials: 'include' });
    if (res.status === 401) {
      setAuthenticated(false);
      setReports([]);
      return;
    }
    if (!res.ok) {
      setAuthenticated(true);
      setReports([]);
      return;
    }
    const data = await res.json();
    setReports(data.reports || []);
    setAuthenticated(true);
    const initial: Record<string, 'meeting_suspend' | 'no_issue' | ''> = {};
    for (const r of data.reports || []) {
      const v = r.admin_verdict ?? priorSelections?.[r.id];
      if (v === 'meeting_suspend' || v === 'no_issue') initial[r.id] = v;
      else initial[r.id] = '';
    }
    setAdminSelections(initial);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchReports();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    const auth = getFirebaseClientAuth();
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();

      const res = await fetch(`${API}/api/dashboard/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      await signOut(auth).catch(() => undefined);

      if (!res.ok) {
        setLoginError(data.error || '로그인 실패');
        return;
      }
      setAuthenticated(true);
      await fetchReports();
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLoginError('');
        return;
      }
      setLoginError(e instanceof Error ? e.message : 'Google 로그인 실패');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API}/api/dashboard/logout`, { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setReports([]);
  };

  const handleUpdateStatus = async () => {
    const updates = reports
      .filter((r) => adminSelections[r.id] === 'meeting_suspend' || adminSelections[r.id] === 'no_issue')
      .map((r) => ({ report_id: r.id, admin_verdict: adminSelections[r.id] as 'meeting_suspend' | 'no_issue' }));
    if (updates.length === 0) {
      alert('선택한 신고 처리가 없습니다.');
      return;
    }
    setUpdateLoading(true);
    try {
      const res = await fetch(`${API}/api/dashboard/reports/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '상태 업데이트에 실패했습니다.');
        return;
      }
      await fetchReports(adminSelections);
    } finally {
      setUpdateLoading(false);
    }
  };

  const filteredReports =
    filter24h === 'all'
      ? reports
      : filter24h === 'over24'
        ? reports.filter((r) => isOver24h(r.created_at))
        : reports.filter((r) => !isOver24h(r.created_at));
  const sortedReports = [...filteredReports].sort((a, b) => {
    const aOver = isOver24h(a.created_at);
    const bOver = isOver24h(b.created_at);
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading && authenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <p className="text-zinc-500">확인 중...</p>
      </div>
    );
  }

  if (authenticated === false) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-lg border border-zinc-200 p-8">
          <h1 className="text-xl font-semibold text-zinc-800 mb-2 text-center">관리자 로그인</h1>
          <p className="text-sm text-zinc-500 mb-6 text-center">
            허용된 Google 계정으로만 접속할 수 있습니다.
          </p>
          {loginError && (
            <p className="text-sm text-red-600 mb-4 text-center">{loginError}</p>
          )}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loginLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white py-2.5 font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.7-4.5 6.4-8.3 7.5l6.2 5.2C36.4 38.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z"/>
            </svg>
            {loginLoading ? '로그인 중...' : 'Google로 계속하기'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-800">운영 대시보드</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          로그아웃
        </button>
      </header>

      <div className="bg-white border-b border-zinc-200 px-4">
        <div className="max-w-7xl mx-auto flex gap-1">
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              tab === 'reports'
                ? 'border-zinc-800 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            신고 관리
          </button>
          <button
            type="button"
            onClick={() => setTab('bot')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
              tab === 'bot'
                ? 'border-zinc-800 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            AI 모임 컨트롤
          </button>
        </div>
      </div>

      <main className="p-4 max-w-7xl mx-auto">
        {tab === 'bot' ? (
          <BotControlPanel />
        ) : (
          <>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-sm text-zinc-600">24시간 기준:</span>
          <select
            value={filter24h}
            onChange={(e) => setFilter24h(e.target.value as 'all' | 'over24' | 'within24')}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 focus:border-zinc-500 focus:outline-none"
          >
            <option value="all">전체</option>
            <option value="over24">24시간 경과</option>
            <option value="within24">검토 기한 내</option>
          </select>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 font-medium">
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">모임/피드</th>
                  <th className="px-4 py-3">모임장/작성자</th>
                  <th className="px-4 py-3">신고 내용</th>
                  <th className="px-4 py-3">신고자</th>
                  <th className="px-4 py-3 whitespace-nowrap min-w-[180px]">AI 처리 상태</th>
                  <th className="px-4 py-3 whitespace-nowrap">신고 일시</th>
                  <th className="px-4 py-3 whitespace-nowrap">24시간</th>
                  <th className="px-4 py-3 whitespace-nowrap">신고 처리</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      신고 내역이 없습니다.
                    </td>
                  </tr>
                ) : sortedReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      해당 조건에 맞는 신고가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedReports.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <span className={r.target_type === 'meeting' ? 'text-amber-600' : 'text-blue-600'}>
                          {r.target_type === 'meeting' ? '모임' : '피드'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className="text-left w-full truncate block text-zinc-800 underline decoration-zinc-300 hover:decoration-zinc-600 focus:outline-none"
                          title="클릭하면 제목·내용·첨부 사진 보기"
                        >
                          {r.target_title_or_content || '-'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {r.host_or_author_name ?? r.host_or_author_id}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-medium text-zinc-800">{r.reason}</div>
                        {r.detail && (
                          <div className="text-zinc-500 truncate" title={r.detail}>{r.detail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.reporter_name ?? r.reporter_user_id}
                      </td>
                      <td className="px-4 py-3 min-w-[180px] max-w-[280px]">
                        <span className="font-medium whitespace-nowrap">
                          {getVerdictLabel(r.ai_verdict)}
                        </span>
                        {r.ai_reason && (
                          <div className="text-zinc-500 text-xs mt-0.5 whitespace-normal break-keep">
                            {r.ai_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {isOver24h(r.created_at) ? (
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                            24시간 경과
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                            검토 기한 내
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={adminSelections[r.id] ?? ''}
                          onChange={(e) => setAdminSelections((prev) => ({ ...prev, [r.id]: e.target.value as 'meeting_suspend' | 'no_issue' | '' }))}
                          className="rounded border border-zinc-300 px-2 py-1.5 text-zinc-800 text-sm focus:border-zinc-500 focus:outline-none"
                        >
                          <option value="">선택 안 함</option>
                          <option value="no_issue">이상 없음</option>
                          <option value="meeting_suspend">모임 정지</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleUpdateStatus}
            disabled={reports.length === 0 || updateLoading}
            className="rounded-lg bg-zinc-800 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {updateLoading ? '처리 중…' : '상태 업데이트'}
          </button>
        </div>

        {(detail !== null || detailLoading) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => !detailLoading && setDetail(null)}
            role="dialog"
            aria-modal="true"
            aria-label="모임/피드 상세"
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
                <h2 className="font-semibold text-zinc-800">
                  {detailLoading ? '불러오는 중…' : detail?.type === 'meeting' ? '모임 상세' : '피드 상세'}
                </h2>
                {!detailLoading && (
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="text-zinc-500 hover:text-zinc-800 p-1"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="overflow-y-auto p-4 flex-1">
                {detailLoading ? (
                  <p className="text-zinc-500">로딩 중...</p>
                ) : detail ? (
                  <>
                    {detail.type === 'meeting' && detail.title && (
                      <h3 className="text-lg font-medium text-zinc-900 mb-2">{detail.title}</h3>
                    )}
                    <div className="text-zinc-700 whitespace-pre-wrap break-words mb-4">
                      {detail.content || '(내용 없음)'}
                    </div>
                    {detail.image_urls.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-zinc-600">첨부 사진 ({detail.image_urls.length}장)</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {detail.image_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg overflow-hidden bg-zinc-100 aspect-square"
                            >
                              <img
                                src={url}
                                alt={`첨부 ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}
