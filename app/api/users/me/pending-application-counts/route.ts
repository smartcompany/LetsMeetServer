import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/users/me/pending-application-counts
 * Returns { [meetingId]: pendingCount } for meetings hosted by the current user
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

    const { data: meetings } = await supabase
      .from('letsmeet_meetings')
      .select('id')
      .eq('host_id', user.firebaseUid)
      .in('status', ['open', 'closed']);

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({});
    }

    const meetingIds = meetings.map((m) => m.id);

    const { data: applications } = await supabase
      .from('letsmeet_applications')
      .select('meeting_id')
      .in('meeting_id', meetingIds)
      .eq('status', 'pending');

    const counts: Record<string, number> = {};
    for (const id of meetingIds) {
      counts[id] = 0;
    }
    for (const app of applications || []) {
      counts[app.meeting_id] = (counts[app.meeting_id] ?? 0) + 1;
    }

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Get pending counts error:', error);
    return NextResponse.json(
      { error: 'Failed to get pending counts' },
      { status: 500 }
    );
  }
}
