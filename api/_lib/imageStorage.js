// Image storage adapter, same swap pattern as the data adapters.
//
// Interface:
//   storeImage({ filename, dataUrl }) -> Promise<{ ok, url } | { ok: false, error }>
//
// Implementations, selected from the environment at runtime:
//   - BLOB_READ_WRITE_TOKEN set -> Vercel Blob (public URL, cache-friendly)
//   - otherwise (dev/demo)      -> the validated data URL itself is the
//     stored value; it lives inside the item record in the dev store, so
//     everything works locally with zero credentials.
// The admin UI downscales photos in the browser before upload, so payloads
// stay small. Setup steps for production live in PRODUCTION-SETUP.md.

const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_URL_LENGTH = 2_000_000; // ~1.5 MB decoded, after downscaling

function validate({ filename, dataUrl }) {
  if (typeof dataUrl !== 'string' || !DATA_URL_PATTERN.test(dataUrl)) {
    return 'Upload must be a JPEG, PNG, or WebP image.';
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return 'Image is too large. Use a smaller photo.';
  }
  if (filename !== undefined && typeof filename !== 'string') {
    return 'Filename must be text.';
  }
  return null;
}

function safeName(filename) {
  const base = String(filename || 'photo')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `inventory/${Date.now().toString(36)}-${base || 'photo'}`;
}

async function storeInBlob({ filename, dataUrl }) {
  const { put } = await import('@vercel/blob');
  const [meta, base64] = dataUrl.split(',');
  const contentType = /data:([^;]+);/.exec(meta)[1];
  const extension = contentType.split('/')[1];
  const buffer = Buffer.from(base64, 'base64');
  const blob = await put(`${safeName(filename)}.${extension}`, buffer, {
    access: 'public',
    contentType,
  });
  return { ok: true, url: blob.url };
}

// Which storage this deployment would use, for the health endpoint. In
// production with no storage configured this reports 'unconfigured' so the
// dashboard can warn instead of quietly stuffing base64 into the database.
export function imageStorageMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  const production =
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    process.env.NODE_ENV === 'production';
  return production ? 'unconfigured' : 'dev-data-url';
}

export async function storeImage(input) {
  const error = validate(input || {});
  if (error) return { ok: false, error };

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return storeInBlob(input);
  }
  // Dev/demo: the data URL is the URL. It is stored on the item itself.
  return { ok: true, url: input.dataUrl };
}
