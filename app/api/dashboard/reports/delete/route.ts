import { NextRequest, NextResponse } from 'next/server';
import { verifyDashboardRequest } from '@/lib/dashboard-auth';
import { supabase } from '@/lib/db/supabase';

/**
 * POST /api/dashboard/reports/delete
 * Body: { report_ids: string[] }
 */
export async function POST(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { report_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reportIds = Array.isArray(body.report_ids)
    ? body.report_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (reportIds.length === 0) {
    return NextResponse.json({ error: 'report_ids is required' }, { status: 400 });
  }

  try {
    const { error, count } = await supabase
      .from('letsmeet_reports')
      .delete({ count: 'exact' })
      .in('id', reportIds);

    if (error) {
      console.error('[dashboard reports delete]', error);
      return NextResponse.json({ error: 'Failed to delete reports' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: count ?? reportIds.length });
  } catch (e) {
    console.error('[dashboard reports delete]', e);
    return NextResponse.json({ error: 'Failed to delete reports' }, { status: 500 });
  }
}
