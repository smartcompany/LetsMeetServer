import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyToken } from '@/lib/middleware/auth';
import { openAIConfig } from '../../_helpers';
import meetingIntroductionPrompt from './meeting-introduction.txt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/ai/meeting-introduction
 * 사용자가 입력한 내용을 바탕으로 AI가 모임 소개 문구 다듬기 (20-500자)
 * Body: { content: string } - 모임 소개 입력창에 사용자가 작성한 내용
 * Returns: { introduction: string }
 */
export async function POST(request: NextRequest) {
  try {
    await verifyToken(request);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const content = (body.content as string) || '';

    const prompt = (meetingIntroductionPrompt as string).replace(
      '{{CONTENT}}',
      content || '(사용자 입력 없음)'
    );

    const response = await openai.chat.completions.create({
      ...openAIConfig,
      max_completion_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const introduction = response.choices[0]?.message?.content?.trim();

    if (!introduction) {
      return NextResponse.json(
        { error: 'AI가 모임 소개를 생성하지 못했습니다.' },
        { status: 500 }
      );
    }

    // 500자 초과 시 자르기
    const trimmed = introduction.length > 500 ? introduction.slice(0, 500) : introduction;

    return NextResponse.json({ introduction: trimmed });
  } catch (e) {
    console.error('[ai/meeting-introduction]', e);
    return NextResponse.json(
      { error: '모임 소개 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
