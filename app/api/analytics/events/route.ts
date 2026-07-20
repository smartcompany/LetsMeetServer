import { NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyToken } from '@/lib/middleware/auth';
import {
  PRODUCT_EVENT_NAMES,
  recordProductEvents,
} from '@/lib/product-analytics-store';
import { jsonResponse, optionsResponse } from '@/lib/http';

const propertyValueSchema = z.union([
  z.string().max(80),
  z.number().finite(),
  z.boolean(),
]);

const eventSchema = z.object({
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  installId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventName: z.enum(PRODUCT_EVENT_NAMES),
  platform: z.enum(['ios', 'android', 'web', 'other']),
  appVersion: z.string().max(32).default(''),
  locale: z.string().max(16).default(''),
  properties: z
    .record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), propertyValueSchema)
    .refine((value) => Object.keys(value).length <= 12, {
      message: 'Too many event properties',
    })
    .default({}),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

const rateBuckets = new Map<string, { minute: number; count: number }>();

function exceedsRateLimit(request: NextRequest, eventCount: number): boolean {
  const forwarded = request.headers.get('x-forwarded-for');
  const key = forwarded?.split(',')[0]?.trim() || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const current = rateBuckets.get(key);
  const next =
    current?.minute === minute
      ? { minute, count: current.count + eventCount }
      : { minute, count: eventCount };
  rateBuckets.set(key, next);
  if (rateBuckets.size > 1000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.minute < minute) rateBuckets.delete(bucketKey);
    }
  }
  return next.count > 300;
}

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64 * 1024) {
    return jsonResponse(request, { error: 'Payload too large' }, { status: 413 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    if (exceedsRateLimit(request, body.events.length)) {
      return jsonResponse(
        request,
        { error: 'Too many analytics events' },
        { status: 429 },
      );
    }
    const authUser = await verifyToken(request);
    await recordProductEvents(body.events, authUser?.userId ?? null);
    return jsonResponse(request, { accepted: body.events.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse(
        request,
        { error: 'Invalid analytics events', details: error.flatten() },
        { status: 400 },
      );
    }
    console.error('[POST /api/analytics/events]', error);
    return jsonResponse(
      request,
      { error: 'Failed to record analytics events' },
      { status: 500 },
    );
  }
}
