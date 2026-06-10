import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Star, Plus, X } from "lucide-react";
import { getSportLabel } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface MembershipPlan {
  id: number;
  courtId: number | null;
  name: string;
  description: string | null;
  pricePerYear: number;
  pricePerMonth: number | null;
  weeklySlots: number;
  conditions: string | null;
  discountPercent: number | null;
  isActive: boolean;
}

export default function OwnerCourtMemberships() {
  const params = useParams<{ facilityId: string; courtId: string }>();
  const facilityId = Number(params.facilityId);
  const courtId = Number(params.courtId);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerYear, setPricePerYear] = useState("");
  const [pricePerMonth, setPricePerMonth] = useState("");
  const [weeklySlots, setWeeklySlots] = useState("1");
  const [conditions, setConditions] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");

  const { data: facility } = useQuery<{ name?: string }>({
    queryKey: ["facility-detail", String(facilityId)],
    queryFn: () => customFetch(`${API_URL}/facilities/${facilityId}`),
    enabled: !!facilityId,
  });

  const { data: court } = useQuery<{ name?: string; type?: string }>({
    queryKey: ["court-detail", courtId],
    queryFn: () => customFetch(`${API_URL}/courts/${courtId}`),
    enabled: !!courtId,
  });

  // Plans are scoped to (facility, sport) since Epic 2 — every court of this
  // sport shares the same list, so each court's "Narystės" tab manages the
  // whole group. The sport comes from the court we navigated in from.
  const sport = court?.type ?? null;

  const { data: plans = [], isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["group-memberships", facilityId, sport],
    queryFn: () => customFetch<MembershipPlan[]>(`${API_URL}/facilities/${facilityId}/${sport}/memberships`),
    enabled: !!facilityId && !!sport,
  });

  const createPlan = useMutation({
    mutationFn: () => {
      const num = (s: string) => {
        const n = Number(s);
        return Number.isFinite(n) && s.trim() !== "" ? n : undefined;
      };
      return customFetch(`${API_URL}/facilities/${facilityId}/${sport}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          pricePerYear: Number(pricePerYear),
          pricePerMonth: num(pricePerMonth),
          weeklySlots: Number(weeklySlots),
          conditions: conditions || undefined,
          discountPercent: num(discountPercent),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-memberships", facilityId, sport] });
      setName(""); setDescription(""); setPricePerYear(""); setPricePerMonth("");
      setWeeklySlots("1"); setConditions(""); setDiscountPercent("");
      toast({ title: "Planas sukurtas!" });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const deactivatePlan = useMutation({
    mutationFn: (planId: number) => customFetch(`${API_URL}/facilities/${facilityId}/${sport}/memberships/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-memberships", facilityId, sport] }),
  });

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility?.name} title="Narystės">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
          <ArrowLeft className="w-4 h-4" /> Atgal į aikšteles
        </Button>

        <div className="flex items-center gap-2">
          <Star className="w-6 h-6 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Narystės planai</h1>
            {sport && (
              <p className="text-sm text-muted-foreground">
                Galioja visoms įstaigos „{getSportLabel(sport)}“ aikštelėms
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <h2 className="font-semibold text-sm">Aktyvūs planai</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : plans.filter(p => p.isActive).length === 0 ? (
            <div className="py-8 flex flex-col items-center text-muted-foreground gap-2">
              <Star className="w-8 h-8 opacity-20" />
              <p className="text-sm">Dar nėra narystės planų</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.filter(p => p.isActive).map(plan => (
                <div key={plan.id} className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{plan.name}</div>
                    {plan.description && <div className="text-xs text-muted-foreground mt-0.5">{plan.description}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span className="font-bold text-primary">{plan.pricePerYear}€/metai</span>
                      {plan.pricePerMonth != null && <span>· {plan.pricePerMonth}€/mėn</span>}
                      <span>· {plan.weeklySlots} slot/sav</span>
                      {plan.discountPercent != null && plan.discountPercent > 0 && (
                        <span className="text-emerald-600">· -{plan.discountPercent}%</span>
                      )}
                    </div>
                    {plan.conditions && (
                      <div className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{plan.conditions}</div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => deactivatePlan.mutate(plan.id)} title="Deaktyvuoti">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm">Naujas planas</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Pavadinimas</Label>
              <Input placeholder="pvz. Standartinė narystė" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kaina (€/metus)</Label>
              <Input type="number" placeholder="360" value={pricePerYear} onChange={e => setPricePerYear(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kaina (€/mėn, neprivaloma)</Label>
              <Input type="number" placeholder="35" value={pricePerMonth} onChange={e => setPricePerMonth(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slotai/savaitę</Label>
              <Input type="number" min="1" placeholder="2" value={weeklySlots} onChange={e => setWeeklySlots(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nuolaida (%, neprivaloma)</Label>
              <Input type="number" min="0" max="100" placeholder="10" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Aprašymas (neprivaloma)</Label>
              <Input placeholder="pvz. 2 valandos per savaitę" value={description} onChange={e => setDescription(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Sąlygos (neprivaloma)</Label>
              <Textarea rows={3} placeholder="pvz. Galioja darbo dienomis 8–17 val. Atšaukimas ne vėliau kaip prieš 24 val." value={conditions} onChange={e => setConditions(e.target.value)} className="text-sm" />
            </div>
          </div>
          <Button size="sm" disabled={!name || !pricePerYear || createPlan.isPending} onClick={() => createPlan.mutate()} className="w-full gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Sukurti planą
          </Button>
        </div>
      </div>
    </OwnerLayout>
  );
}
