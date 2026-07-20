const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export type ParsedUploadFile = {
  buffer: Buffer;
  ext: string;
  contentType: string;
};

type UploadFileLike = {
  name?: string;
  type?: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function parseImageUploadFile(
  file: UploadFileLike,
  maxSizeBytes = 10 * 1024 * 1024,
): Promise<ParsedUploadFile | { error: string; status: number }> {
  if (!file || file.size <= 0) {
    return { error: 'Empty file', status: 400 };
  }

  if (file.size > maxSizeBytes) {
    return {
      error: `File size exceeds ${Math.floor(maxSizeBytes / (1024 * 1024))}MB`,
      status: 400,
    };
  }

  const rawName = file.name?.trim() ?? '';
  const extFromName = rawName.includes('.')
    ? rawName.split('.').pop()?.toLowerCase() ?? ''
    : '';
  const mimeType = (file.type || '').toLowerCase();

  let ext = extFromName;
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else ext = 'jpg';
  }

  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME.has(mimeType)) {
    return {
      error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed',
      status: 400,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    return { error: 'Empty file body', status: 400 };
  }

  let contentType = mimeType;
  if (!ALLOWED_MIME.has(contentType)) {
    switch (ext) {
      case 'png':
        contentType = 'image/png';
        break;
      case 'webp':
        contentType = 'image/webp';
        break;
      default:
        contentType = 'image/jpeg';
    }
  }

  return { buffer, ext, contentType };
}
