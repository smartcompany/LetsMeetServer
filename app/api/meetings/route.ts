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
    } = body;

    // Validation
    if (!title || !meeting_date || !location || !max_participants || !interests) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (max_participants < 3 || max_participants > 6) {
      return NextResponse.json(
        { error: 'Max participants must be between 3 and 6' },
        { status: 400 }
      );
    }

    if (interests.length > 2) {
      return NextResponse.json(
        { error: 'Maximum 2 interests allowed' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
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
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create meeting error:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
}

