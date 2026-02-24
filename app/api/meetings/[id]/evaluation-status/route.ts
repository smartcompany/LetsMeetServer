import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * 모임 평가 완료 여부 조회
 * 참가자(호스트+승인된 참가자)만 조회 가능
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: meetingData, error: meetingError } = await supabase
      .from('letsmeet_meetings')
      .select('id, host_id, status')
      .eq('id', id)
      .single();

    if (meetingError || !meetingData) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meetingData.status !== 'completed') {
      return NextResponse.json({ error: 'Meeting is not completed' }, { status: 400 });
    }

    const uid = user.firebaseUid;

    const { data: approvedApps } = await supabase
      .from('letsmeet_applications')
      .select('user_id')
      .eq('meeting_id', id)
      .eq('status', 'approved');

    const participantIds = [
      meetingData.host_id,
      ...(approvedApps || []).map((a: { user_id: string }) => a.user_id),
    ].filter((x, i, arr) => arr.indexOf(x) === i);

    if (!participantIds.includes(uid)) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const { data: evalData } = await supabase
      .from('letsmeet_meeting_evaluations')
      .select('id')
      .eq('meeting_id', id)
      .eq('evaluator_user_id', uid)
      .maybeSingle();

    return NextResponse.json({ submitted: !!evalData });
  } catch (error) {
    console.error('Evaluation status error:', error);
    return NextResponse.json(
      { error: 'Failed to get evaluation status' },
      { status: 500 }
    );
  }
}
