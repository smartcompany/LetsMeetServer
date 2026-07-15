'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BotConfig, BotLog, DashboardUser } from '@/lib/bot/types';

const API = process.env.NEXT_PUBLIC_API_BASE || '';
const MAX_CLIENT_LOGS = 200;

const defaultConfig: BotConfig = {
  creatorRatio: 0.4,
  applicationsPerRunPerBot: 2,
  applyOnlyToBotMeetings: true,
  updatedAt: '',
};

function makeClientLog(level: BotLog['level'], message: string): BotLog {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    level,
    message,
  };
}

function prependLogs(prev: BotLog[], incoming: BotLog[]): BotLog[] {
  return [...incoming, ...prev].slice(0, MAX_CLIENT_LOGS);
}

export default function BotControlPanel() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [botMeetingsCount, setBotMeetingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateProgress, setSimulateProgress] = useState<string | null>(null);
  const [deletingMeetings, setDeletingMeetings] = useState(false);
  const [creatingUid, setCreatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addLog(level: BotLog['level'], message: string) {
    setLogs((prev) => prependLogs(prev, [makeClientLog(level, message)]));
  }

  function addLogsFromApi(incoming: BotLog[] | undefined) {
    if (!incoming?.length) return;
    setLogs((prev) => prependLogs(prev, incoming));
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, configRes] = await Promise.all([
        fetch(`${API}/api/dashboard/bot-users`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API}/api/dashboard/bot-config`, { cache: 'no-store', credentials: 'include' }),
      ]);

      if (!usersRes.ok) throw new Error(`users API 실패: ${usersRes.status}`);
      if (!configRes.ok) throw new Error(`config API 실패: ${configRes.status}`);

      const usersJson = (await usersRes.json()) as {
        users: DashboardUser[];
        botMeetingsCount?: number;
      };
      const configJson = (await configRes.json()) as { config: BotConfig };

      setUsers(usersJson.users);
      setConfig(configJson.config);
      if (typeof usersJson.botMeetingsCount === 'number') {
        setBotMeetingsCount(usersJson.botMeetingsCount);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const selectedUsers = useMemo(() => users.filter((u) => u.isBot), [users]);

  async function toggleBot(uid: string) {
    const user = users.find((u) => u.uid === uid);
    if (!user) return;
    const nextIsBot = !user.isBot;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/dashboard/bot-users/${encodeURIComponent(uid)}/bot`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isBot: nextIsBot }),
        }
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `봇 선택 저장 실패: ${res.status}`);
      }
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, isBot: nextIsBot } : u))
      );
      addLog('info', `${user.email ?? uid} 봇 ${nextIsBot ? '선택' : '해제'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '봇 선택 저장 오류');
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/dashboard/bot-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);
      addLog('info', '봇 정책 설정 저장 완료');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 오류');
    } finally {
      setSaving(false);
    }
  }

  async function runSimulateOnce() {
    const bots = selectedUsers;
    if (bots.length === 0) {
      setError('1회 실행할 봇 계정을 먼저 체크하세요.');
      return;
    }
    const peerBotUids = bots.map((u) => u.uid);
    setSimulating(true);
    setSaving(true);
    setError(null);
    addLog('info', `시뮬레이션 시작: 선택한 봇 ${bots.length}명을 1명씩 순차 처리`);

    let totalCreated = 0;
    let totalApplied = 0;
    let totalApproved = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < bots.length; i += 1) {
        const bot = bots[i]!;
        const label = bot.email ?? bot.profileName ?? bot.uid;
        setSimulateProgress(`${i + 1}/${bots.length} · ${label}`);
        addLog('info', `[${i + 1}/${bots.length}] ${label} 처리 시작`);

        try {
          const res = await fetch(`${API}/api/dashboard/bot-control/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              selectedBotUids: [bot.uid],
              peerBotUids,
            }),
          });
          const body = (await res.json()) as {
            error?: string;
            logs?: BotLog[];
            summary?: {
              createdNow?: number;
              appliedNow?: number;
              approvedNow?: number;
            };
          };
          addLogsFromApi(body.logs);

          if (!res.ok) {
            failedCount += 1;
            addLog('error', `[${i + 1}/${bots.length}] ${label} 실패: ${body.error ?? res.status}`);
            continue;
          }

          totalCreated += body.summary?.createdNow ?? 0;
          totalApplied += body.summary?.appliedNow ?? 0;
          totalApproved += body.summary?.approvedNow ?? 0;
          addLog(
            'info',
            `[${i + 1}/${bots.length}] ${label} 완료: 생성 ${body.summary?.createdNow ?? 0}, 신청 ${body.summary?.appliedNow ?? 0}, 승인 ${body.summary?.approvedNow ?? 0}`
          );
        } catch (e) {
          failedCount += 1;
          addLog(
            'error',
            `[${i + 1}/${bots.length}] ${label} 예외: ${e instanceof Error ? e.message : 'unknown'}`
          );
        }
      }

      addLog(
        'info',
        `전체 완료: 생성 ${totalCreated}, 신청 ${totalApplied}, 승인 ${totalApproved}, 실패 ${failedCount}`
      );
      if (failedCount > 0) {
        setError(`${failedCount}명 처리 중 오류가 있었습니다. 실행 로그를 확인하세요.`);
      }
      await loadAll();
    } finally {
      setSimulateProgress(null);
      setSimulating(false);
      setSaving(false);
    }
  }

  async function createMeetingByBot(uid: string, email: string | null) {
    setCreatingUid(uid);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/dashboard/bot-control/create-meeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uid, email }),
      });
      const body = (await res.json()) as { error?: string; log?: string; meeting?: { title: string } };
      if (!res.ok) {
        throw new Error(body.error ?? `모임 생성 실패: ${res.status}`);
      }
      addLog('info', body.log ?? `모임 생성 완료: ${body.meeting?.title ?? uid}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 생성 오류');
    } finally {
      setCreatingUid(null);
      setSaving(false);
    }
  }

  function clearLogs() {
    setLogs([]);
  }

  async function deleteSelectedBotMeetings() {
    const botUids = selectedUsers.map((u) => u.uid);
    if (botUids.length === 0) {
      setError('삭제할 봇 계정을 먼저 선택하세요.');
      return;
    }

    const ok = window.confirm(`선택된 봇 ${botUids.length}명의 모임을 모두 삭제할까요?`);
    if (!ok) return;

    setDeletingMeetings(true);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/dashboard/bot-control/delete-meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uids: botUids }),
      });
      const body = (await res.json()) as { error?: string; log?: string; deletedInDb?: number };
      if (!res.ok) {
        throw new Error(body.error ?? `모임 삭제 실패: ${res.status}`);
      }
      addLog('info', body.log ?? `봇 모임 ${body.deletedInDb ?? 0}개 삭제`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 삭제 오류');
    } finally {
      setDeletingMeetings(false);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        봇 계정을 선택하고 AI로 모임 생성/참가 시뮬레이션을 제어합니다.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">운영 제어</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={runSimulateOnce}
            disabled={saving || loading || simulating}
            className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {simulating
              ? simulateProgress
                ? `실행 중... ${simulateProgress}`
                : '실행 중...'
              : '지금 1회 실행 (simulate)'}
          </button>
          <button
            type="button"
            onClick={loadAll}
            disabled={saving || loading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
        <div className="text-sm text-zinc-600 space-y-1">
          <div>선택된 봇 계정: {selectedUsers.length}개</div>
          <div>봇이 생성한 모임: {botMeetingsCount}개</div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-base font-semibold text-zinc-800 mb-3">봇 정책 설정</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-700 flex flex-col gap-1">
            봇당 신청 개수 (N)
            <input
              type="number"
              min={0}
              max={10}
              value={config.applicationsPerRunPerBot}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  applicationsPerRunPerBot: Number(e.target.value || 0),
                }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-zinc-700 flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={config.applyOnlyToBotMeetings}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  applyOnlyToBotMeetings: e.target.checked,
                }))
              }
            />
            봇이 만든 모임에만 참가
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          미리보기: 선택 봇 {selectedUsers.length}명이 모임 생성, 전체 봇이 타인 모임에 최대{' '}
          {config.applicationsPerRunPerBot}개 신청.
        </p>
        <button
          type="button"
          onClick={saveConfig}
          disabled={saving || loading}
          className="mt-3 rounded-lg bg-zinc-800 text-white px-3 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50"
        >
          설정 저장
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-zinc-800">사용자 목록 (봇 계정 선택)</h2>
          <button
            type="button"
            onClick={deleteSelectedBotMeetings}
            disabled={saving || loading || deletingMeetings || selectedUsers.length === 0}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {deletingMeetings ? '삭제 중...' : '봇 모임 삭제'}
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">로딩 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600">
                  <th className="px-2 py-2">선택</th>
                  <th className="px-2 py-2">로그인</th>
                  <th className="px-2 py-2">이메일</th>
                  <th className="px-2 py-2">UID</th>
                  <th className="px-2 py-2">이름</th>
                  <th className="px-2 py-2">신뢰</th>
                  <th className="px-2 py-2">활성</th>
                  <th className="px-2 py-2">동작</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const checked = u.isBot;
                  return (
                    <tr key={u.uid} className="border-b border-zinc-100">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving || loading}
                          onChange={() => void toggleBot(u.uid)}
                        />
                      </td>
                      <td className="px-2 py-2">{u.loginProvider ?? '-'}</td>
                      <td className="px-2 py-2">{u.email ?? '-'}</td>
                      <td className="px-2 py-2 font-mono text-xs">{u.uid}</td>
                      <td className="px-2 py-2">{u.profileName ?? u.firebaseDisplayName ?? '-'}</td>
                      <td className="px-2 py-2">{u.trustScore ?? '-'}</td>
                      <td className="px-2 py-2">{u.isActive == null ? '-' : u.isActive ? 'Y' : 'N'}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => createMeetingByBot(u.uid, u.email)}
                          disabled={!checked || saving || loading || creatingUid === u.uid}
                          className="rounded-lg bg-blue-600 text-white px-2 py-1.5 text-xs font-medium hover:bg-blue-500 disabled:opacity-50"
                        >
                          {creatingUid === u.uid ? '생성 중...' : '모임 생성'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-zinc-800">실행 로그</h2>
          <button
            type="button"
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            로그 초기화
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-2">
          이 브라우저 세션에서 실행한 작업만 표시합니다. 서버 상세 로그는 Vercel 콘솔에서 확인하세요.
        </p>
        <div className="max-h-80 overflow-auto font-mono text-xs text-zinc-700">
          {logs.length === 0 && <div className="text-zinc-500">로그 없음</div>}
          {logs.map((log) => (
            <div key={log.id} className="border-b border-zinc-100 py-1.5">
              [{new Date(log.ts).toLocaleString('ko-KR')}] [{log.level.toUpperCase()}]{' '}
              {log.message}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
