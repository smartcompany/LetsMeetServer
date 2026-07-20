import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { verifyToken } from '@/lib/middleware/auth';
import { parseImageUploadFile } from '@/lib/upload-image';

export const runtime = 'nodejs';

// 프로필 이미지 업로드 (Supabase Storage)
export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const incomingType = request.headers.get('content-type') ?? '';
    if (!incomingType.toLowerCase().includes('multipart/form-data')) {
      console.error('Profile image upload bad Content-Type:', incomingType);
      return NextResponse.json(
        {
          error:
            'Invalid Content-Type for upload. Expected multipart/form-data.',
          received: incomingType || '(empty)',
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const parsed = await parseImageUploadFile(file as File);
    if ('error' in parsed) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );
    }

    const filePath = `profile/${authUser.firebaseUid}/${Date.now()}.${parsed.ext}`;

    const { data, error } = await supabase.storage
      .from('lets-meet')
      .upload(filePath, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: true,
      });

    if (error || !data) {
      console.error('Profile image upload error:', error);
      return NextResponse.json(
        { error: error?.message ?? 'Failed to upload profile image' },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('lets-meet')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Profile image upload error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload profile image',
      },
      { status: 500 },
    );
  }
}
