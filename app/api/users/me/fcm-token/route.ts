import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function PUT(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const fcmToken = body.fcm_token as string | undefined;

    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      return NextResponse.json(
        { error: 'fcm_token is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('letsmeet_users')
      .update({ fcm_token: fcmToken.trim(), updated_at: new Date().toISOString() })
      .eq('user_id', authUser.firebaseUid);

    if (error) {
      console.error('FCM token update error:', error);
      return NextResponse.json(
        { error: 'Failed to save FCM token' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('FCM token error:', error);
    return NextResponse.json(
      { error: 'Failed to save FCM token' },
      { status: 500 }
    );
  }
}
