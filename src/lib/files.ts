/**
 * Upload constraints (brief §9), mirrored client-side for friendly errors;
 * the bucket enforces the same limits server-side.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
] as const;

export function isAllowedUpload(
  mime: string,
  sizeBytes: number,
): string | null {
  if (
    !ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])
  ) {
    return "This file type isn't allowed. Images, PDFs, Office documents, plain text and CSV only.";
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return "Files are limited to 25 MB.";
  }
  if (sizeBytes <= 0) {
    return "This file is empty.";
  }
  return null;
}

/** Uploads before this count require an explicit checkbox confirmation. */
export const CHECKBOX_CONFIRMATION_UPLOADS = 5;
