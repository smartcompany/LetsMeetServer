import { NextRequest, NextResponse } from 'next/server';
import { verifyDashboardRequest } from '@/lib/dashboard-auth';
import { supabase } from '@/lib/db/supabase';

export type DashboardReportRow = {
  id: string;
  target_type: 'meeting' | 'feed';
  target_id: string;
  target_title_or_content: string;
  host_or_author_name: string | null;
  host_or_author_id: string;
  reason: string;
  detail: string | null;
  reporter_user_id: string;
  reporter_name: string | null;
  ai_verdict: string | null;
  ai_reason: string | null;
  ai_verdict_at: string | null;
  created_at: string;
};

/**
 * GET /api/dashboard/reports
 * Dashboard auth required (cookie). Returns meeting + feed reports with joined names.
 */
export async function GET(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: reports, error: reportsError } = await supabase
      .from('letsmeet_reports')
      .select('id, reporter_user_id, target_type, target_id, target_user_id, reason, detail, ai_verdict, ai_reason, ai_verdict_at, created_at')
      .in('target_type', ['meeting', 'feed'])
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('[dashboard reports]', reportsError);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    if (!reports?.length) {
      return NextResponse.json({ reports: [] });
    }

    const meetingIds: string[] = [];
    const feedIds: string[] = [];
    const userIds = new Set<string>();

    for (const r of reports) {
      userIds.add(r.reporter_user_id);
      userIds.add(r.target_user_id);
      if (r.target_type === 'meeting') meetingIds.push(r.target_id);
      if (r.target_type === 'feed') feedIds.push(r.target_id);
    }

    const [meetingsRes, feedsRes, usersRes] = await Promise.all([
      meetingIds.length
        ? supabase
            .from('letsmeet_meetings')
            .select('id, title, host_id')
            .in('id', meetingIds)
        : Promise.resolve({ data: [] as { id: string; title: string | null; host_id: string }[] }),
      feedIds.length
        ? supabase
            .from('letsmeet_feeds')
            .select('id, content, author_id')
            .in('id', feedIds)
        : Promise.resolve({ data: [] as { id: string; content: string | null; author_id: string }[] }),
      supabase
        .from('letsmeet_users')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds)),
    ]);

    const meetingsMap = new Map(
      (meetingsRes.data || []).map((m) => [m.id, { title: m.title || '(제목 없음)', host_id: m.host_id }])
    );
    const feedsMap = new Map(
      (feedsRes.data || []).map((f) => [
        f.id,
        { content: f.content ? (f.content.length > 80 ? f.content.slice(0, 80) + '…' : f.content) : '(내용 없음)', author_id: f.author_id },
      ])
    );
    const usersMap = new Map(
      (usersRes.data || []).map((u) => [u.user_id, u.full_name || u.user_id])
    );

    const rows: DashboardReportRow[] = reports.map((r) => {
      let target_title_or_content = '';
      let host_or_author_id = r.target_user_id;

      if (r.target_type === 'meeting') {
        const m = meetingsMap.get(r.target_id);
        if (m) {
          target_title_or_content = m.title;
          host_or_author_id = m.host_id;
        } else {
          target_title_or_content = '(삭제된 모임)';
        }
      } else if (r.target_type === 'feed') {
        const f = feedsMap.get(r.target_id);
        if (f) {
          target_title_or_content = f.content;
          host_or_author_id = f.author_id;
        } else {
          target_title_or_content = '(삭제된 피드)';
        }
      }

      return {
        id: r.id,
        target_type: r.target_type,
        target_id: r.target_id,
        target_title_or_content,
        host_or_author_name: usersMap.get(host_or_author_id) ?? null,
        host_or_author_id,
        reason: r.reason,
        detail: r.detail,
        reporter_user_id: r.reporter_user_id,
        reporter_name: usersMap.get(r.reporter_user_id) ?? null,
        ai_verdict: r.ai_verdict,
        ai_reason: r.ai_reason,
        ai_verdict_at: r.ai_verdict_at,
        created_at: r.created_at,
      };
    });

    return NextResponse.json({ reports: rows });
  } catch (e) {
    console.error('[dashboard reports]', e);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
