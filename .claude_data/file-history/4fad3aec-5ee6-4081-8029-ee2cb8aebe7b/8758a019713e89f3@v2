import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Plus, Edit2, Trash2, PauseCircle, User, Users, Clock, MapPin } from "lucide-react";
import { CoachLayout } from "@/components/coach-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { SportPill } from "@/components/sport-icon";
import { centsToEuroString } from "@/lib/money";
import { useViewAsCoach, withCoachViewAs } from "@/lib/view-as-coach";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface MyCoach {
  id: number;
  sports: string[];
  pricePerHour: number | null;
}

interface CoachService {
  id: number;
  coachId: number;
  name: string;
  description: string | null;
  sport: string;
  courtId: number | null;
  isLocationProvidedByCoach: boolean;
  durationMin: number;
  priceCents: number;
  maxParticipants: number;
  audienceLevel: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface CoachFacilityGroup {
  facilityId: number | null;
  facilityName: string | null;
  city: string | null;
  address: string | null;
  courts: Array<{ id: number; name: string }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AUDIENCE_LT: Record<string, string> = {
  kids: "Vaikai",
  beginners: "Pradedantieji",
  advanced: "Pažengę",
  pros: "Profesionalai",
};

const AUDIENCE_OPTIONS = [
  { value: "kids", label: "Vaikai" },
  { value: "beginners", label: "Pradedantieji" },
  { value: "advanced", label: "Pažengę" },
  { value: "pros", label: "Profesionalai" },
] as const;

const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 val." },
  { value: "90", label: "1.5 val." },
  { value: "120", label: "2 val." },
] as const;

// Mirror of the server-side ceiling in routes/coach-services.ts.
const SERVICE_CATALOG_LIMIT = 15;
const COURT_ANY_VALUE = "__any__";
const AUDIENCE_NONE_VALUE = "__none__";

// Location type values used only in the form UI — collapsed into
// courtId / isLocationProvidedByCoach before sending to the API.
type LocationType = "floating" | "bound" | "independent";
function deriveLocationType(svc: CoachService): LocationType {
  if (svc.isLocationProvidedByCoach) return "independent";
  if (svc.courtId != null) return "bound";
  return "floating";
}

// ─── Form schema + helpers ──────────────────────────────────────────────────

const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "Pavadinimas yra privalomas").max(120, "Per ilgas"),
  description: z.string().trim().max(1000, "Per ilgas aprašymas"),
  sport: z.string().trim().min(1, "Pasirinkite sporto šaką"),
  durationMin: z.string().refine(
    v => ["30", "60", "90", "120"].includes(v),
    { message: "Pasirinkite trukmę" },
  ),
  priceEur: z.string()
    .trim()
    .min(1, "Įveskite kainą")
    .regex(/^\d+([.,]\d{1,2})?$/, "Netinkamas formatas, pvz. 35 arba 35,50"),
  maxParticipants: z.string().refine(
    v => /^[1-8]$/.test(v),
    { message: "Nuo 1 iki 8" },
  ),
  audienceLevel: z.string(),
  locationType: z.enum(["floating", "bound", "independent"]),
  courtBinding: z.string(),
  isActive: z.boolean(),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = min / 60;
  if (Number.isInteger(hours)) return `${hours} val.`;
  return `${hours.toString().replace(".", ",")} val.`;
}

function priceEurToCents(raw: string): number {
  const normalized = raw.replace(",", ".");
  const euros = parseFloat(normalized);
  if (!Number.isFinite(euros) || euros < 0) return 0;
  return Math.round(euros * 100);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CoachServicesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { asCoachId } = useViewAsCoach();
  const isViewingAs = asCoachId != null;

  // Resolve the coach (own or impersonated) so we know which /coaches/:id/...
  // path to call below.
  const coachQ = useQuery<MyCoach | null>({
    queryKey: ["coach-me-services-ctx", asCoachId],
    queryFn: async () => {
      const r = await fetch(withCoachViewAs(`${API}/coaches/me`), { credentials: "include" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to fetch coach profile");
      return r.json();
    },
  });
  const coach = coachQ.data;
  const coachId = coach?.id;

  const facilitiesQ = useQuery<CoachFacilityGroup[]>({
    queryKey: ["coach-facilities", coachId],
    queryFn: () => fetch(`${API}/coaches/${coachId}/facilities`).then(r => r.json()),
    enabled: !!coachId,
  });

  const servicesQ = useQuery<CoachService[]>({
    queryKey: ["coach-services", coachId],
    queryFn: () => fetch(`${API}/coaches/${coachId}/services`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    enabled: !!coachId,
  });

  // ─── Dialog state ─────────────────────────────────────────────────────────
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [pendingDeleteServiceId, setPendingDeleteServiceId] = useState<number | null>(null);

  const serviceForm = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sport: "",
      durationMin: "60",
      priceEur: "",
      maxParticipants: "1",
      audienceLevel: "",
      locationType: "floating",
      courtBinding: COURT_ANY_VALUE,
      isActive: true,
    },
  });

  const locationType = serviceForm.watch("locationType") as LocationType;

  // Flatten approved courts → friendly labels. Pulls from the same source the
  // public profile uses so the picker can never offer a court the coach isn't
  // approved at — matches assertCoachOwnsCourt on the server.
  const approvedCourtOptions = useMemo(() => {
    const out: Array<{ id: number; label: string }> = [];
    for (const f of facilitiesQ.data ?? []) {
      for (const c of f.courts) {
        const facilityBit = f.facilityName ? ` · ${f.facilityName}` : "";
        out.push({ id: c.id, label: `${c.name}${facilityBit}` });
      }
    }
    return out;
  }, [facilitiesQ.data]);

  // Invariant A: pricePerHour is denormalized server-side, so invalidate the
  // coach + marketplace caches alongside the service list on every write.
  function invalidateAfterServiceMutation() {
    qc.invalidateQueries({ queryKey: ["coach-services", coachId] });
    qc.invalidateQueries({ queryKey: ["coach"] });
    qc.invalidateQueries({ queryKey: ["coaches"] });
    qc.invalidateQueries({ queryKey: ["coach-me-services-ctx"] });
  }

  const createServiceMut = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      if (!coachId) throw new Error("Trūksta trenerio ID");
      const r = await fetch(`${API}/coaches/${coachId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: values.name,
          description: values.description.trim() || null,
          sport: values.sport,
          durationMin: parseInt(values.durationMin, 10),
          priceCents: priceEurToCents(values.priceEur),
          maxParticipants: parseInt(values.maxParticipants, 10),
          audienceLevel: values.audienceLevel || null,
          isLocationProvidedByCoach: values.locationType === "independent",
          courtId: values.locationType === "bound" && values.courtBinding !== COURT_ANY_VALUE
            ? parseInt(values.courtBinding, 10)
            : null,
          isActive: values.isActive,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? "Nepavyko sukurti paslaugos");
      }
      return r.json();
    },
    onSuccess: () => {
      invalidateAfterServiceMutation();
      toast({ title: "Paslauga sukurta" });
      setServiceDialogOpen(false);
      setEditingServiceId(null);
      serviceForm.reset();
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const updateServiceMut = useMutation({
    mutationFn: async ({ serviceId, values }: { serviceId: number; values: ServiceFormValues }) => {
      if (!coachId) throw new Error("Trūksta trenerio ID");
      const r = await fetch(`${API}/coaches/${coachId}/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: values.name,
          description: values.description.trim() || null,
          sport: values.sport,
          durationMin: parseInt(values.durationMin, 10),
          priceCents: priceEurToCents(values.priceEur),
          maxParticipants: parseInt(values.maxParticipants, 10),
          audienceLevel: values.audienceLevel || null,
          isLocationProvidedByCoach: values.locationType === "independent",
          courtId: values.locationType === "bound" && values.courtBinding !== COURT_ANY_VALUE
            ? parseInt(values.courtBinding, 10)
            : null,
          isActive: values.isActive,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? "Nepavyko atnaujinti");
      }
      return r.json();
    },
    onSuccess: () => {
      invalidateAfterServiceMutation();
      toast({ title: "Paslauga atnaujinta" });
      setServiceDialogOpen(false);
      setEditingServiceId(null);
      serviceForm.reset();
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const deleteServiceMut = useMutation({
    mutationFn: async (serviceId: number) => {
      if (!coachId) throw new Error("Trūksta trenerio ID");
      const r = await fetch(`${API}/coaches/${coachId}/services/${serviceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? "Nepavyko ištrinti");
      }
      return r.json() as Promise<{ deleted: boolean; deactivated: boolean }>;
    },
    onSuccess: (result) => {
      invalidateAfterServiceMutation();
      toast({
        title: result.deactivated ? "Paslauga sustabdyta" : "Paslauga pašalinta",
        description: result.deactivated
          ? "Ji buvo susieta su rezervacijomis, todėl liko istorijoje."
          : undefined,
      });
      setPendingDeleteServiceId(null);
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
      setPendingDeleteServiceId(null);
    },
  });

  function openServiceCreate() {
    setEditingServiceId(null);
    serviceForm.reset({
      name: "",
      description: "",
      sport: (coach?.sports ?? [])[0] ?? "",
      durationMin: "60",
      priceEur: "",
      maxParticipants: "1",
      audienceLevel: "",
      locationType: "floating",
      courtBinding: COURT_ANY_VALUE,
      isActive: true,
    });
    setServiceDialogOpen(true);
  }

  function openServiceEdit(svc: CoachService) {
    setEditingServiceId(svc.id);
    serviceForm.reset({
      name: svc.name,
      description: svc.description ?? "",
      sport: svc.sport,
      durationMin: String(svc.durationMin),
      priceEur: centsToEuroString(svc.priceCents),
      maxParticipants: String(svc.maxParticipants),
      audienceLevel: svc.audienceLevel ?? "",
      locationType: deriveLocationType(svc),
      courtBinding: svc.courtId != null ? String(svc.courtId) : COURT_ANY_VALUE,
      isActive: svc.isActive,
    });
    setServiceDialogOpen(true);
  }

  function submitServiceForm(values: ServiceFormValues) {
    if (editingServiceId != null) {
      updateServiceMut.mutate({ serviceId: editingServiceId, values });
    } else {
      createServiceMut.mutate(values);
    }
  }

  const services = servicesQ.data ?? [];
  const atLimit = services.length >= SERVICE_CATALOG_LIMIT;

  return (
    <CoachLayout title="Paslaugos">
      <div className="px-4 md:px-6 py-6 space-y-6 max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Paslaugos</h1>
          <p className="text-sm text-muted-foreground">
            Paslaugos atsiranda viešame profilyje ir paieškoje. Žemiausia kaina automatiškai tampa „pradedant nuo" rodikliu.
          </p>
        </header>

        {coach?.pricePerHour != null && coach.pricePerHour > 0 && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <strong className="text-foreground">Bazinė valandinė kaina paieškoje:</strong>{" "}
            {centsToEuroString(coach.pricePerHour)} €/val.{" "}
            <span className="text-muted-foreground/80">— apskaičiuojama automatiškai pagal pigiausią aktyvią paslaugą.</span>
          </div>
        )}

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Mano paslaugos
            </h2>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Button
                size="sm"
                onClick={openServiceCreate}
                disabled={atLimit || isViewingAs}
                title={
                  atLimit
                    ? `Pasiektas paslaugų limitas (${SERVICE_CATALOG_LIMIT})`
                    : isViewingAs
                      ? "Žiūrite kaip kitas treneris — keisti negalima"
                      : undefined
                }
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Pridėti paslaugą
              </Button>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {services.length}/{SERVICE_CATALOG_LIMIT}
              </span>
            </div>
          </div>

          {servicesQ.isLoading || coachQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center bg-muted/30 rounded-lg border border-dashed">
              Dar neturite paslaugų. Paspauskite „Pridėti paslaugą", kad pridėtumėte pirmąją.
            </div>
          ) : (
            <div className="space-y-3">
              {services.map(svc => (
                <div
                  key={svc.id}
                  className={`border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all bg-card ${
                    !svc.isActive ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm md:text-base text-foreground">
                          {svc.name}
                        </h3>
                        <SportPill sport={svc.sport} variant="subtle" size="sm" />
                        <Badge variant="secondary" className="text-[10px] gap-1 font-medium">
                          {svc.maxParticipants > 1 ? (
                            <>
                              <Users className="w-3 h-3" />
                              Grupinė · iki {svc.maxParticipants} asm.
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              Individuali
                            </>
                          )}
                        </Badge>
                        {svc.isLocationProvidedByCoach && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                            <MapPin className="w-3 h-3" />
                            Vieta įskaičiuota
                          </Badge>
                        )}
                        {!svc.isActive && (
                          <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground">
                            <PauseCircle className="w-3 h-3" />
                            Sustabdyta
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(svc.durationMin)}
                        </span>
                        {svc.audienceLevel && AUDIENCE_LT[svc.audienceLevel] && (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {AUDIENCE_LT[svc.audienceLevel]}
                          </span>
                        )}
                      </div>
                      {svc.description && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {svc.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end md:flex-col md:items-end gap-3 md:gap-2 shrink-0 pt-1 md:pt-0 md:min-w-[140px]">
                      <div className="text-lg md:text-xl font-bold tabular-nums text-foreground">
                        {centsToEuroString(svc.priceCents)}€
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openServiceEdit(svc)}
                          disabled={isViewingAs}
                          className="h-8 px-2"
                          title={isViewingAs ? "Žiūrite kaip kitas treneris — keisti negalima" : undefined}
                        >
                          <Edit2 className="w-3.5 h-3.5 md:mr-1.5" />
                          <span className="hidden md:inline">Redaguoti</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingDeleteServiceId(svc.id)}
                          disabled={isViewingAs}
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          title={isViewingAs ? "Žiūrite kaip kitas treneris — keisti negalima" : undefined}
                        >
                          <Trash2 className="w-3.5 h-3.5 md:mr-1.5" />
                          <span className="hidden md:inline">Ištrinti</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Service upsert dialog ─────────────────────────────────────── */}
      <Dialog open={serviceDialogOpen} onOpenChange={(o) => {
        setServiceDialogOpen(o);
        if (!o) { setEditingServiceId(null); serviceForm.reset(); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingServiceId == null ? "Pridėti paslaugą" : "Redaguoti paslaugą"}</DialogTitle>
            <DialogDescription>
              Paslauga atsiranda viešame profilyje ir paieškoje. Žemiausia kaina automatiškai tampa „pradedant nuo" rodikliu.
            </DialogDescription>
          </DialogHeader>

          <Form {...serviceForm}>
            <form
              onSubmit={serviceForm.handleSubmit(submitServiceForm)}
              className="space-y-4"
            >
              <FormField
                control={serviceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pavadinimas</FormLabel>
                    <FormControl>
                      <Input placeholder="Pvz. Individuali treniruotė" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={serviceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aprašymas (nebūtina)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Trumpas aprašymas, ką apima ši paslauga"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={serviceForm.control}
                  name="sport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sporto šaka</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pasirinkite" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(coach?.sports ?? []).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={serviceForm.control}
                  name="durationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trukmė</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DURATION_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={serviceForm.control}
                  name="priceEur"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kaina (€)</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="35"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={serviceForm.control}
                  name="maxParticipants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maks. dalyvių</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? "1 (individualus)" : `${n}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={serviceForm.control}
                name="audienceLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auditorija (nebūtina)</FormLabel>
                    <Select
                      value={field.value === "" ? AUDIENCE_NONE_VALUE : field.value}
                      onValueChange={(v) => field.onChange(v === AUDIENCE_NONE_VALUE ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Visi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={AUDIENCE_NONE_VALUE}>Visi (nenurodyta)</SelectItem>
                        {AUDIENCE_OPTIONS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={serviceForm.control}
                name="locationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vieta</FormLabel>
                    <div className="space-y-2">
                      {(["floating", "independent", "bound"] as const).map((type) => {
                        const labels: Record<LocationType, { title: string; desc: string }> = {
                          floating: { title: "Mokinys pasirenka aikštelę", desc: "Studentas pats rezervuoja ir apmoka platformos aikštelę." },
                          independent: { title: "Treneris pasirūpina vieta", desc: "Aikštelė įskaičiuota į kainą — studentas moka tik už paslaugą." },
                          bound: { title: "Priskirta konkrečiai aikštelei", desc: "Paslauga teikiama tik jūsų pasirinktoje partnerinėje aikštelėje." },
                        };
                        const { title, desc } = labels[type];
                        const active = field.value === type;
                        return (
                          <label key={type}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                          >
                            <input type="radio" className="mt-0.5 accent-primary" checked={active}
                              onChange={() => field.onChange(type)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {locationType === "bound" && (
                <FormField
                  control={serviceForm.control}
                  name="courtBinding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aikštelė</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pasirinkite aikštelę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {approvedCourtOptions.length === 0 ? (
                            <SelectItem value={COURT_ANY_VALUE} disabled>Nėra patvirtintų aikštelių</SelectItem>
                          ) : approvedCourtOptions.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={serviceForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm">Aktyvi</FormLabel>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sustabdytos paslaugos lieka jūsų istorijoje, bet nematomos klientams.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setServiceDialogOpen(false);
                    setEditingServiceId(null);
                    serviceForm.reset();
                  }}
                  disabled={createServiceMut.isPending || updateServiceMut.isPending}
                >
                  Atšaukti
                </Button>
                <Button
                  type="submit"
                  disabled={createServiceMut.isPending || updateServiceMut.isPending || isViewingAs}
                >
                  {editingServiceId == null ? "Sukurti" : "Išsaugoti"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation ──────────────────────────────────────── */}
      <AlertDialog
        open={pendingDeleteServiceId != null}
        onOpenChange={(o) => { if (!o) setPendingDeleteServiceId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ištrinti paslaugą?</AlertDialogTitle>
            <AlertDialogDescription>
              Jeigu paslauga jau yra susieta su rezervacijomis, ji bus tik sustabdyta (klientai jos nebematys). Priešingu atveju ji bus visiškai pašalinta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteServiceMut.isPending}>Atšaukti</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingDeleteServiceId != null) deleteServiceMut.mutate(pendingDeleteServiceId); }}
              disabled={deleteServiceMut.isPending}
            >
              Ištrinti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CoachLayout>
  );
}
