import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';
import { classifyReport } from '@/lib/report-classify';

/**
 * POST /api/reports
 * Body: { target_type, target_id, target_user_id, reason, detail?, extra? }
 * - 신고 저장 후 AI로 분류 (meeting_suspend | needs_review | no_issue)
 * - 모임 정지/검토 중 설정은 신고 시점이 아니라 auto-complete(complete_meeting) 액션에서 처리
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const targetType = body.target_type || body.targetType;
    const targetId = body.target_id || body.targetId;
    const targetUserId = body.target_user_id || body.targetUserId;
    const reason = body.reason;
    const detail = body.detail;
    const extra = body.extra;

    if (!targetType || !targetId || !targetUserId || !reason) {
      return NextResponse.json(
        { error: 'target_type, target_id, target_user_id, reason are required' },
        { status: 400 }
      );
    }

    const { data: reportRow, error: insertError } = await supabase
      .from('letsmeet_reports')
      .insert({
        reporter_user_id: user.firebaseUid,
        target_type: targetType,
        target_id: targetId,
        target_user_id: targetUserId,
        reason: String(reason),
        detail: detail ? String(detail) : null,
        extra: extra || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[reports] insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save report' },
        { status: 500 }
      );
    }

    let title = '';
    let content = '';

    if (targetType === 'meeting') {
      const { data: meeting } = await supabase
        .from('letsmeet_meetings')
        .select('id, title, description')
        .eq('id', targetId)
        .single();
      if (meeting) {
        title = meeting.title || '';
        content = meeting.description || '';
      }
    } else if (targetType === 'feed') {
      const { data: feed } = await supabase
        .from('letsmeet_feeds')
        .select('id, content')
        .eq('id', targetId)
        .single();
      if (feed) {
        title = '';
        content = feed.content || '';
      }
    } else if (targetType === 'comment') {
      const { data: comment } = await supabase
        .from('letsmeet_feed_comments')
        .select('id, content')
        .eq('id', targetId)
        .single();
      if (comment) {
        title = '';
        content = comment.content || '';
      }
    }

    let aiVerdict: 'meeting_suspend' | 'needs_review' | 'no_issue' = 'needs_review';
    let aiReason = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await classifyReport({
          targetType,
          title,
          content,
          reportReason: reason,
          reportDetail: detail,
        });
        aiVerdict = result.verdict;
        aiReason = result.reason || '';
        console.log('[reports] AI 분류 결과', {
          reportId: reportRow.id,
          targetType,
          targetId,
          verdict: aiVerdict,
          reason: aiReason,
        });
      } catch (e) {
        console.error('[reports] AI classify error:', e);
      }
    }

    await supabase
      .from('letsmeet_reports')
      .update({
        ai_verdict: aiVerdict,
        ai_verdict_at: new Date().toISOString(),
        ai_reason: aiReason || null,
      })
      .eq('id', reportRow.id);

    // 정지/검토 중 설정은 신고 시점이 아니라 complete_meeting(auto-complete) 액션에서 처리

    return NextResponse.json(
      { id: reportRow.id, ai_verdict: aiVerdict },
      { status: 201 }
    );
  } catch (e) {
    console.error('[reports] error:', e);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}
