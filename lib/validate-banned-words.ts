/**
 * 금지어 목록으로 텍스트 검사.
 * 금지어는 lib/banned-words.json 에 두고, 4000개 등으로 확장 가능.
 */
import bannedWordsJson from './banned-words.json';

const words: string[] = Array.isArray(bannedWordsJson) ? (bannedWordsJson as string[]) : [];

/**
 * 텍스트에 금지어가 포함되어 있으면 해당 금지어를 반환, 없으면 null.
 */
export function checkBannedWords(text: string): string | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  for (const word of words) {
    const w = (word || '').trim();
    if (!w) continue;
    if (lower.includes(w.toLowerCase())) {
      return w;
    }
  }
  return null;
}
