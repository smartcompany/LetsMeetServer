import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

/**
 * 자동 모임 종료 처리
 * 모임 날짜가 지난 모임을 자동으로 completed 상태로 변경합니다.
 * 
 * 이 API는 스케줄러(예: Vercel Cron, GitHub Actions 등)에서 주기적으로 호출됩니다.
 * 예: 매일 자정에 실행
 */
export async function POST(request: NextRequest) {
  try {
    // API 키 검증 (선택사항, 보안 강화용)
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

    // 모임 날짜 + 1일이 지났고 아직 open 또는 closed 상태인 모임 찾기
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

    // 모든 만료된 모임을 completed 상태로 변경
    const meetingIds = expiredMeetings.map(m => m.id);
    const { data: updatedMeetings, error: updateError } = await supabase
      .from('letsmeet_meetings')
      .update({ status: 'completed' })
      .in('id', meetingIds)
      .select('id, title');

    if (updateError) {
      console.error('Update expired meetings error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update expired meetings' },
        { status: 500 }
      );
    }

    console.log(`✅ Auto-completed ${updatedMeetings?.length || 0} meetings`);

    return NextResponse.json({
      message: 'Meetings auto-completed successfully',
      count: updatedMeetings?.length || 0,
      meetings: updatedMeetings,
    });
  } catch (error) {
    console.error('Auto-complete meetings error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-complete meetings' },
      { status: 500 }
    );
  }
}
