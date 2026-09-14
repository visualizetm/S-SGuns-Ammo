// Image storage: Cloudinary, uploaded server-side with a signed request so
// the API secret never reaches the browser.
//
// Interface:
//   storeImage({ filename, dataUrl })
//     -> { ok, url, publicId } | { ok: false, error, code? }
//
// Selection:
//   - Cloudinary env configured -> upload to Cloudinary, return a secure
//     delivery URL with f_auto,q_auto (fast automatic format/quality) plus
//     the public_id. Only those two strings are ever stored on a record,
//     never image bytes.
//   - production without Cloudinary -> clear error (code IMAGE_STORAGE_
//     NOT_CONFIGURED, served as 503). NEVER falls back to base64 in the
//     database.
//   - local dev without Cloudinary -> the validated data URL itself, so
//     everything works locally with zero credentials.
//
// PERMANENCE RULE (owner's requirement): uploaded images STAY. Nothing in
// this app may ever call Cloudinary's destroy/delete APIs. Deleting or
// replacing a product removes only the reference to the image. The smoke
// suite fails if a destroy call appears anywhere in the codebase.
//
// Env vars (see PRODUCTION-SETUP.md): CLOUDINARY_URL, or the trio
// CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.

const DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_DATA_URL_LENGTH = 2_000_000; // ~1.5 MB decoded, after downscaling
const CLOUDINARY_FOLDER = 'ss-guns-ammo/products';

export const IMAGE_STORAGE_NOT_CONFIGURED_MESSAGE =
  'Image storage not configured. Set the Cloudinary variables (CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).';

function isProduction() {
  return (
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET)
  );
}

// Which storage this deployment uses, for the health endpoint. In
// production with no storage configured this reports 'unconfigured' so the
// dashboard can warn instead of quietly stuffing base64 into the database.
export function imageStorageMode() {
  if (cloudinaryConfigured()) return 'cloudinary';
  return isProduction() ? 'unconfigured' : 'dev-data-url';
}

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

async function getCloudinary() {
  const { v2: cloudinary } = await import('cloudinary');
  // With CLOUDINARY_URL set the SDK configures itself; otherwise wire the
  // three discrete vars. secure:true makes every generated URL https.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  cloudinary.config({ secure: true });
  return cloudinary;
}

// Upload one image (a data URL) to Cloudinary and return the delivery URL
// the catalog stores: secure, with f_auto,q_auto so browsers get the best
// format and size automatically. Exported for the one-time migration script.
export async function uploadToCloudinary(dataUrl) {
  const cloudinary = await getCloudinary();
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: CLOUDINARY_FOLDER,
    resource_type: 'image',
    overwrite: false,
  });
  const url = cloudinary.url(result.public_id, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    version: result.version,
  });
  return { url, publicId: result.public_id };
}

export async function storeImage(input) {
  const error = validate(input || {});
  if (error) return { ok: false, error };

  if (cloudinaryConfigured()) {
    try {
      const { url, publicId } = await uploadToCloudinary(input.dataUrl);
      return { ok: true, url, publicId };
    } catch {
      return {
        ok: false,
        error: 'The photo upload failed. Check the connection and try again.',
      };
    }
  }

  if (isProduction()) {
    // Loud failure: no base64-in-the-database fallback in production.
    return {
      ok: false,
      error: IMAGE_STORAGE_NOT_CONFIGURED_MESSAGE,
      code: 'IMAGE_STORAGE_NOT_CONFIGURED',
    };
  }

  // Local dev only: the data URL is the URL, stored on the item itself.
  return { ok: true, url: input.dataUrl };
}
