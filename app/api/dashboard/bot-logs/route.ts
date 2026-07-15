import { NextRequest, NextResponse } from "next/server";
import { clearBotLogs, readBotLogs, toBotStateApiError } from "@/lib/bot/botStore";
import { requireDashboardAuth } from "@/lib/bot/requireDashboardAuth";
import { supabase } from "@/lib/db/supabase";

export const runtime = "nodejs";

async function countBotMeetings(): Promise<number> {
  const { data: bots } = await supabase
    .from("letsmeet_users")
    .select("user_id")
    .eq("is_bot", true);
  const uids = (bots ?? []).map((r) => r.user_id as string);
  if (uids.length === 0) return 0;
  const { count } = await supabase
    .from("letsmeet_meetings")
    .select("id", { count: "exact", head: true })
    .in("host_id", uids);
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const denied = requireDashboardAuth(request);
  if (denied) return denied;

  try {
    const logs = await readBotLogs();
    const botMeetingsCount = await countBotMeetings();
    return NextResponse.json({
      isRunning: false,
      logs,
      botMeetingsCount,
    });
  } catch (error) {
    const apiError = toBotStateApiError(error);
    return NextResponse.json({ error: apiError.error }, { status: apiError.status });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requireDashboardAuth(request);
  if (denied) return denied;

  try {
    await clearBotLogs();
    return NextResponse.json({
      ok: true,
      logs: [],
      botMeetingsCount: await countBotMeetings(),
    });
  } catch (error) {
    const apiError = toBotStateApiError(error);
    return NextResponse.json({ error: apiError.error }, { status: apiError.status });
  }
}
