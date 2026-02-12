import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    // 모임 목록은 비로그인 사용자도 열람 가능 (공개 콘텐츠)
    const user = await verifyToken(request); // user 없으면 null

    const { searchParams } = new URL(request.url);
    const interests = searchParams.get('interests');
    const hostId = searchParams.get('host_id'); // 호스트 필터링 (선택사항)
    const includeCompleted = searchParams.get('include_completed') === 'true'; // 완료된 모임 포함 (선택사항)

    let query = supabase
      .from('letsmeet_meetings')
      .select(`
        *,
        host:letsmeet_users!host_id(full_name)
      `);

    // 호스트 필터링
    if (hostId) {
      query = query.eq('host_id', hostId);
    }

    // 상태 필터링: include_completed가 true가 아니면 open만, true면 모든 상태
    if (!includeCompleted) {
      query = query.eq('status', 'open');
    }

    // 날짜 필터링: include_completed가 true가 아니면 미래 날짜만
    if (!includeCompleted) {
      query = query.gte('meeting_date', new Date().toISOString());
    }

    query = query.order('meeting_date', { ascending: !includeCompleted }); // 완료된 모임 포함 시 최신순

    if (interests) {
      const interestList = interests.split(',');
      query = query.contains('interests', interestList);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to get meetings' },
        { status: 500 }
      );
    }

    let userApplicationsMap: Record<string, { id: string; status: string }> =
        {};
    if (user && data && data.length > 0) {
      const meetingIds = data.map((m: { id: string }) => m.id);
      console.log(
        '[GET /meetings] user.firebaseUid=',
        user.firebaseUid,
        'meetingIds=',
        meetingIds
      );
      const { data: appsData, error: appsError } = await supabase
        .from('letsmeet_applications')
        .select('id, meeting_id, status')
        .eq('user_id', user.firebaseUid)
        .in('meeting_id', meetingIds);

      console.log(
        '[GET /meetings] letsmeet_applications query: appsData=',
        appsData,
        'appsError=',
        appsError
      );

      if (appsData) {
        for (const app of appsData as Array<{
          id: string;
          meeting_id: string;
          status: string;
        }>) {
          userApplicationsMap[app.meeting_id] = {
            id: app.id,
            status: app.status,
          };
        }
      }
      console.log(
        '[GET /meetings] userApplicationsMap=',
        JSON.stringify(userApplicationsMap)
      );
    } else {
      console.log('[GET /meetings] skip user_application: user=', !!user);
    }

    // Flatten the response to include host_name + user_application
    const meetingsWithHostName = data?.map(meeting => ({
      ...meeting,
      host_name: meeting.host?.full_name || '',
      user_application: userApplicationsMap[meeting.id] ?? null,
    }));

    return NextResponse.json(meetingsWithHostName || []);
  } catch (error) {
    console.error('Get meetings error:', error);
    return NextResponse.json(
      { error: 'Failed to get meetings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check user trust score and hosting limits
    const { data: userData } = await supabase
      .from('letsmeet_users')
      .select('trust_score')
      .eq('user_id', user.firebaseUid)
      .single();

    if (!userData || userData.trust_score < 30) {
      return NextResponse.json(
        { error: 'Insufficient trust score to create meeting' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      meeting_date,
      location,
      location_detail,
      max_participants,
      interests,
      description,
      category,
      participation_fee,
      gender_restriction,
      age_range_min,
      age_range_max,
      approval_type,
      image_urls,
    } = body;

    // Validation
    if (!title || !meeting_date || !location || !max_participants || !interests || !category || !approval_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Title validation (max 40 characters)
    if (title.length > 40) {
      return NextResponse.json(
        { error: 'Title must be 40 characters or less' },
        { status: 400 }
      );
    }

    // Description validation (20-500 characters)
    if (description) {
      if (description.length < 20 || description.length > 500) {
        return NextResponse.json(
          { error: 'Description must be between 20 and 500 characters' },
          { status: 400 }
        );
      }
    }

    // Meeting date validation (must be in the future)
    const meetingDate = new Date(meeting_date);
    if (meetingDate <= new Date()) {
      return NextResponse.json(
        { error: 'Meeting date must be in the future' },
        { status: 400 }
      );
    }

    // Max participants validation (2-20)
    if (max_participants < 2 || max_participants > 20) {
      return NextResponse.json(
        { error: 'Max participants must be between 2 and 20' },
        { status: 400 }
      );
    }

    // Interests validation (max 2)
    if (interests.length > 2) {
      return NextResponse.json(
        { error: 'Maximum 2 interests allowed' },
        { status: 400 }
      );
    }

    // Participation fee validation (>= 0)
    const fee = participation_fee ?? 0;
    if (fee < 0) {
      return NextResponse.json(
        { error: 'Participation fee must be 0 or greater' },
        { status: 400 }
      );
    }

    // Age range validation
    if (age_range_min !== undefined && age_range_max !== undefined) {
      if (age_range_min > age_range_max) {
        return NextResponse.json(
          { error: 'Age range min must be less than or equal to max' },
          { status: 400 }
        );
      }
    }

    const { data: meetingData, error: insertError } = await supabase
      .from('letsmeet_meetings')
      .insert({
        host_id: user.firebaseUid,
        title,
        description,
        meeting_date,
        location,
        location_detail,
        max_participants,
        interests,
        category,
        participation_fee: fee,
        gender_restriction: gender_restriction || 'all',
        age_range_min: age_range_min || null,
        age_range_max: age_range_max || null,
        approval_type,
        image_urls: image_urls || [],
        status: 'open',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create meeting' },
        { status: 500 }
      );
    }

    // Get host name
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('full_name')
      .eq('user_id', user.firebaseUid)
      .single();

    // Combine meeting data with host name
    const response = {
      ...meetingData,
      host_name: hostData?.full_name || '',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
}

