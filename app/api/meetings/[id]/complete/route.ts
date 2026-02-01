import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * 모임 종료 처리
 * 호스트만 모임을 종료할 수 있습니다.
 */
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

    // Verify user is the host
    const { data: meetingData, error: meetingError } = await supabase
      .from('letsmeet_meetings')
      .select('host_id, status, meeting_date')
      .eq('id', id)
      .single();

    if (meetingError || !meetingData) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    if (meetingData.host_id !== user.firebaseUid) {
      return NextResponse.json(
        { error: 'Only the host can complete the meeting' },
        { status: 403 }
      );
    }

    // 이미 종료된 모임인지 확인
    if (meetingData.status === 'completed' || meetingData.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Meeting is already completed or cancelled' },
        { status: 400 }
      );
    }

    // 모임 상태를 completed로 변경
    const { data, error } = await supabase
      .from('letsmeet_meetings')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Complete meeting error:', error);
      return NextResponse.json(
        { error: 'Failed to complete meeting' },
        { status: 500 }
      );
    }

    // Get host nickname
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('nickname')
      .eq('user_id', user.firebaseUid)
      .single();

    const response = {
      ...data,
      host_nickname: hostData?.nickname || '',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Complete meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to complete meeting' },
      { status: 500 }
    );
  }
}
