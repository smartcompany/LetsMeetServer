import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { supabase } from "@/lib/db/supabase";
import { DashboardUser } from "@/lib/bot/types";
import { requireDashboardAuth } from "@/lib/bot/requireDashboardAuth";
import { countBotMeetings } from "@/lib/bot/countBotMeetings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireDashboardAuth(request);
  if (denied) return denied;

  try {
    const { auth } = getFirebaseAdmin();
    const { data, error } = await supabase
      .from("letsmeet_users")
      .select("user_id, full_name, trust_score, is_active, is_bot");

    if (error) {
      return NextResponse.json(
        { error: `Supabase query failed: ${error.message}` },
        { status: 500 }
      );
    }

    const profileRows = data ?? [];

    const firebaseUsers = await auth.listUsers(1000);
    const firebaseMap = new Map<
      string,
      { email: string | null; displayName: string | null; provider: string | null }
    >();
    for (const u of firebaseUsers.users) {
      const provider = u.providerData[0]?.providerId ?? null;
      firebaseMap.set(u.uid, {
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        provider,
      });
    }

    const users: DashboardUser[] = profileRows.map((row) => {
      const uid = row.user_id as string;
      const firebase = firebaseMap.get(uid);
      return {
        uid,
        email: firebase?.email ?? null,
        loginProvider: firebase?.provider ?? null,
        firebaseDisplayName: firebase?.displayName ?? null,
        profileName: (row.full_name as string | null) ?? null,
        trustScore: (row.trust_score as number | null) ?? null,
        isActive: (row.is_active as boolean | null) ?? null,
        isBot: (row.is_bot as boolean | null) ?? false,
      };
    });

    users.sort((a, b) => {
      const aKey = (a.profileName || a.email || a.uid || "").toLowerCase();
      const bKey = (b.profileName || b.email || b.uid || "").toLowerCase();
      return aKey.localeCompare(bKey);
    });

    const botMeetingsCount = await countBotMeetings();

    return NextResponse.json({ users, botMeetingsCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
