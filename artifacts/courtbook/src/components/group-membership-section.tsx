import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { UserPlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import type { GroupMembership } from "@/lib/search-groups-types";

const DAYS_LT = [
  "Sekmadienis",
  "Pirmadienis",
  "Antradienis",
  "Trečiadienis",
  "Ketvirtadienis",
  "Penktadienis",
  "Šeštadienis",
];

const HOURS = Array.from({ length: 14 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

interface Props {
  facilityId: number;
  sport: string;
  memberships: GroupMembership[];
}

export function GroupMembershipSection({ facilityId, sport, memberships }: Props) {
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const { toast } = useToast();

  const [subscribePlan, setSubscribePlan] = useState<GroupMembership | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  if (memberships.length === 0) return null;

  function handleTaptiNariu(plan: GroupMembership) {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setSubscribePlan(plan);
    setDayOfWeek("1");
    setStartTime("09:00");
    setOpen(true);
  }

  async function handleSubscribe() {
    if (!subscribePlan) return;
    setIsPending(true);
    try {
      await customFetch(
        `/api/facilities/${facilityId}/${sport}/memberships/${subscribePlan.id}/subscribe`,
        {
          method: "POST",
          body: JSON.stringify({ dayOfWeek: Number(dayOfWeek), startTime }),
        }
      );
      toast({ title: "Narystė aktyvuota! 🎉" });
      setOpen(false);
      setSubscribePlan(null);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 409) {
        toast({ title: "Jau esate narys", variant: "destructive" });
      } else {
        toast({ title: "Klaida", description: "Bandykite dar kartą.", variant: "destructive" });
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2 after:flex-1 after:h-px after:bg-border after:ml-2">
        <Star className="w-4 h-4 text-primary" />Narystės
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {memberships.map(plan => (
          <div
            key={plan.id}
            className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/5 to-primary/5 p-4 space-y-2"
          >
            <div className="flex items-start gap-2">
              <Star className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{plan.name}</div>
                {plan.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{plan.description}</div>
                )}
              </div>
              {plan.discountPercent != null && (
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 border border-green-400/30">
                  −{plan.discountPercent}%
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-right">
                <span className="font-bold text-primary text-base">{plan.pricePerYear} €</span>
                <span className="text-xs text-muted-foreground">/metus</span>
              </div>
              {plan.pricePerMonth != null && (
                <div>
                  <span className="font-semibold text-sm text-foreground">{plan.pricePerMonth} €</span>
                  <span className="text-xs text-muted-foreground">/mėn</span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              {plan.weeklySlots} k./sav.
            </div>

            {plan.conditions && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{plan.conditions}</p>
            )}

            <Button
              size="sm"
              className="w-full gap-1.5"
              variant="outline"
              onClick={() => handleTaptiNariu(plan)}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tapti nariu
            </Button>
          </div>
        ))}
      </div>

      {/* Subscribe dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pasirinkite savaitinį laiką</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Savaitės diena</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={dayOfWeek}
                onChange={e => setDayOfWeek(e.target.value)}
              >
                {DAYS_LT.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pradžios laikas</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            {subscribePlan && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-semibold">{subscribePlan.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {subscribePlan.pricePerYear} €/metai · {DAYS_LT[Number(dayOfWeek)]} {startTime}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Atšaukti
            </Button>
            <Button className="flex-1" disabled={isPending} onClick={handleSubscribe}>
              {isPending ? "..." : "Patvirtinti narystę"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
