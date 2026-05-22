import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

export type BumpTargetType = "coach" | "court" | "tournament";

type PlatformSettings = {
  id: number;
  coachBumpPriceCents: number;
  courtBumpPriceCents: number;
  tournamentBumpPriceCents: number;
  updatedAt: string;
};

type CheckoutResponse = {
  url: string;
  sessionId: string;
  amountCents: number;
  mock: boolean;
};

function priceForTarget(s: PlatformSettings | undefined, t: BumpTargetType): number | null {
  if (!s) return null;
  if (t === "coach") return s.coachBumpPriceCents;
  if (t === "court") return s.courtBumpPriceCents;
  return s.tournamentBumpPriceCents;
}

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("lt-LT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface Props {
  targetType: BumpTargetType;
  targetId: number;
  promotedUntil?: string | Date | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  variant?: "default" | "outline" | "secondary";
}

export function PromoteButton({
  targetType,
  targetId,
  promotedUntil,
  size = "default",
  className,
  variant = "default",
}: Props) {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["platform-settings"],
    queryFn: () => customFetch<PlatformSettings>("/api/platform/settings", { method: "GET" }),
    staleTime: 60_000,
  });

  const checkout = useMutation({
    mutationFn: () =>
      customFetch<CheckoutResponse>("/api/payments/create-bump-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      }),
    onSuccess: (res) => {
      if (res.url) {
        window.location.href = res.url;
      } else {
        toast({ title: "Klaida", description: "Negautas mokėjimo adresas.", variant: "destructive" });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Bandykite vėliau.";
      toast({ title: "Iškelti nepavyko", description: msg, variant: "destructive" });
    },
  });

  const cents = priceForTarget(settings, targetType);
  const activeUntilDate = promotedUntil ? new Date(promotedUntil) : null;
  const isActive = activeUntilDate != null && activeUntilDate.getTime() > Date.now();

  const label = isLoading || cents == null
    ? "Iškelti profilį"
    : `Iškelti profilį (${formatEur(cents)} €)`;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => checkout.mutate()}
        disabled={checkout.isPending}
        className="gap-2"
      >
        <Sparkles className="w-4 h-4" />
        {checkout.isPending ? "Nukreipiama…" : label}
      </Button>
      {isActive && activeUntilDate && (
        <p className="text-xs text-muted-foreground">
          ⭐ Iškeltas iki {activeUntilDate.toLocaleDateString("lt-LT")}
        </p>
      )}
    </div>
  );
}
