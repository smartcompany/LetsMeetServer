import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const interests = searchParams.get('interests');

    let query = supabase
      .from('letsmeet_meetings')
      .select('*')
      .eq('status', 'open')
      .gte('meeting_date', new Date().toISOString())
      .order('meeting_date', { ascending: true });

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

    return NextResponse.json(data || []);
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

    // Get host nickname
    const { data: hostData } = await supabase
      .from('letsmeet_users')
      .select('nickname')
      .eq('user_id', user.firebaseUid)
      .single();

    // Combine meeting data with host nickname
    const response = {
      ...meetingData,
      host_nickname: hostData?.nickname || '',
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

