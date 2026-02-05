import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { sendFcmToUsers } from '@/lib/firebase/messaging';

/**
 * POST /api/chat/notify
 * Send push to recipients (e.g. when new chat message). Respects chat_push_enabled.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const recipientIds = body.recipient_user_ids as string[] | undefined;
    const title = (body.title as string) || '새 메시지';
    const bodyText = (body.body as string) || '';
    const data = body.data as Record<string, string> | undefined;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json(
        { error: 'recipient_user_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    await sendFcmToUsers(recipientIds, title, bodyText, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat notify error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
