'use client';

import { useEffect, useState } from 'react';

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
};

const API = process.env.NEXT_PUBLIC_API_BASE || '';

function getVerdictLabel(v: string | null): string {
  if (!v) return '-';
  const map: Record<string, string> = {
    meeting_suspend: '모임 정지',
    needs_review: '검토 필요',
    no_issue: '이상 없음',
  };
  return map[v] || v;
}

export default function DashboardPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const fetchReports = async () => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API}/api/dashboard/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || '로그인 실패');
        return;
      }
      setAuthenticated(true);
      setPassword('');
      await fetchReports();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API}/api/dashboard/logout`, { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setReports([]);
  };

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
          <h1 className="text-xl font-semibold text-zinc-800 mb-6 text-center">관리자 로그인</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-600 mb-1">아이디</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none"
                required
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-zinc-800 text-white py-2 font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              {loginLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-800">신고 관리 대시보드</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          로그아웃
        </button>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
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
                  <th className="px-4 py-3">AI 처리 상태</th>
                  <th className="px-4 py-3">신고 일시</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      신고 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="px-4 py-3">
                        <span className={r.target_type === 'meeting' ? 'text-amber-600' : 'text-blue-600'}>
                          {r.target_type === 'meeting' ? '모임' : '피드'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={r.target_title_or_content}>
                        {r.target_title_or_content || '-'}
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
                      <td className="px-4 py-3">
                        <span className="font-medium">{getVerdictLabel(r.ai_verdict)}</span>
                        {r.ai_reason && (
                          <div className="text-zinc-500 text-xs mt-0.5" title={r.ai_reason}>
                            {r.ai_reason.length > 40 ? r.ai_reason.slice(0, 40) + '…' : r.ai_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
