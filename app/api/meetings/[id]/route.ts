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

    // Combine meeting data with host nickname
    const response = {
      ...meetingData,
      host_nickname: hostData?.nickname || '',
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

