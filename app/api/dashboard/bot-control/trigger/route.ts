import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/bot/botStore";
import { requireDashboardAuth } from "@/lib/bot/requireDashboardAuth";
import { POST as simulatePost } from "../simulate/route";

export const runtime = "nodejs";

/** 대시보드에서 "1회 시뮬레이션" 요청 시 simulate tick 1회 실행 */
export async function POST(request: NextRequest) {
  const denied = requireDashboardAuth(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    selectedBotUids?: unknown;
  };
  const selectedBotUids = Array.isArray(body.selectedBotUids)
    ? body.selectedBotUids.filter(
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
    body: JSON.stringify({ selectedBotUids }),
  });

  await appendLog({
    level: "info",
    message: `1회 시뮬레이션 즉시 실행 (선택 봇 ${selectedBotUids.length}개)`,
  });

  const res = await simulatePost(internalReq);
  const resBody = await res.json();
  return NextResponse.json(resBody, { status: res.status });
}
