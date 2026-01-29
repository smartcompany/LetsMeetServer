import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import { verifyToken } from '@/lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyToken(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
    const filePath = `feeds/${authUser.firebaseUid}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('lets-meet')
      .upload(filePath, fileObj, {
        contentType: (fileObj as any).type || 'image/jpeg',
        upsert: true,
      });

    if (error || !data) {
      console.error('Feed image upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload feed image' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('lets-meet')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Feed image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload feed image' },
      { status: 500 }
    );
  }
}
