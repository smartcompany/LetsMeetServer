'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BotConfig, BotLog, DashboardUser } from '@/lib/bot/types';

const API = process.env.NEXT_PUBLIC_API_BASE || '';

type LogsResponse = { isRunning: boolean; logs: BotLog[]; botMeetingsCount: number };

const defaultConfig: BotConfig = {
  creatorRatio: 0.4,
  applicationsPerRunPerBot: 2,
  applyOnlyToBotMeetings: true,
  updatedAt: '',
};

export default function BotControlPanel() {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [botMeetingsCount, setBotMeetingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [deletingMeetings, setDeletingMeetings] = useState(false);
  const [creatingUid, setCreatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshLogsOnly() {
    try {
      const logsRes = await fetch(`${API}/api/dashboard/bot-logs`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!logsRes.ok) return;
      const logsJson = (await logsRes.json()) as LogsResponse;
      setLogs(logsJson.logs);
      setBotMeetingsCount(logsJson.botMeetingsCount);
    } catch {
      // ignore
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, configRes, logsRes] = await Promise.all([
        fetch(`${API}/api/dashboard/bot-users`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API}/api/dashboard/bot-config`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API}/api/dashboard/bot-logs`, { cache: 'no-store', credentials: 'include' }),
      ]);

      if (!usersRes.ok) throw new Error(`users API 실패: ${usersRes.status}`);
      if (!configRes.ok) throw new Error(`config API 실패: ${configRes.status}`);
      if (!logsRes.ok) throw new Error(`logs API 실패: ${logsRes.status}`);

      const usersJson = (await usersRes.json()) as { users: DashboardUser[] };
      const configJson = (await configRes.json()) as { config: BotConfig };
      const logsJson = (await logsRes.json()) as LogsResponse;

      setUsers(usersJson.users);
      setConfig(configJson.config);
      setLogs(logsJson.logs);
      setBotMeetingsCount(logsJson.botMeetingsCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!simulating) return;
    const intervalId = setInterval(() => {
      void refreshLogsOnly();
    }, 1000);
    return () => clearInterval(intervalId);
  }, [simulating]);

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
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 오류');
    } finally {
      setSaving(false);
    }
  }

  async function runSimulateOnce() {
    const botUids = selectedUsers.map((u) => u.uid);
    if (botUids.length === 0) {
      setError('1회 실행할 봇 계정을 먼저 체크하세요.');
      return;
    }
    setSimulating(true);
    setSaving(true);
    setError(null);
    try {
      await refreshLogsOnly();
      const res = await fetch(`${API}/api/dashboard/bot-control/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ selectedBotUids: botUids }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `요청 실패: ${res.status}`);
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 오류');
      await refreshLogsOnly();
    } finally {
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
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `모임 생성 실패: ${res.status}`);
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 생성 오류');
      await refreshLogsOnly();
    } finally {
      setCreatingUid(null);
      setSaving(false);
    }
  }

  async function clearLogs() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/dashboard/bot-logs`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `로그 초기화 실패: ${res.status}`);
      }
      const body = (await res.json()) as { logs?: BotLog[]; botMeetingsCount?: number };
      setLogs(Array.isArray(body.logs) ? body.logs : []);
      if (typeof body.botMeetingsCount === 'number') {
        setBotMeetingsCount(body.botMeetingsCount);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그 초기화 오류');
    } finally {
      setSaving(false);
    }
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
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `모임 삭제 실패: ${res.status}`);
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '모임 삭제 오류');
      await refreshLogsOnly();
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
            {simulating ? '실행 중...' : '지금 1회 실행 (simulate)'}
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
            disabled={saving || loading}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            로그 초기화
          </button>
        </div>
        <div className="max-h-80 overflow-auto font-mono text-xs text-zinc-700">
          {logs.length === 0 && <div className="text-zinc-500">로그 없음</div>}
          {[...logs].reverse().map((log) => (
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
