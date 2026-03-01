import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

/**
 * 자동 모임 종료 처리
 * 모임 날짜가 지난 모임을 자동으로 completed 상태로 변경합니다.
 * 신고가 있는 모임은 AI 판단(ai_verdict)에 따라 suspended / under_review 로 설정합니다.
 *
 * 이 API는 스케줄러(예: Vercel Cron, GitHub Actions 등)에서 주기적으로 호출됩니다.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.CRON_SECRET;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - oneDayMs);

    const { data: expiredMeetings, error: queryError } = await supabase
      .from('letsmeet_meetings')
      .select('id, title, meeting_date, status')
      .in('status', ['open', 'closed'])
      .lt('meeting_date', cutoff.toISOString());

    if (queryError) {
      console.error('Query expired meetings error:', queryError);
      return NextResponse.json(
        { error: 'Failed to query expired meetings' },
        { status: 500 }
      );
    }

    if (!expiredMeetings || expiredMeetings.length === 0) {
      return NextResponse.json({
        message: 'No expired meetings to complete',
        count: 0,
      });
    }

    const meetingIds = expiredMeetings.map((m) => m.id);

    // 해당 모임에 대한 신고 중 AI 판단이 내려진 것만 조회 (가장 강한 판단 기준 적용)
    const { data: reports } = await supabase
      .from('letsmeet_reports')
      .select('target_id, ai_verdict')
      .eq('target_type', 'meeting')
      .in('target_id', meetingIds)
      .not('ai_verdict', 'is', null);

    const meetingVerdict = new Map<string, 'meeting_suspend' | 'needs_review'>();
    for (const r of reports || []) {
      const id = r.target_id as string;
      const v = r.ai_verdict as string;
      const current = meetingVerdict.get(id);
      if (v === 'meeting_suspend') {
        meetingVerdict.set(id, 'meeting_suspend');
      } else if (v === 'needs_review' && current !== 'meeting_suspend') {
        meetingVerdict.set(id, 'needs_review');
      }
    }

    const toComplete: string[] = [];
    const toSuspended: string[] = [];
    const toUnderReview: string[] = [];
    for (const id of meetingIds) {
      const v = meetingVerdict.get(id);
      if (v === 'meeting_suspend') toSuspended.push(id);
      else if (v === 'needs_review') toUnderReview.push(id);
      else toComplete.push(id);
    }

    const results: { id: string; title?: string; status: string }[] = [];

    if (toSuspended.length > 0) {
      const { data: updated } = await supabase
        .from('letsmeet_meetings')
        .update({ status: 'suspended' })
        .in('id', toSuspended)
        .select('id, title');
      (updated || []).forEach((m) => results.push({ ...m, status: 'suspended' }));
    }
    if (toUnderReview.length > 0) {
      const { data: updated } = await supabase
        .from('letsmeet_meetings')
        .update({ status: 'under_review' })
        .in('id', toUnderReview)
        .select('id, title');
      (updated || []).forEach((m) => results.push({ ...m, status: 'under_review' }));
    }
    if (toComplete.length > 0) {
      const { data: updated } = await supabase
        .from('letsmeet_meetings')
        .update({ status: 'completed' })
        .in('id', toComplete)
        .select('id, title');
      (updated || []).forEach((m) => results.push({ ...m, status: 'completed' }));
    }

    console.log(
      `✅ Auto-complete: completed=${toComplete.length}, suspended=${toSuspended.length}, under_review=${toUnderReview.length}`
    );

    return NextResponse.json({
      message: 'Meetings auto-completed successfully',
      count: results.length,
      meetings: results,
      summary: {
        completed: toComplete.length,
        suspended: toSuspended.length,
        under_review: toUnderReview.length,
      },
    });
  } catch (error) {
    console.error('Auto-complete meetings error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-complete meetings' },
      { status: 500 }
    );
  }
}
