import { NextRequest, NextResponse } from "next/server";
import { appendLog, readBotState, toBotStateApiError } from "@/lib/bot/botStore";
import type { BotLog } from "@/lib/bot/types";
import { requireDashboardAuth } from "@/lib/bot/requireDashboardAuth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { supabase } from "@/lib/db/supabase";
import { POST as createMeetingPost } from "../create-meeting/route";
import { POST as createApplicationPost } from "../create-application/route";
import { POST as approveApplicationsPost } from "../approve-applications/route";

export const runtime = "nodejs";

function shuffle<T>(list: T[]) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueStrings(list: string[]) {
  return [...new Set(list.filter((v) => v.length > 0))];
}

type CreateMeetingApiResponse =
  | {
      ok: true;
      meeting: {
        id: string;
        hostUid: string;
        title: string;
      };
    }
  | { error?: string };

type CreateApplicationApiResponse =
  | {
      ok: true;
      application: {
        id: string;
        meetingId: string;
        userId: string;
        status: string;
      };
    }
  | { error?: string };

type ApproveApplicationsApiResponse =
  | {
      ok: true;
      summary: {
        approvedNow: number;
        failedNow: number;
        skippedNow: number;
        closedNow: number;
      };
    }
  | { error?: string };

type MeetingCandidate = { id: string; hostUid: string; title: string };

async function loadPeerBotMeetings(peerUids: string[]): Promise<MeetingCandidate[]> {
  if (peerUids.length === 0) return [];
  const { data, error } = await supabase
    .from("letsmeet_meetings")
    .select("id, host_id, title")
    .in("host_id", peerUids)
    .eq("status", "open");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    hostUid: row.host_id as string,
    title: (row.title as string) || "",
  }));
}

export async function POST(request: NextRequest) {
  const isInternal = request.headers.get("x-dashboard-internal") === "1";
  if (!isInternal) {
    const denied = requireDashboardAuth(request);
    if (denied) return denied;
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const runLogs: BotLog[] = [];
  const log = (level: "info" | "warn" | "error", message: string) => {
    const entry = appendLog({
      level,
      message: `[simulate:${requestId}] ${message}`,
    });
    runLogs.push(entry);
  };

  try {
    const { config: cfg } = await readBotState();
    const isManualTrigger = request.headers.get("x-simulate-trigger") === "runNow";

    const bodyJson = (await request.json().catch(() => ({}))) as {
      selectedBotUids?: unknown;
      peerBotUids?: unknown;
    };
    const bots = Array.isArray(bodyJson.selectedBotUids)
      ? uniqueStrings(
          bodyJson.selectedBotUids.filter(
            (v): v is string => typeof v === "string" && v.length > 0
          )
        )
      : [];
    const peerBots = Array.isArray(bodyJson.peerBotUids)
      ? uniqueStrings(
          bodyJson.peerBotUids.filter(
            (v): v is string => typeof v === "string" && v.length > 0
          )
        )
      : [];
    const approveScope = peerBots.length > 0 ? uniqueStrings([...peerBots, ...bots]) : bots;

    log(
      "info",
      `시뮬레이션 시작: manual=${isManualTrigger}, selectedBots=${bots.length}, peers=${approveScope.length}, applyN=${cfg.applicationsPerRunPerBot}`
    );

    if (bots.length === 0) {
      log("warn", "선택된 봇 계정 없음");
      return NextResponse.json(
        { error: "선택된 봇 계정이 없습니다.", logs: runLogs },
        { status: 400 }
      );
    }

    const uidToEmail = new Map<string, string>();
    try {
      const { auth } = getFirebaseAdmin();
      const lookupUids = uniqueStrings([...bots, ...approveScope]);
      const result = await auth.getUsers(lookupUids.map((uid) => ({ uid })));
      for (const user of result.users) {
        if (user.email) uidToEmail.set(user.uid, user.email);
      }
    } catch (error) {
      log(
        "warn",
        `이메일 매핑 조회 실패(UID로 로그 대체): ${error instanceof Error ? error.message : "unknown"}`
      );
    }
    const actor = (uid: string) => uidToEmail.get(uid) ?? uid;

    const creators = bots;
    const appliers = bots;
    log("info", `역할 분리: creators=${creators.length}, appliers=${appliers.length}`);

    let createdNow = 0;
    let appliedNow = 0;
    let applyFailedNow = 0;
    let approvedNow = 0;
    let approveFailedNow = 0;
    let approveSkippedNow = 0;
    let skippedSelfApply = 0;
    let createFailedNow = 0;
    const candidateMeetings: MeetingCandidate[] = [];

    for (const uid of creators) {
      try {
        const hostEmail = uidToEmail.get(uid);
        const internalReq = new NextRequest(new URL(request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-dashboard-internal": "1",
          },
          body: JSON.stringify({ uid, email: hostEmail }),
        });
        const createRes = await createMeetingPost(internalReq);
        const body = (await createRes.json()) as CreateMeetingApiResponse;

        if (!createRes.ok || !("ok" in body) || !body.ok) {
          createFailedNow += 1;
          log(
            "error",
            `${actor(uid)} 모임 생성 실패: status=${createRes.status}, reason=${"error" in body ? (body.error ?? "unknown") : "unknown"}`
          );
          continue;
        }

        createdNow += 1;
        candidateMeetings.push({
          id: body.meeting.id,
          hostUid: body.meeting.hostUid,
          title: body.meeting.title,
        });
        log("info", `${actor(uid)} 이(가) "${body.meeting.title}" 모임을 생성했습니다.`);
      } catch (error) {
        createFailedNow += 1;
        log(
          "error",
          `${actor(uid)} 모임 생성 중 예외: ${error instanceof Error ? error.message : "unknown"}`
        );
      }
    }

    log(`info`, `모임 생성 단계 완료: created=${createdNow}, failed=${createFailedNow}`);

    // 순차 1명 처리 시에도 다른 선택 봇의 기존 open 모임에 신청 가능
    const existingPeerMeetings = await loadPeerBotMeetings(approveScope);
    const meetingById = new Map<string, MeetingCandidate>();
    for (const m of [...existingPeerMeetings, ...candidateMeetings]) {
      meetingById.set(m.id, m);
    }
    const applyPool = [...meetingById.values()];

    if (applyPool.length > 0) {
      for (const uid of appliers) {
        const maxApplies = Math.max(0, cfg.applicationsPerRunPerBot);
        if (maxApplies === 0) {
          skippedSelfApply += 1;
          continue;
        }

        const targetPool = applyPool.filter((meeting) => meeting.hostUid !== uid);
        if (targetPool.length === 0) {
          skippedSelfApply += 1;
          continue;
        }

        const selectedTargets = shuffle(targetPool).slice(0, Math.min(maxApplies, targetPool.length));
        for (const target of selectedTargets) {
          try {
            const applicantEmail = uidToEmail.get(uid);
            const internalReq = new NextRequest(new URL(request.url), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-dashboard-internal": "1",
              },
              body: JSON.stringify({ uid, email: applicantEmail, meetingId: target.id }),
            });
            const applyRes = await createApplicationPost(internalReq);
            const body = (await applyRes.json()) as CreateApplicationApiResponse;

            if (!applyRes.ok || !("ok" in body) || !body.ok) {
              applyFailedNow += 1;
              log(
                "warn",
                `${actor(uid)} 신청 실패: meeting="${target.title}", reason=${"error" in body ? (body.error ?? "unknown") : "unknown"}`
              );
              continue;
            }

            appliedNow += 1;
            log("info", `${actor(uid)} 이(가) "${target.title}" 모임에 신청을 했습니다.`);
          } catch (error) {
            applyFailedNow += 1;
            log(
              "error",
              `${actor(uid)} 신청 중 예외: ${error instanceof Error ? error.message : "unknown"}`
            );
          }
        }
      }
    } else {
      log("info", "신청 대상 모임 없음");
    }
    log(
      "info",
      `신청 단계 완료: applied=${appliedNow}, failed=${applyFailedNow}, selfSkipped=${skippedSelfApply}`
    );

    try {
      const approveReq = new NextRequest(new URL(request.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-internal": "1",
        },
        body: JSON.stringify({ selectedBotUids: approveScope }),
      });
      const approveRes = await approveApplicationsPost(approveReq);
      const approveBody = (await approveRes.json()) as ApproveApplicationsApiResponse;

      if (!approveRes.ok || !("ok" in approveBody) || !approveBody.ok) {
        log(
          "warn",
          `승인 단계 실패: reason=${"error" in approveBody ? (approveBody.error ?? "unknown") : "unknown"}`
        );
      } else {
        approvedNow = approveBody.summary.approvedNow;
        approveFailedNow = approveBody.summary.failedNow;
        approveSkippedNow = approveBody.summary.skippedNow;
        log(
          "info",
          `승인 단계 완료: approved=${approvedNow}, failed=${approveFailedNow}, skipped=${approveSkippedNow}, closed=${approveBody.summary.closedNow}`
        );
      }
    } catch (error) {
      log("error", `승인 단계 예외: ${error instanceof Error ? error.message : "unknown"}`);
    }

    log(
      "info",
      `tick 완료: creators=${creators.length}, created=${createdNow}, applied=${appliedNow}, approved=${approvedNow}`
    );

    return NextResponse.json({
      ok: true,
      logs: runLogs,
      summary: {
        selectedBots: bots.length,
        creators: creators.length,
        createdNow,
        createFailedNow,
        appliers: appliers.length,
        appliedNow,
        applyFailedNow,
        skippedSelfApply,
        approvedNow,
        approveFailedNow,
        approveSkippedNow,
        botMeetingsTotal: createdNow,
      },
    });
  } catch (error) {
    const apiError = toBotStateApiError(error);
    log("error", `simulate 예외: ${apiError.error}`);
    return NextResponse.json({ error: apiError.error, logs: runLogs }, { status: apiError.status });
  }
}
