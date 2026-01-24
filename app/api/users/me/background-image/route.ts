import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { verifyToken } from '@/lib/middleware/auth';

// 배경 이미지 업로드 (Supabase Storage 사용)
export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    const ownerId = authUser?.firebaseUid || 'anonymous';

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    const fileObj = file as File;
    const ext = fileObj.name?.split('.').pop() || 'jpg';
    const filePath = `background/${ownerId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('lets-meet')
      .upload(filePath, fileObj, {
        contentType: (fileObj as any).type || 'image/jpeg',
        upsert: true,
      });

    if (error || !data) {
      console.error('Background image upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload background image' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('lets-meet')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Background image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload background image' },
      { status: 500 }
    );
  }
}