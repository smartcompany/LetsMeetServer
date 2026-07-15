import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/bot/botStore";
import { requireDashboardAuth } from "@/lib/bot/requireDashboardAuth";
import { POST as simulatePost } from "../simulate/route";

export const runtime = "nodejs";

/** 대시보드에서 봇 1명(또는 소수)에 대한 시뮬레이션 1회 실행 */
export async function POST(request: NextRequest) {
  const denied = requireDashboardAuth(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    selectedBotUids?: unknown;
    peerBotUids?: unknown;
  };
  const selectedBotUids = Array.isArray(body.selectedBotUids)
    ? body.selectedBotUids.filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];
  const peerBotUids = Array.isArray(body.peerBotUids)
    ? body.peerBotUids.filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];

  const internalReq = new NextRequest(new URL(request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-simulate-trigger": "runNow",
      "x-dashboard-internal": "1",
    },
    body: JSON.stringify({ selectedBotUids, peerBotUids }),
  });

  appendLog({
    level: "info",
    message: `시뮬레이션 실행: bots=${selectedBotUids.length}, peers=${peerBotUids.length || selectedBotUids.length}`,
  });

  const res = await simulatePost(internalReq);
  const resBody = await res.json();
  return NextResponse.json(resBody, { status: res.status });
}
