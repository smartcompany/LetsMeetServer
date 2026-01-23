import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if user is the host
    const { data: meeting } = await supabase
      .from('letsmeet_meetings')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!meeting || meeting.host_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('letsmeet_applications')
      .select('*, letsmeet_users!user_id(id, nickname, profile_image_url, trust_score)')
      .eq('meeting_id', id)
      .order('applied_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to get applications' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Get applications error:', error);
    return NextResponse.json(
      { error: 'Failed to get applications' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if meeting exists and is open
    const { data: meeting, error: meetingError } = await supabase
      .from('letsmeet_meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    if (meeting.status !== 'open') {
      return NextResponse.json(
        { error: 'Meeting is not open for applications' },
        { status: 400 }
      );
    }

    // Check if user is already applied
    const { data: existingApplication } = await supabase
      .from('letsmeet_applications')
      .select('id')
      .eq('meeting_id', id)
      .eq('user_id', user.firebaseUid)
      .single();

    if (existingApplication) {
      return NextResponse.json(
        { error: 'Already applied to this meeting' },
        { status: 400 }
      );
    }

    // Check current approved count
    const { count: approvedCount } = await supabase
      .from('letsmeet_applications')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', id)
      .eq('status', 'approved');

    if ((approvedCount || 0) >= meeting.max_participants) {
      return NextResponse.json(
        { error: 'Meeting is full' },
        { status: 400 }
      );
    }

    // Check user trust score for application limits
    const { data: userData } = await supabase
      .from('letsmeet_users')
      .select('trust_score')
      .eq('user_id', user.firebaseUid)
      .single();

    if (!userData || userData.trust_score < 10) {
      return NextResponse.json(
        { error: 'Insufficient trust score to apply' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('letsmeet_applications')
      .insert({
        meeting_id: id,
        user_id: user.firebaseUid,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to apply to meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Apply to meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to apply to meeting' },
      { status: 500 }
    );
  }
}

