const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const imageExtension = (contentType: string) =>
  imageExtensions[contentType as keyof typeof imageExtensions];

export function imageObjectKey(
  slug: string,
  contentType: string,
  id: string = crypto.randomUUID(),
): string {
  const extension = imageExtension(contentType);
  if (!extension) throw new Error("Unsupported image type");
  return `${slug}/${id}.${extension}`;
}
