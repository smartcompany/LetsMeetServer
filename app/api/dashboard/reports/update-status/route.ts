import { NextRequest, NextResponse } from 'next/server';
import { verifyDashboardRequest } from '@/lib/dashboard-auth';
import { supabase } from '@/lib/db/supabase';

type UpdateItem = { report_id: string; admin_verdict: 'meeting_suspend' | 'no_issue' };

/**
 * POST /api/dashboard/reports/update-status
 * Body: { updates: Array<{ report_id: string, admin_verdict: 'meeting_suspend' | 'no_issue' }> }
 * - 각 신고에 admin_verdict 저장
 * - target_type이 meeting이면: admin_verdict가 meeting_suspend면 모임 status = suspended, no_issue면 status = open
 */
export async function POST(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { updates?: UpdateItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
  }

  const validVerdicts = ['meeting_suspend', 'no_issue'] as const;
  for (const u of updates) {
    if (!u.report_id || !validVerdicts.includes(u.admin_verdict)) {
      return NextResponse.json(
        { error: 'Each update must have report_id and admin_verdict (meeting_suspend | no_issue)' },
        { status: 400 }
      );
    }
  }

  try {
    for (const u of updates) {
      const { data: report, error: fetchErr } = await supabase
        .from('letsmeet_reports')
        .select('id, target_type, target_id')
        .eq('id', u.report_id)
        .single();

      if (fetchErr || !report) continue;

      await supabase
        .from('letsmeet_reports')
        .update({
          admin_verdict: u.admin_verdict,
          admin_verdict_at: new Date().toISOString(),
        })
        .eq('id', u.report_id);

      if (report.target_type === 'meeting') {
        const newStatus = u.admin_verdict === 'meeting_suspend' ? 'suspended' : 'open';
        await supabase
          .from('letsmeet_meetings')
          .update({ status: newStatus })
          .eq('id', report.target_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[dashboard update-status]', e);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
