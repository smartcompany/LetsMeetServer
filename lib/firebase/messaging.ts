import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { getFirebaseAdmin } from './admin';
import { supabase } from '@/lib/db/supabase';

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging {
  if (!messaging) {
    const { app } = getFirebaseAdmin();
    messaging = getMessaging(app);
  }
  return messaging;
}

/**
 * Send FCM notification to user(s) by Firebase UID
 */
export async function sendFcmToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (userIds.length === 0) return;

  const { data: users } = await supabase
    .from('letsmeet_users')
    .select('user_id, fcm_token, chat_push_enabled')
    .in('user_id', userIds);

  const tokens: string[] = [];
  for (const u of users || []) {
    if (u.fcm_token && u.chat_push_enabled !== false) {
      tokens.push(u.fcm_token);
    }
  }
  if (tokens.length === 0) return;

  const msg = getMessagingInstance();
  await msg.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data || {},
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  });
}

/**
 * Send FCM to a single user (for application notification - no chat_push filter)
 */
export async function sendFcmToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const { data: user } = await supabase
    .from('letsmeet_users')
    .select('fcm_token')
    .eq('user_id', userId)
    .single();

  if (!user?.fcm_token) return;

  const msg = getMessagingInstance();
  await msg.send({
    token: user.fcm_token,
    notification: { title, body },
    data: data || {},
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  });
}
