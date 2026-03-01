import OpenAI from 'openai';
import { openAIConfig } from '@/app/api/_helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ReportVerdict = 'meeting_suspend' | 'needs_review' | 'no_issue';

export type ClassifyReportResult = {
  verdict: ReportVerdict;
  reason: string;
};

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
 * 반환: { verdict, reason } — 판단 + 판단 사유(로깅·검토용)
 */
export async function classifyReport(params: {
  targetType: string;
  title: string;
  content: string;
  reportReason: string;
  reportDetail?: string;
}): Promise<ClassifyReportResult> {
  const { targetType, title, content, reportReason, reportDetail } = params;

  const prompt = `당신은 커뮤니티 콘텐츠(모임/피드) 신고를 분류하는 심사자입니다.
아래 "신고 대상 콘텐츠"와 "신고 사유"를 보고 판단해주세요.

[판단 기준]
- meeting_suspend: 즉시 정지가 필요한 수준 (욕설·비방·혐오·스팸·불법·성적 노출·명백한 규정 위반)
- needs_review: 사람이 추가 검토가 필요한 수준 (애매한 표현, 맥락 필요)
- no_issue: 신고 사유가 맞지 않거나 문제 없는 수준 (악의적 신고, 오해 등)

[답변 형식] 반드시 아래 두 줄만 출력하세요. 다른 내용 금지.
1줄: meeting_suspend, needs_review, no_issue 중 정확히 하나
2줄: 사유: (한두 문장으로 판단 사유 설명)

예시:
needs_review
사유: 신고 사유는 혐오 표현이나만, 맥락상 농담으로 보일 여지가 있어 사람 검토가 필요함.

신고 대상 타입: ${targetType}
신고 대상 제목: ${title}
신고 대상 내용(본문): ${content || '(없음)'}
신고 사유: ${reportReason}
신고 상세: ${reportDetail || '(없음)'}`;

  const response = await openai.chat.completions.create({
    ...openAIConfig,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim() || '';
  const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);

  let verdict: ReportVerdict = 'needs_review';
  const firstLine = (lines[0] || '').toLowerCase();
  const normalizedFirst = firstLine.replace(/\s/g, '_');
  for (const [key, v] of Object.entries(VERDICT_MAP)) {
    if (firstLine.includes(key.toLowerCase()) || normalizedFirst.includes(key.toLowerCase().replace(/\s/g, '_'))) {
      verdict = v;
      break;
    }
  }
  if (verdict === 'needs_review') {
    if (firstLine.includes('meeting_suspend')) verdict = 'meeting_suspend';
    else if (firstLine.includes('no_issue')) verdict = 'no_issue';
  }

  let reason = '';
  const reasonLine = lines.slice(1).find((l) => /사유\s*[:：]/.test(l) || l.length > 5);
  if (reasonLine) {
    reason = reasonLine.replace(/^사유\s*[:：]\s*/i, '').trim();
  } else if (lines.length > 1) {
    reason = lines.slice(1).join(' ').trim();
  }
  if (!reason) reason = '(사유 없음)';

  return { verdict, reason };
}
