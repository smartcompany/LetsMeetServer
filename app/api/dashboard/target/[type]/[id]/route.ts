import { NextRequest, NextResponse } from 'next/server';
import { verifyDashboardRequest } from '@/lib/dashboard-auth';
import { supabase } from '@/lib/db/supabase';

/**
 * GET /api/dashboard/target/[type]/[id]
 * Dashboard auth required. Returns full meeting or feed detail (title, content, image_urls).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, id } = await params;
  if (type !== 'meeting' && type !== 'feed') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  try {
    if (type === 'meeting') {
      const { data, error } = await supabase
        .from('letsmeet_meetings')
        .select('id, title, description, image_urls')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      return NextResponse.json({
        type: 'meeting',
        title: data.title ?? '',
        content: data.description ?? '',
        image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
      });
    }

    const { data, error } = await supabase
      .from('letsmeet_feeds')
      .select('id, content, image_urls')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    return NextResponse.json({
      type: 'feed',
      title: null,
      content: data.content ?? '',
      image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
    });
  } catch (e) {
    console.error('[dashboard target]', e);
    return NextResponse.json(
      { error: 'Failed to fetch target' },
      { status: 500 }
    );
  }
}
