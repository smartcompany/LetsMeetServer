import { NextRequest } from 'next/server';

import { verifyDashboardRequest } from '@/lib/dashboard-auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { getProductAnalyticsDashboardData } from '@/lib/product-analytics-store';

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function GET(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
  }

  const requestedDays = Number(request.nextUrl.searchParams.get('days') ?? 28);
  const days = [7, 28, 90].includes(requestedDays) ? requestedDays : 28;
  try {
    const analytics = await getProductAnalyticsDashboardData(days);
    return jsonResponse(request, analytics);
  } catch (error) {
    console.error('[GET /api/dashboard/product-analytics]', error);
    return jsonResponse(
      request,
      { error: 'Failed to load product analytics' },
      { status: 500 },
    );
  }
}
