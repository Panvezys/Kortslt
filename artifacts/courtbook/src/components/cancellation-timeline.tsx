interface Props {
  hoursUntilStart?: number | null;
}

interface Tier {
  hours: string;
  percent: number;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  active?: boolean;
}

export function CancellationTimeline({ hoursUntilStart }: Props) {
  const tiers: Tier[] = [
    {
      hours: "> 48 val.",
      percent: 80,
      label: "80% grąžinama",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-400/30",
    },
    {
      hours: "24–48 val.",
      percent: 50,
      label: "50% grąžinama",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-400/30",
    },
    {
      hours: "< 24 val.",
      percent: 0,
      label: "Negrąžinama",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-400/30",
    },
  ];

  const getActiveTier = (hours: number | null | undefined): number => {
    if (hours == null) return -1;
    if (hours >= 48) return 0;
    if (hours >= 24) return 1;
    return 2;
  };

  const activeTierIdx = getActiveTier(hoursUntilStart);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Atšaukimo politika
      </p>
      <div className="flex gap-2">
        {tiers.map((tier, i) => {
          const isActive = i === activeTierIdx;
          return (
            <div
              key={i}
              className={`flex-1 rounded-lg border px-2 py-2 text-center transition-all ${
                isActive
                  ? `${tier.bgColor} ${tier.borderColor} ring-1 ring-inset ${tier.borderColor}`
                  : "bg-muted/20 border-transparent opacity-60"
              }`}
            >
              <p className={`text-[11px] font-bold ${isActive ? tier.color : "text-muted-foreground"}`}>
                {tier.percent}%
              </p>
              <p className={`text-[10px] leading-tight ${isActive ? tier.color : "text-muted-foreground"}`}>
                {tier.hours}
              </p>
            </div>
          );
        })}
      </div>
      {activeTierIdx >= 0 && (
        <p className={`text-xs font-medium ${tiers[activeTierIdx].color}`}>
          {activeTierIdx === 0 && "Atšaukus dabar, grąžinama 80% sumos."}
          {activeTierIdx === 1 && "Atšaukus dabar, grąžinama 50% sumos."}
          {activeTierIdx === 2 && "Atšaukus dabar, pinigai negrąžinami."}
        </p>
      )}
    </div>
  );
}
