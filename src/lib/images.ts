const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type UploadKind = "image" | "video";

export const imageExtension = (contentType: string) =>
  imageExtensions[contentType as keyof typeof imageExtensions];

export const uploadKind = (contentType: string): UploadKind | undefined =>
  imageExtension(contentType) ? "image" : contentType.startsWith("video/") ? "video" : undefined;

export function uploadRestriction(
  contentType: string,
  existingContentTypes: string[],
): string | undefined {
  const kind = uploadKind(contentType);
  if (!kind) return "Only video, JPEG, PNG, and WebP files are supported.";

  const existingKind = existingContentTypes.length
    ? uploadKind(existingContentTypes[0])
    : undefined;
  if (existingKind && existingKind !== kind) {
    return "Upload images or videos in separate batches.";
  }
  if (kind === "video" && existingContentTypes.length >= 4) {
    return "You can upload up to four videos at once.";
  }
}

export function imageObjectKey(
  slug: string,
  contentType: string,
  id: string = crypto.randomUUID(),
): string {
  const extension = imageExtension(contentType);
  if (!extension) throw new Error("Unsupported image type");
  return `${slug}/${id}.${extension}`;
}
