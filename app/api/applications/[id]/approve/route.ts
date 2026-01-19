import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get application and verify host
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*, meetings(host_id, max_participants)')
      .eq('id', params.id)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    const meeting = application.meetings as any;
    if (meeting.host_id !== user.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if meeting is full
    const { count: approvedCount } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', application.meeting_id)
      .eq('status', 'approved');

    if ((approvedCount || 0) >= meeting.max_participants) {
      return NextResponse.json(
        { error: 'Meeting is full' },
        { status: 400 }
      );
    }

    // Approve application
    const { data, error } = await supabase
      .from('applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to approve application' },
        { status: 500 }
      );
    }

    // Check if meeting is now full and close it
    const { count: newApprovedCount } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', application.meeting_id)
      .eq('status', 'approved');

    if ((newApprovedCount || 0) >= meeting.max_participants) {
      await supabase
        .from('meetings')
        .update({ status: 'closed' })
        .eq('id', application.meeting_id);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Approve application error:', error);
    return NextResponse.json(
      { error: 'Failed to approve application' },
      { status: 500 }
    );
  }
}

