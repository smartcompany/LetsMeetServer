import meetingImagePoolJson from "@/app/api/dashboard/bot-control/create-meeting/meeting-image-pool.json";
import { supabase } from "@/lib/db/supabase";

export type MeetingImagePool = {
  defaults?: string[];
  byMainCategory?: Record<string, string[]>;
  bySubCategory?: Record<string, string[]>;
};

const meetingImagePool = meetingImagePoolJson as MeetingImagePool;

function pickRandom<T>(arr: readonly T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function collectMeetingImageCandidates(
  mainCategory: string,
  subCategory: string,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushUnique = (urls: string[] | undefined) => {
    for (const url of urls ?? []) {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      ordered.push(trimmed);
    }
  };

  pushUnique(meetingImagePool.bySubCategory?.[subCategory]);
  pushUnique(meetingImagePool.byMainCategory?.[mainCategory]);
  pushUnique(meetingImagePool.defaults);

  return ordered;
}

export function collectAllMeetingImageUrls(): string[] {
  const seen = new Set<string>();
  const all: string[] = [];

  const pushUnique = (urls: string[] | undefined) => {
    for (const url of urls ?? []) {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      all.push(trimmed);
    }
  };

  for (const urls of Object.values(meetingImagePool.bySubCategory ?? {})) {
    pushUnique(urls);
  }
  for (const urls of Object.values(meetingImagePool.byMainCategory ?? {})) {
    pushUnique(urls);
  }
  pushUnique(meetingImagePool.defaults);

  return all;
}

export function pickMeetingImageUrl(
  mainCategory: string,
  subCategory: string,
  excludeUrls: ReadonlySet<string> = new Set(),
): string | null {
  const candidates = collectMeetingImageCandidates(mainCategory, subCategory);
  const available = candidates.filter((url) => !excludeUrls.has(url));
  if (available.length > 0) return pickRandom(available);

  const fallbackPool = shuffle(collectAllMeetingImageUrls()).filter(
    (url) => !excludeUrls.has(url),
  );
  if (fallbackPool.length > 0) return fallbackPool[0] ?? null;

  return pickRandom(candidates) ?? pickRandom(collectAllMeetingImageUrls());
}

/** 최근 open 모임에서 사용 중인 커버 이미지 URL (중복 방지용) */
export async function fetchRecentlyUsedMeetingImageUrls(
  limit = 50,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("letsmeet_meetings")
    .select("image_urls, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return new Set();

  const used = new Set<string>();
  for (const row of data) {
    const urls = row.image_urls;
    if (!Array.isArray(urls)) continue;
    for (const url of urls) {
      if (typeof url === "string" && url.trim()) used.add(url.trim());
    }
  }
  return used;
}
