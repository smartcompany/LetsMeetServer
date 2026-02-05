import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    // 인증 실패해도 모임 정보는 반환 (비로그인 사용자도 모임을 볼 수 있어야 함)

    const { id } = await params;

    const { data: meetingData, error: meetingError } = await supabase
      .from('letsmeet_meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError || !meetingData) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Get host info (name, profile image)
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('full_name, profile_image_url')
      .eq('user_id', meetingData.host_id)
      .single();

    // Check if current user has applied to this meeting (로그인한 경우만)
    let userApplication = null;
    if (user) {
      const { data: applicationData } = await supabase
        .from('letsmeet_applications')
        .select('id, status')
        .eq('meeting_id', id)
        .eq('user_id', user.firebaseUid)
        .maybeSingle(); // single() 대신 maybeSingle() 사용 (신청이 없을 수도 있음)
      
      userApplication = applicationData || null;
    }

    // Get approved participants (호스트 + 승인된 신청자)
    const { data: approvedApps } = await supabase
      .from('letsmeet_applications')
      .select('user_id')
      .eq('meeting_id', id)
      .eq('status', 'approved');

    const participantIds = [meetingData.host_id, ...(approvedApps || []).map((a: { user_id: string }) => a.user_id).filter((uid: string) => uid !== meetingData.host_id)];

    const participants = await Promise.all(
      [...new Set(participantIds)].map(async (userId: string) => {
        const { data: u } = await supabase
          .from('letsmeet_users')
          .select('user_id, full_name, profile_image_url, bio')
          .eq('user_id', userId)
          .single();
        if (!u) return null;
        return {
          user_id: u.user_id,
          full_name: u.full_name || '',
          profile_image_url: u.profile_image_url || null,
          bio: u.bio || null,
        };
      })
    );

    // Combine meeting data with host info and user application status
    const response = {
      ...meetingData,
      host_name: hostData?.full_name || '',
      host_profile_image_url: hostData?.profile_image_url || null,
      user_application: userApplication ? {
        id: userApplication.id,
        status: userApplication.status,
      } : null,
      participants: participants.filter(Boolean),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to get meeting' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();

    // Verify user is the host
    const { data: meetingData } = await supabase
      .from('letsmeet_meetings')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!meetingData || meetingData.host_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.meeting_date !== undefined) updateData.meeting_date = body.meeting_date;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.location_detail !== undefined) updateData.location_detail = body.location_detail;
    if (body.max_participants !== undefined) updateData.max_participants = body.max_participants;
    if (body.interests !== undefined) updateData.interests = body.interests;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.participation_fee !== undefined) updateData.participation_fee = body.participation_fee;
    if (body.gender_restriction !== undefined) updateData.gender_restriction = body.gender_restriction;
    if (body.age_range_min !== undefined) updateData.age_range_min = body.age_range_min;
    if (body.age_range_max !== undefined) updateData.age_range_max = body.age_range_max;
    if (body.approval_type !== undefined) updateData.approval_type = body.approval_type;
    if (body.image_urls !== undefined) updateData.image_urls = body.image_urls;
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabase
      .from('letsmeet_meetings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update meeting error:', error);
      return NextResponse.json(
        { error: 'Failed to update meeting' },
        { status: 500 }
      );
    }

    // Get host name
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('full_name')
      .eq('user_id', user.firebaseUid)
      .single();

    const response = {
      ...data,
      host_name: hostData?.full_name || '',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to update meeting' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify user is the host
    const { data: meetingData } = await supabase
      .from('letsmeet_meetings')
      .select('host_id')
      .eq('id', id)
      .single();

    if (!meetingData || meetingData.host_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the meeting (완료된 모임도 삭제 가능)
    const { error } = await supabase
      .from('letsmeet_meetings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete meeting error:', error);
      return NextResponse.json(
        { error: 'Failed to delete meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to delete meeting' },
      { status: 500 }
    );
  }
}
