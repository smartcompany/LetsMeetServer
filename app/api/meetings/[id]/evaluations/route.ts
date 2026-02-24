import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * 모임 평가 제출
 * meeting_rating: 1~5 (선택), participant_scores: { "userId": 1~5 } (선택)
 * 본인에게 점수 부여 불가
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const uid = user.firebaseUid;
    console.log('[evaluations] POST:', { meetingId: id, evaluatorUid: uid });

    const { data: meetingData, error: meetingError } = await supabase
      .from('letsmeet_meetings')
      .select('id, host_id, status')
      .eq('id', id)
      .single();

    if (meetingError || !meetingData) {
      console.error('[evaluations] Meeting not found:', id, meetingError);
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meetingData.status !== 'completed') {
      console.error('[evaluations] Meeting not completed:', { meetingId: id, status: meetingData.status });
      return NextResponse.json({ error: 'Meeting is not completed' }, { status: 400 });
    }

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

    const { data: existing } = await supabase
      .from('letsmeet_meeting_evaluations')
      .select('id')
      .eq('meeting_id', id)
      .eq('evaluator_user_id', uid)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }

    const body = await request.json();
    let meetingRating: number | null = body.meeting_rating ?? null;
    let participantScores: Record<string, number> =
      typeof body.participant_scores === 'object' && body.participant_scores !== null
        ? body.participant_scores
        : {};

    if (meetingRating != null) {
      const r = Number(meetingRating);
      if (r < 1 || r > 5 || !Number.isInteger(r)) {
        return NextResponse.json({ error: 'meeting_rating must be 1-5' }, { status: 400 });
      }
      meetingRating = r;
    }

    const validParticipantIds = participantIds.filter((x) => x !== uid);
    const cleanedScores: Record<string, number> = {};
    for (const [userId, score] of Object.entries(participantScores)) {
      if (!validParticipantIds.includes(userId)) continue;
      const s = Number(score);
      if (s < 1 || s > 5 || !Number.isInteger(s)) continue;
      cleanedScores[userId] = s;
    }

    const { error: insertError } = await supabase.from('letsmeet_meeting_evaluations').insert({
      meeting_id: id,
      evaluator_user_id: uid,
      meeting_rating: meetingRating,
      participant_scores: cleanedScores,
    });

    if (insertError) {
      console.error('Insert evaluation error:', insertError);
      return NextResponse.json({ error: 'Failed to submit evaluation' }, { status: 500 });
    }

    for (const [evaluatedUserId, score] of Object.entries(cleanedScores)) {
      const { data: userRow } = await supabase
        .from('letsmeet_users')
        .select('trust_score')
        .eq('user_id', evaluatedUserId)
        .single();

      if (userRow && typeof userRow.trust_score === 'number') {
        const delta = Math.round((score - 3) * 2);
        const next = Math.max(0, Math.min(100, userRow.trust_score + delta));
        await supabase
          .from('letsmeet_users')
          .update({ trust_score: next, updated_at: new Date().toISOString() })
          .eq('user_id', evaluatedUserId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to submit evaluation' },
      { status: 500 }
    );
  }
}
