import { supabase } from "@/lib/db/supabase";

export async function countBotMeetings(): Promise<number> {
  const { data: bots, error: botsError } = await supabase
    .from("letsmeet_users")
    .select("user_id")
    .eq("is_bot", true);

  if (botsError) return 0;

  const uids = (bots ?? []).map((r) => r.user_id as string);
  if (uids.length === 0) return 0;

  const { count, error: countError } = await supabase
    .from("letsmeet_meetings")
    .select("id", { count: "exact", head: true })
    .in("host_id", uids);

  if (countError) return 0;
  return count ?? 0;
}
