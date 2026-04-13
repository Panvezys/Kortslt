const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export function resolveCourtImage(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${BASE_URL}/${imageUrl}`;
}
