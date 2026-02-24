import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/users/me/pending-evaluations
 * 참가했고 완료되었으며 아직 평가하지 않은 모임 목록
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const uid = user.firebaseUid;

    // 내가 참가한 completed 모임 (호스트이거나 승인된 신청자)
    const { data: hosted } = await supabase
      .from('letsmeet_meetings')
      .select('id, title')
      .eq('status', 'completed')
      .eq('host_id', uid);

    const { data: approvedApps } = await supabase
      .from('letsmeet_applications')
      .select('meeting_id')
      .eq('user_id', uid)
      .eq('status', 'approved');

    const participantMeetingIds = new Set<string>();
    for (const m of hosted || []) {
      participantMeetingIds.add(m.id);
    }
    for (const a of approvedApps || []) {
      participantMeetingIds.add(a.meeting_id);
    }

    if (participantMeetingIds.size === 0) {
      return NextResponse.json([]);
    }

    const { data: evaluated } = await supabase
      .from('letsmeet_meeting_evaluations')
      .select('meeting_id')
      .eq('evaluator_user_id', uid)
      .in('meeting_id', Array.from(participantMeetingIds));

    const evaluatedIds = new Set((evaluated || []).map((e) => e.meeting_id));
    const pendingIds = Array.from(participantMeetingIds).filter(
      (id) => !evaluatedIds.has(id)
    );

    if (pendingIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: meetings } = await supabase
      .from('letsmeet_meetings')
      .select('id, title')
      .in('id', pendingIds);

    return NextResponse.json(meetings || []);
  } catch (error) {
    console.error('Get pending evaluations error:', error);
    return NextResponse.json(
      { error: 'Failed to get pending evaluations' },
      { status: 500 }
    );
  }
}
