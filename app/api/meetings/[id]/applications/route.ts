import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';
import { sendFcmToUser } from '@/lib/firebase/messaging';

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

    const { data: applications, error: appError } = await supabase
      .from('letsmeet_applications')
      .select('*')
      .eq('meeting_id', id)
      .order('applied_at', { ascending: false });

    if (appError) {
      console.error('Get applications error:', appError);
      return NextResponse.json(
        { error: 'Failed to get applications' },
        { status: 500 }
      );
    }

    // 각 신청에 대해 사용자 정보 조회
    const applicationsWithUsers = await Promise.all(
      (applications || []).map(async (app) => {
        const { data: userData } = await supabase
          .from('letsmeet_users')
          .select('user_id, full_name, profile_image_url, trust_score')
          .eq('user_id', app.user_id)
          .single();

        return {
          ...app,
          letsmeet_users: userData || null,
        };
      })
    );

    return NextResponse.json(applicationsWithUsers || []);
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
    let body: { answer1?: string; answer2?: string } = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body가 없거나 빈 경우도 허용
      console.log('🔵 [Server] 요청 본문이 없거나 파싱 실패 (정상일 수 있음)');
    }
    const { answer1, answer2 } = body;
    console.log('🔵 [Server] 요청 본문:', body);
    console.log('🔵 [Server] answer1:', answer1);
    console.log('🔵 [Server] answer2:', answer2);

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

    console.log('🔵 [Server] 신청 데이터 준비');
    console.log('🔵 [Server] meeting_id:', id);
    console.log('🔵 [Server] user_id:', user.firebaseUid);
    console.log('🔵 [Server] answer1:', answer1);
    console.log('🔵 [Server] answer2:', answer2);

    // 즉시 참여 모임은 신청 시 자동 승인
    const initialStatus =
      meeting.approval_type === 'immediate' ? 'approved' : 'pending';

    const insertData: any = {
      meeting_id: id,
      user_id: user.firebaseUid,
      status: initialStatus,
    };

    // answer1과 answer2는 선택사항이므로 값이 있을 때만 추가
    if (answer1 && typeof answer1 === 'string' && answer1.trim().length > 0) {
      insertData.answer1 = answer1.trim();
    }
    if (answer2 && typeof answer2 === 'string' && answer2.trim().length > 0) {
      insertData.answer2 = answer2.trim();
    }

    console.log('🔵 [Server] 삽입할 데이터:', insertData);
    console.log('🔵 [Server] 삽입할 데이터 (JSON):', JSON.stringify(insertData));

    const { data, error } = await supabase
      .from('letsmeet_applications')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ [Server] 신청 삽입 에러:', error);
      console.error('❌ [Server] 에러 코드:', error.code);
      console.error('❌ [Server] 에러 메시지:', error.message);
      console.error('❌ [Server] 에러 상세:', error.details);
      return NextResponse.json(
        { error: `Failed to apply to meeting: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [Server] 신청 성공:', data);

    // 호스트에게 푸시 알림 전송
    try {
      const { data: applicant } = await supabase
        .from('letsmeet_users')
        .select('full_name')
        .eq('user_id', user.firebaseUid)
        .single();
      const applicantName = applicant?.full_name || '누군가';
      await sendFcmToUser(
        meeting.host_id,
        '새 신청이 도착했어요',
        `${applicantName}님이 "${meeting.title}" 모임에 신청했습니다.`,
        { type: 'application', meeting_id: id }
      );
    } catch (pushErr) {
      console.warn('Push notification failed:', pushErr);
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

