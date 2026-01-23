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

    // Get host nickname
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('nickname')
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

    // Combine meeting data with host nickname and user application status
    const response = {
      ...meetingData,
      host_nickname: hostData?.nickname || '',
      user_application: userApplication ? {
        id: userApplication.id,
        status: userApplication.status,
      } : null,
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

