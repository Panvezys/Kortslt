import { getSportImage } from "@/lib/sport-images";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function preferWebp(url: string): string {
  if (!/\/courts\//.test(url)) return url;
  return url.replace(/\.(png|jpe?g)(\?.*)?$/i, ".webp$2");
}

export function resolveCourtImage(imageUrl: string | null | undefined, type?: string): string | null {
  if (imageUrl) {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
    if (imageUrl.startsWith("/")) return preferWebp(imageUrl);
    return preferWebp(`${BASE_URL}/${imageUrl}`);
  }
  return getSportImage(type);
}
