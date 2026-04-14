const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const STOCK_IMAGES: Record<string, string> = {
  tennis: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
  basketball: "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80",
  padel: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  football: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80",
  badminton: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
  squash: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80",
};

export function resolveCourtImage(imageUrl: string | null | undefined, type?: string): string | null {
  if (imageUrl) {
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
    return `${BASE_URL}/${imageUrl}`;
  }
  if (type && STOCK_IMAGES[type]) return STOCK_IMAGES[type];
  return null;
}
