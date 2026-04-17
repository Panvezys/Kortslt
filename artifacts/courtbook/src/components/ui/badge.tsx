import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { sportColor } from "@/components/sport-icon"

const SPORT_ALIASES: Record<string, string> = {
  tennis: "tennis",
  tenisas: "tennis",
  basketball: "basketball",
  krepšinis: "basketball",
  padel: "padel",
  padelis: "padel",
  football: "football",
  futbolas: "football",
  badminton: "badminton",
  badmintonas: "badminton",
  squash: "squash",
  skvošas: "squash",
  table_tennis: "table_tennis",
  "stalo tenisas": "table_tennis",
  golf: "golf",
  golfas: "golf",
  snooker: "snooker",
  snukeris: "snooker",
  bowling: "bowling",
  boulingas: "bowling",
}

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate ",
  {
    variants: {
      variant: {
        default:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          // @replit no hover because we use hover-elevate
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          // @replit shadow-xs instead of shadow, no hover because we use hover-elevate
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
          // @replit shadow-xs" - use badge outline variable
        outline: "text-foreground border [border-color:var(--badge-outline)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const { locale, t } = useI18n()
  const rawSport = typeof props.children === "string" ? props.children.trim().toLowerCase() : null
  const sport = rawSport ? SPORT_ALIASES[rawSport] ?? rawSport : null
  const color = sport ? sportColor[sport] : null
  const title = sport ? t(`sports.${sport}`) : null
  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        color ? "border-transparent text-white" : null,
        className,
      )}
      lang={locale}
      title={title ?? undefined}
      style={color ? { backgroundColor: color, color: "#fff" } : undefined}
      {...props}
    >
      {title ?? props.children}
    </div>
  )
}

export { Badge, badgeVariants }
