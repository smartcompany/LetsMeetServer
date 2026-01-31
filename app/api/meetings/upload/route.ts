import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import { supabase } from '@/lib/db/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 파일명 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `meetings/${user.firebaseUid}/${timestamp}_${randomString}.${fileExt}`;

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('lets-meet')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Public URL 가져오기
    const { data: urlData } = supabase.storage
      .from('lets-meet')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
