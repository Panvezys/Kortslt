const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const STOCK_IMAGES: Record<string, string> = {
  tennis:       "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=600&q=75",
  basketball:   "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=600&q=75",
  padel:        "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=600&q=75",
  football:     "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=600&q=75",
  badminton:    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=600&q=75",
  squash:       "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=75",
  table_tennis: "https://images.unsplash.com/photo-1611251135345-18c56206b863?auto=format&fit=crop&w=600&q=75",
  golf:         "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=75",
  snooker:      "https://images.unsplash.com/photo-1532548291956-9eb74fa1975e?auto=format&fit=crop&w=600&q=75",
  bowling:      "https://images.unsplash.com/photo-1614632537197-38a17061c6bd?auto=format&fit=crop&w=600&q=75",
};

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
  if (type && STOCK_IMAGES[type]) return STOCK_IMAGES[type];
  return null;
}
