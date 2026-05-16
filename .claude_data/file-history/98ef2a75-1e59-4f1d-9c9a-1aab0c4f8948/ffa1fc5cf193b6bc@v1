interface Props {
  surface?: string | null;
  surfaceSpeed?: string | null;
  surfaceBounce?: string | null;
}

const SURFACE_LABELS: Record<string, string> = {
  hard: "Kietas",
  clay: "Molis",
  grass: "Žolė",
  carpet: "Kilimas",
  artificial_grass: "Dirbtinė žolė",
  wood: "Medis",
  rubber: "Guma",
  concrete: "Betonas",
};

const SPEED_LABELS: Record<string, { label: string; pos: 1 | 2 | 3; color: string }> = {
  slow:   { label: "Lėtas",    pos: 1, color: "bg-green-500" },
  medium: { label: "Vidutinis", pos: 2, color: "bg-yellow-500" },
  fast:   { label: "Greitas",  pos: 3, color: "bg-red-500" },
};

const BOUNCE_LABELS: Record<string, { label: string; pos: 1 | 2 | 3; color: string }> = {
  low:    { label: "Žemas",     pos: 1, color: "bg-green-500" },
  medium: { label: "Vidutinis",  pos: 2, color: "bg-yellow-500" },
  high:   { label: "Aukštas",   pos: 3, color: "bg-red-500" },
};

function GaugeMeter({ label, value, meta }: {
  label: string;
  value: string;
  meta: Record<string, { label: string; pos: 1 | 2 | 3; color: string }>;
}) {
  const entry = meta[value];
  if (!entry) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-semibold">{entry.label}</span>
      </div>
      <div className="flex gap-1">
        {([1, 2, 3] as const).map((pos) => (
          <div
            key={pos}
            className={`flex-1 h-2 rounded-full transition-colors ${pos <= entry.pos ? entry.color : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function SurfaceSpecs({ surface, surfaceSpeed, surfaceBounce }: Props) {
  const hasSpecs = !!(surfaceSpeed || surfaceBounce);
  const surfaceLabel = surface ? (SURFACE_LABELS[surface] ?? surface) : null;

  if (!hasSpecs && !surfaceLabel) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        🏟️ Dangos specifikacijos
      </h2>
      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        {surfaceLabel && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Dangos tipas</span>
            <span className="font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs">{surfaceLabel}</span>
          </div>
        )}
        {surfaceSpeed && (
          <GaugeMeter label="Kamuoliuko greitis" value={surfaceSpeed} meta={SPEED_LABELS} />
        )}
        {surfaceBounce && (
          <GaugeMeter label="Atšokimo aukštis" value={surfaceBounce} meta={BOUNCE_LABELS} />
        )}
        <p className="text-xs text-muted-foreground pt-1 border-t">
          Dangos charakteristikos gali skirtis priklausomai nuo oro sąlygų ir aikštelės priežiūros.
        </p>
      </div>
    </div>
  );
}
