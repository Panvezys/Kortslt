import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OwnerLayout, useFacilityId } from "@/components/owner-layout";
import { LocationPicker, type LocationPickerResult } from "@/components/location-picker";
import { validateEmail, validatePhone } from "@/lib/validators";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

interface Facility {
  id: number;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cancellationWindow?: number | null;
  advanceBookingLimit?: number | null;
  businessHours?: string | null;
}

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday",    label: "Pirmadienis" },
  { key: "tuesday",   label: "Antradienis" },
  { key: "wednesday", label: "Trečiadienis" },
  { key: "thursday",  label: "Ketvirtadienis" },
  { key: "friday",    label: "Penktadienis" },
  { key: "saturday",  label: "Šeštadienis" },
  { key: "sunday",    label: "Sekmadienis" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const DEFAULT_HOURS: Record<DayKey, { open: string; close: string; closed: boolean }> = {
  monday:    { open: "08:00", close: "22:00", closed: false },
  tuesday:   { open: "08:00", close: "22:00", closed: false },
  wednesday: { open: "08:00", close: "22:00", closed: false },
  thursday:  { open: "08:00", close: "22:00", closed: false },
  friday:    { open: "08:00", close: "22:00", closed: false },
  saturday:  { open: "09:00", close: "20:00", closed: false },
  sunday:    { open: "09:00", close: "20:00", closed: false },
};

export default function OwnerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [tab, setTab] = useState<"profile" | "rules" | "hours">("profile");
  const [profileTab, setProfileTab] = useState<"pagrindai" | "vieta" | "kontaktai">("pagrindai");
  const [mapKey, setMapKey] = useState(0);

  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePostcode, setProfilePostcode] = useState("");
  const [profileLatitude, setProfileLatitude] = useState(0);
  const [profileLongitude, setProfileLongitude] = useState(0);

  const [cancellationWindow, setCancellationWindow] = useState("24");
  const [advanceBookingLimit, setAdvanceBookingLimit] = useState("30");

  const [businessHours, setBusinessHours] = useState<Record<DayKey, { open: string; close: string; closed: boolean }>>(DEFAULT_HOURS);

  const { data: facilities, isLoading } = useQuery<Facility[]>({
    queryKey: ["owner-facilities"],
    queryFn: () => customFetch<Facility[]>(`${API_URL}/facilities`),
  });

  const facility = useMemo(() => {
    if (!facilities) return undefined;
    if (facilityId) return facilities.find(f => f.id === facilityId);
    return facilities[0];
  }, [facilities, facilityId]);

  useEffect(() => {
    if (!facility) return;
    setProfileName(facility.name ?? "");
    setProfileDescription(facility.description ?? "");
    setProfileAddress(facility.address ?? "");
    setProfileCity(facility.city ?? "");
    setProfilePhone(facility.phone ?? "");
    setProfileEmail(facility.email ?? "");
    setProfilePostcode(facility.postcode ?? "");
    setProfileLatitude(facility.latitude ?? 0);
    setProfileLongitude(facility.longitude ?? 0);
    setMapKey(k => k + 1);
    setCancellationWindow(String(facility.cancellationWindow ?? 24));
    setAdvanceBookingLimit(String(facility.advanceBookingLimit ?? 30));
    if (facility.businessHours) {
      try {
        const parsed = JSON.parse(facility.businessHours);
        setBusinessHours({ ...DEFAULT_HOURS, ...parsed });
      } catch {}
    }
  }, [facility]);

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!facility) throw new Error("No facility");
      return customFetch(`${API_URL}/facilities/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      toast({ title: "Išsaugota" });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  function saveProfile() {
    const emailErr = validateEmail(profileEmail, { required: false });
    if (emailErr) {
      toast({ title: "Klaida", description: emailErr, variant: "destructive" });
      return;
    }
    const phoneErr = validatePhone(profilePhone, { required: false });
    if (phoneErr) {
      toast({ title: "Klaida", description: phoneErr, variant: "destructive" });
      return;
    }
    mutation.mutate({
      name: profileName,
      description: profileDescription || undefined,
      address: profileAddress || undefined,
      city: profileCity || undefined,
      phone: profilePhone || undefined,
      email: profileEmail || undefined,
      postcode: profilePostcode || undefined,
      latitude: profileLatitude || undefined,
      longitude: profileLongitude || undefined,
    });
  }

  function saveRules() {
    mutation.mutate({
      cancellationWindow: Number(cancellationWindow),
      advanceBookingLimit: Number(advanceBookingLimit),
    });
  }

  function saveHours() {
    mutation.mutate({ businessHours: JSON.stringify(businessHours) });
  }

  function setDayField(day: DayKey, field: "open" | "close" | "closed", value: string | boolean) {
    setBusinessHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  const TABS = [
    { key: "profile" as const, label: "Profilis" },
    { key: "rules"   as const, label: "Taisyklės" },
    { key: "hours"   as const, label: "Darbo grafikas" },
  ];

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility?.name} title="Nustatymai">
      <div className="p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Nustatymai</h1>
          {facility && <p className="text-sm text-muted-foreground mt-0.5">{facility.name}</p>}
        </div>

        {isLoading ? (
          <div className="space-y-4 max-w-2xl">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : !facility ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              Objekto nerasta. <a href={`${BASE_URL}/owner`} className="text-primary underline">Sukurkite objektą</a>.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-5">
            <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "profile" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="font-semibold mb-0.5">Objekto profilis</h2>
                  <p className="text-sm text-muted-foreground">Pagrindinė informacija apie jūsų sporto objektą.</p>
                </div>
                <Separator />

                <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none -mx-6 px-6 pb-0">
                  {([
                    { id: "pagrindai", label: "Pagrindai" },
                    { id: "vieta",     label: "Vieta" },
                    { id: "kontaktai", label: "Kontaktai" },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setProfileTab(t.id)}
                      className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                        profileTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >{t.label}</button>
                  ))}
                </div>

                <div className="space-y-4 pt-2">
                  {profileTab === "pagrindai" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Objekto pavadinimas *</Label>
                        <Input
                          value={profileName}
                          onChange={e => setProfileName(e.target.value)}
                          placeholder="pvz. Vilniaus Teniso Klubas"
                        />
                        {!profileName.trim() && <p className="text-xs text-destructive">Privalomas laukas</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Aprašymas</Label>
                        <Textarea
                          value={profileDescription}
                          onChange={e => setProfileDescription(e.target.value)}
                          placeholder="Trumpas objekto aprašymas..."
                          rows={4}
                        />
                      </div>
                    </div>
                  )}

                  {profileTab === "vieta" && (
                    <div className="space-y-4">
                      <LocationPicker
                        key={mapKey}
                        latitude={profileLatitude || 0}
                        longitude={profileLongitude || 0}
                        onChange={(result: LocationPickerResult) => {
                          setProfileLatitude(result.lat);
                          setProfileLongitude(result.lng);
                          if (result.city) setProfileCity(result.city);
                          if (result.address) setProfileAddress(result.address);
                          if (result.postcode != null) setProfilePostcode(result.postcode);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Adresas *</Label>
                          <Input
                            value={profileAddress}
                            onChange={e => setProfileAddress(e.target.value)}
                            placeholder="Auto-užpildoma iš žemėlapio"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Miestas *</Label>
                          <Input
                            value={profileCity}
                            onChange={e => setProfileCity(e.target.value)}
                            placeholder="Auto-užpildoma iš žemėlapio"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Pašto kodas</Label>
                          <Input
                            value={profilePostcode}
                            onChange={e => setProfilePostcode(e.target.value)}
                            placeholder="LT-XXXXX"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Platuma (auto)</Label>
                          <Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" value={profileLatitude || ""} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Ilguma (auto)</Label>
                          <Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" value={profileLongitude || ""} />
                        </div>
                      </div>
                    </div>
                  )}

                  {profileTab === "kontaktai" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Telefonas</Label>
                        <Input
                          value={profilePhone}
                          onChange={e => setProfilePhone(e.target.value)}
                          placeholder="+370..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">El. paštas</Label>
                        <Input
                          type="email"
                          value={profileEmail}
                          onChange={e => setProfileEmail(e.target.value)}
                          placeholder="info@klubas.lt"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveProfile} disabled={mutation.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                  </Button>
                </div>
              </div>
            )}

            {tab === "rules" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="font-semibold mb-0.5">Rezervavimo taisyklės</h2>
                  <p className="text-sm text-muted-foreground">Nustatykite atšaukimo ir išankstinio rezervavimo apribojimus.</p>
                </div>
                <Separator />
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold block mb-1">Atšaukimo langas (valandos)</label>
                    <p className="text-xs text-muted-foreground mb-2">Minimalus laikas prieš rezervaciją, per kurį galima atšaukti nemokamai.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={168}
                        value={cancellationWindow}
                        onChange={e => setCancellationWindow(e.target.value)}
                        className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-sm text-muted-foreground">val.</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold block mb-1">Išankstinio rezervavimo limitas (dienos)</label>
                    <p className="text-xs text-muted-foreground mb-2">Kiek dienų į priekį galima rezervuoti kortą.</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={advanceBookingLimit}
                        onChange={e => setAdvanceBookingLimit(e.target.value)}
                        className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-sm text-muted-foreground">d.</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={saveRules} disabled={mutation.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                  </Button>
                </div>
              </div>
            )}

            {tab === "hours" && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="font-semibold mb-0.5">Darbo grafikas</h2>
                  <p className="text-sm text-muted-foreground">Nustatykite darbo laiką kiekvienai savaitės dienai.</p>
                </div>
                <Separator />
                <div className="space-y-3">
                  {DAYS.map(({ key, label }) => {
                    const day = businessHours[key];
                    return (
                      <div key={key} className={`flex items-center gap-3 py-2 border-b border-border/40 last:border-b-0 ${day.closed ? "opacity-50" : ""}`}>
                        <div className="w-28 shrink-0">
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={day.open}
                            disabled={day.closed}
                            onChange={e => setDayField(key, "open", e.target.value)}
                            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background disabled:cursor-not-allowed"
                          >
                            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span className="text-muted-foreground text-sm">–</span>
                          <select
                            value={day.close}
                            disabled={day.closed}
                            onChange={e => setDayField(key, "close", e.target.value)}
                            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background disabled:cursor-not-allowed"
                          >
                            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={day.closed}
                            onChange={e => setDayField(key, "closed", e.target.checked)}
                            className="rounded"
                          />
                          Uždaryta
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={saveHours} disabled={mutation.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {mutation.isPending ? "Saugoma…" : "Išsaugoti"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
