import OpenAI from 'openai';
import { openAIConfig } from '@/app/api/_helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ReportVerdict = 'meeting_suspend' | 'needs_review' | 'no_issue';

const VERDICT_MAP: Record<string, ReportVerdict> = {
  meeting_suspend: 'meeting_suspend',
  needs_review: 'needs_review',
  no_issue: 'no_issue',
  '모임 정지': 'meeting_suspend',
  '검토 필요': 'needs_review',
  '문제 없음': 'no_issue',
};

/**
 * 신고된 콘텐츠(제목, 본문, 신고 사유)를 AI로 분류.
 * - meeting_suspend: 즉시 모임 정지 수준 (욕설/혐오/불법 등)
 * - needs_review: 사람이 검토해야 할 수준
 * - no_issue: 신고 사유가 맞지 않거나 문제 없음
 */
export async function classifyReport(params: {
  targetType: string;
  title: string;
  content: string;
  reportReason: string;
  reportDetail?: string;
}): Promise<ReportVerdict> {
  const { targetType, title, content, reportReason, reportDetail } = params;

  const prompt = `당신은 커뮤니티 콘텐츠(모임/피드) 신고를 분류하는 심사자입니다.
아래 "신고 대상 콘텐츠"와 "신고 사유"를 보고, 반드시 다음 세 가지 중 정확히 하나만 답하세요.

- meeting_suspend: 즉시 정지가 필요한 수준 (욕설·비방·혐오·스팸·불법·성적 노출·명백한 규정 위반)
- needs_review: 사람이 추가 검토가 필요한 수준 (애매한 표현, 맥락 필요)
- no_issue: 신고 사유가 맞지 않거나 문제 없는 수준 (악의적 신고, 오해 등)

답변은 반드시 한 줄에 meeting_suspend, needs_review, no_issue 중 하나만 출력하세요. 다른 설명 금지.

신고 대상 타입: ${targetType}
신고 대상 제목: ${title}
신고 대상 내용(본문): ${content || '(없음)'}
신고 사유: ${reportReason}
신고 상세: ${reportDetail || '(없음)'}`;

  const response = await openai.chat.completions.create({
    ...openAIConfig,
    max_completion_tokens: 50,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || '';
  const normalized = raw.replace(/\s/g, '_');
  for (const [key, verdict] of Object.entries(VERDICT_MAP)) {
    if (raw.includes(key.toLowerCase()) || normalized.includes(key.toLowerCase().replace(/\s/g, '_'))) {
      return verdict;
    }
  }
  if (raw.includes('meeting_suspend')) return 'meeting_suspend';
  if (raw.includes('needs_review')) return 'needs_review';
  if (raw.includes('no_issue')) return 'no_issue';
  return 'needs_review';
}
