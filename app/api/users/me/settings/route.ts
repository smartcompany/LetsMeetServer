import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/users/me/settings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data } = await supabase
      .from('letsmeet_users')
      .select('chat_push_enabled')
      .eq('user_id', user.firebaseUid)
      .single();

    return NextResponse.json({
      chat_push_enabled: data?.chat_push_enabled ?? true,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/me/settings
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const chatPushEnabled = body.chat_push_enabled;

    if (typeof chatPushEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'chat_push_enabled must be a boolean' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('letsmeet_users')
      .update({
        chat_push_enabled: chatPushEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.firebaseUid);

    if (error) {
      console.error('Update settings error:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ chat_push_enabled: chatPushEnabled });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
