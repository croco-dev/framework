export const CLOUDINARY_UPLOAD_SIGNATURE_VALIDITY_SECONDS = 3600;

export function isValidCloudinaryUploadIntentTtl(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= CLOUDINARY_UPLOAD_SIGNATURE_VALIDITY_SECONDS
  );
}
