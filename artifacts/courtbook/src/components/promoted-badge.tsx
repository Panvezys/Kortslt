// "⭐ Remiama" (Sponsored) badge for marketplace cards.
// Rendered on coach and court cards when the entity has an active paid
// promotion (the server-side `isPromoted` flag is true).
//
// Uses the amber/yellow palette to read as a premium gold accent in both
// light and dark themes, with a faint ring so it pops against any photo.
export function PromotedBadge({ className }: { className?: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full " +
        "bg-gradient-to-r from-amber-400/95 to-yellow-500/95 " +
        "text-amber-950 text-[10px] font-semibold tracking-wide " +
        "shadow-sm ring-1 ring-amber-300/60 " +
        (className ?? "")
      }
    >
      <span aria-hidden="true">⭐</span>
      Remiama
    </span>
  );
}
