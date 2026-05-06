import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCourt, useSetCourtPricing, customFetch, getListCourtsQueryKey,
} from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft, Euro, Clock3, Lightbulb, ShoppingBag, ShowerHead, DoorOpen,
  Droplets, Car, Bath, Wifi, Coffee, HeartPulse, Thermometer, Wind, Lock,
  Flame, Plus, X, Images, Upload, Loader2,
} from "lucide-react";
import { CourtImageUpload } from "@/components/court-image-upload";
import { SPORT_LABELS } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const STANDARD_AMENITIES = [
  { id: "floodlights", label: "Prožektoriai", icon: Lightbulb },
  { id: "showers", label: "Dušai", icon: ShowerHead },
  { id: "changing_rooms", label: "Persirengimo kambariai", icon: DoorOpen },
  { id: "water_station", label: "Vandens stotis", icon: Droplets },
  { id: "parking", label: "Parkavimas", icon: Car },
  { id: "toilets", label: "Tualetai", icon: Bath },
  { id: "wifi", label: "Wi-Fi", icon: Wifi },
  { id: "cafe", label: "Kavinė / Baras", icon: Coffee },
  { id: "first_aid", label: "Pirmoji pagalba", icon: HeartPulse },
  { id: "heating", label: "Šildymas", icon: Thermometer },
  { id: "air_conditioning", label: "Oro kondicionierius", icon: Wind },
  { id: "lockers", label: "Spintelės", icon: Lock },
  { id: "sauna", label: "Pirtis", icon: Flame },
] as const;

interface RentableItem { name: string; pricePerSlot: number; stock: number; }

type WorkingHourDay = { open: string; close: string; closed: boolean };
type WorkingHoursMap = Record<string, WorkingHourDay>;
function defaultWorkingHours(): WorkingHoursMap {
  return {
    "0": { open: "08:00", close: "22:00", closed: true },
    "1": { open: "08:00", close: "22:00", closed: false },
    "2": { open: "08:00", close: "22:00", closed: false },
    "3": { open: "08:00", close: "22:00", closed: false },
    "4": { open: "08:00", close: "22:00", closed: false },
    "5": { open: "08:00", close: "22:00", closed: false },
    "6": { open: "09:00", close: "20:00", closed: false },
  };
}
const HOUR_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of [0, 30]) {
    HOUR_OPTIONS.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  }
}

const courtSchema = z.object({
  name: z.string().min(2, "Pavadinimas privalomas"),
  type: z.enum(["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"]),
  description: z.string().optional(),
  pricePerHour: z.coerce.number().min(1),
  imageUrl: z.string().optional(),
  isIndoor: z.boolean().default(false),
  maxPlayers: z.coerce.number().min(2),
  amenities: z.array(z.string()).default([]),
  socialFacebook: z.string().optional(),
  socialInstagram: z.string().optional(),
  socialWhatsapp: z.string().optional(),
  socialWebsite: z.string().optional(),
});
type CourtFormValues = z.infer<typeof courtSchema>;

interface FacilityData { id: number; name: string; ownerUserId?: string | null }

const TABS = [
  { id: "info", label: "Pagrindai" },
  { id: "schedule", label: "Grafikas" },
  { id: "amenities", label: "Patogumai" },
  { id: "media", label: "Medija" },
  { id: "contact", label: "Kontaktai" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function CourtCreatePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  const createCourt = useCreateCourt();
  const setPricing = useSetCourtPricing();
  const facilityId = Number(params.id ?? 0);
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const [formTab, setFormTab] = useState<TabId>("info");
  const [workingHoursState, setWorkingHoursState] = useState<WorkingHoursMap>(defaultWorkingHours());
  const [rentableItems, setRentableItems] = useState<RentableItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [amenityPhotos, setAmenityPhotos] = useState<Record<string, string>>({});
  const [uploadingAmenity, setUploadingAmenity] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    customFetch<FacilityData>(`${API_URL}/facilities/${facilityId}`)
      .then((data) => setFacility(data))
      .finally(() => setLoading(false));
  }, [facilityId]);

  const form = useForm<CourtFormValues>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      name: "",
      type: "tennis",
      description: "",
      pricePerHour: 20,
      imageUrl: "",
      isIndoor: false,
      maxPlayers: 4,
      amenities: [],
      socialFacebook: "",
      socialInstagram: "",
      socialWhatsapp: "",
      socialWebsite: "",
    },
  });

  const handleAmenityPhotoUpload = async (amenityId: string, file: File) => {
    setUploadingAmenity(amenityId);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const resp = await fetch(`${BASE_URL}/api/upload/amenity-photo`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      setAmenityPhotos((prev) => ({ ...prev, [amenityId]: url }));
      toast({ title: "Nuotrauka įkelta" });
    } catch {
      toast({ title: "Klaida", variant: "destructive" });
    } finally {
      setUploadingAmenity(null);
    }
  };

  const onSubmit = async (data: CourtFormValues) => {
    try {
      const cleanStr = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t.length > 0 ? t : undefined;
      };
      const payload: Record<string, unknown> = {
        ...data,
        facilityId,
        rentableItems: rentableItems.length > 0 ? JSON.stringify(rentableItems) : undefined,
        workingHours: JSON.stringify(workingHoursState),
        amenityPhotos: Object.keys(amenityPhotos).length > 0 ? JSON.stringify(amenityPhotos) : undefined,
        description: cleanStr(data.description),
        imageUrl: cleanStr(data.imageUrl),
        socialFacebook: cleanStr(data.socialFacebook),
        socialInstagram: cleanStr(data.socialInstagram),
        socialWhatsapp: cleanStr(data.socialWhatsapp),
        socialWebsite: cleanStr(data.socialWebsite),
      };
      const newCourt = await createCourt.mutateAsync({ data: payload as any });
      try {
        await setPricing.mutateAsync({
          id: (newCourt as any).id,
          data: { defaultPrice: data.pricePerHour, entries: [] } as any,
        });
      } catch { /* pricing failure should not block creation */ }
      queryClient.invalidateQueries({
        queryKey: getListCourtsQueryKey(facility?.ownerUserId ? { ownerUserId: facility.ownerUserId } : undefined),
      });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", String(facilityId)] });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      toast({ title: "Aikštelė sukurta — laukia patvirtinimo" });
      navigate(`/owner/facility/${facilityId}`);
    } catch (err) {
      const anyErr = err as any;
      const description =
        (anyErr?.data && typeof anyErr.data === "object" && typeof anyErr.data.error === "string"
          ? anyErr.data.error
          : anyErr?.message) || "Patikrinkite užpildytus laukus";
      toast({ title: "Klaida išsaugant aikštelę", description, variant: "destructive" });
    }
  };

  if (loading || !facility) {
    return (
      <OwnerLayout facilityId={facilityId} title="Pridėti aikštelę">
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </OwnerLayout>
    );
  }

  const dayNames: Record<string, string> = {
    "0": "Sekmadienis", "1": "Pirmadienis", "2": "Antradienis", "3": "Trečiadienis",
    "4": "Ketvirtadienis", "5": "Penktadienis", "6": "Šeštadienis",
  };

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility.name} title="Pridėti aikštelę">
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Pridėti naują aikštelę</h1>
            <p className="text-sm text-muted-foreground">{facility.name}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/owner/facility/${facilityId}`)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />Grįžti
          </Button>
        </div>

        <div className="rounded-2xl border bg-card">
          <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFormTab(t.id)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  formTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {formTab === "info" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aikštelės pavadinimas</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sporto šaka</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.keys(SPORT_LABELS).filter((k) => k !== "table-tennis").map((k) => (
                                <SelectItem key={k} value={k}>{SPORT_LABELS[k]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aprašymas</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Trumpas aikštelės aprašymas..." {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Vieta ir adresas paveldimas iš objekto. Redaguokite objekto nustatymuose.</p>
                    </div>
                  </div>
                )}

                {formTab === "schedule" && (
                  <div className="space-y-5">
                    <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5"><Euro className="w-3.5 h-3.5 text-primary" /> Numatytoji kaina (€/val)</FormLabel>
                        <FormControl><Input type="number" min="1" step="0.5" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <p className="text-xs text-muted-foreground">
                      Detalų kainoraštį pagal laiką galėsite redaguoti sukūrus aikštelę.
                    </p>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock3 className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Darbo laikas</span>
                      </div>
                      <div className="space-y-2">
                        {(["1", "2", "3", "4", "5", "6", "0"] as const).map((dayKey) => {
                          const dh = workingHoursState[dayKey] ?? { open: "08:00", close: "22:00", closed: false };
                          return (
                            <div key={dayKey} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                              <span className="w-28 text-sm font-medium shrink-0">{dayNames[dayKey]}</span>
                              <button type="button"
                                onClick={() => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...p[dayKey], closed: !p[dayKey]?.closed } }))}
                                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${dh.closed ? "bg-red-500/15 text-red-500 border border-red-500/30" : "bg-green-500/15 text-green-600 border border-green-500/30"}`}>
                                {dh.closed ? "Uždaryta" : "Atidaryta"}
                              </button>
                              {!dh.closed && (
                                <>
                                  <select className="text-xs border rounded px-1.5 py-1 bg-background" value={dh.open}
                                    onChange={(e) => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...p[dayKey], open: e.target.value } }))}>
                                    {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-muted-foreground text-xs">–</span>
                                  <select className="text-xs border rounded px-1.5 py-1 bg-background" value={dh.close}
                                    onChange={(e) => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...p[dayKey], close: e.target.value } }))}>
                                    {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {formTab === "amenities" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="maxPlayers" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maks. žaidėjai</FormLabel>
                          <FormControl><Input type="number" min="2" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="isIndoor" render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3 h-[62px]">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} /></FormControl>
                          <div><FormLabel className="cursor-pointer">Vidaus aikštelė</FormLabel></div>
                        </FormItem>
                      )} />
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Patogumai</span>
                      </div>
                      <FormField control={form.control} name="amenities" render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STANDARD_AMENITIES.map(({ id, label, icon: Icon }) => {
                              const checked = (field.value ?? []).includes(id);
                              return (
                                <button key={id} type="button"
                                  onClick={() => {
                                    const cur = field.value ?? [];
                                    field.onChange(checked ? cur.filter((a) => a !== id) : [...cur, id]);
                                  }}
                                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium transition-all text-left ${checked ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-border hover:border-primary/40"}`}>
                                  <Icon className={`w-4 h-4 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                                  {label}
                                  {checked && amenityPhotos[id] && <Images className="w-3 h-3 ml-auto shrink-0 text-primary/70" />}
                                </button>
                              );
                            })}
                          </div>
                          {(field.value ?? []).length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Images className="w-3.5 h-3.5" /> Nuotraukos patogumiams
                              </p>
                              {STANDARD_AMENITIES.filter((a) => (field.value ?? []).includes(a.id)).map(({ id, label, icon: Icon }) => {
                                const photoUrl = amenityPhotos[id];
                                const isUploading = uploadingAmenity === id;
                                return (
                                  <div key={id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
                                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm flex-1 truncate">{label}</span>
                                    {photoUrl ? (
                                      <>
                                        <img src={photoUrl} alt={label} className="w-10 h-10 rounded object-cover" />
                                        <button type="button"
                                          onClick={() => setAmenityPhotos((prev) => { const n = { ...prev }; delete n[id]; return n; })}
                                          className="text-muted-foreground hover:text-destructive">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <label className="cursor-pointer shrink-0">
                                        <input type="file" accept="image/*" className="hidden" disabled={isUploading}
                                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAmenityPhotoUpload(id, f); e.target.value = ""; }} />
                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${isUploading ? "opacity-70 cursor-not-allowed" : "hover:border-primary hover:text-primary"}`}>
                                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                          {isUploading ? "Keliama..." : "Įkelti"}
                                        </span>
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </FormItem>
                      )} />
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Nuomojama įranga</span>
                      </div>
                      <div className="space-y-2">
                        {rentableItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{item.pricePerSlot}€</span>
                              <span className="text-muted-foreground">· {item.stock} vnt.</span>
                              <button type="button" onClick={() => setRentableItems((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                          <Input placeholder="Pavadinimas" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="flex-1 min-w-[140px]" />
                          <Input type="number" placeholder="€" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-20" />
                          <Input type="number" placeholder="Kiekis" value={newItemStock} onChange={(e) => setNewItemStock(e.target.value)} className="w-20" />
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => {
                              const price = parseFloat(newItemPrice);
                              const stock = parseInt(newItemStock);
                              if (newItemName.trim() && !isNaN(price) && price >= 0 && !isNaN(stock) && stock >= 1) {
                                setRentableItems((p) => [...p, { name: newItemName.trim(), pricePerSlot: price, stock }]);
                                setNewItemName(""); setNewItemPrice(""); setNewItemStock("");
                              }
                            }}
                            disabled={!newItemName.trim() || !newItemPrice || !newItemStock}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {formTab === "media" && (
                  <div className="space-y-4">
                    <FormField control={form.control} name="imageUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pagrindinė nuotrauka</FormLabel>
                        <FormControl>
                          <CourtImageUpload
                            value={field.value}
                            onChange={(path) => form.setValue("imageUrl", path)}
                            onClear={() => form.setValue("imageUrl", "")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <p className="text-xs text-muted-foreground">
                      Papildomą nuotraukų galeriją galėsite valdyti sukūrus aikštelę.
                    </p>
                  </div>
                )}

                {formTab === "contact" && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold mb-3">Socialiniai tinklai</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="socialFacebook" render={({ field }) => (
                        <FormItem><FormLabel>Facebook</FormLabel><FormControl><Input placeholder="https://facebook.com/..." {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="socialInstagram" render={({ field }) => (
                        <FormItem><FormLabel>Instagram</FormLabel><FormControl><Input placeholder="https://instagram.com/..." {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="socialWhatsapp" render={({ field }) => (
                        <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input placeholder="https://wa.me/370..." {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="socialWebsite" render={({ field }) => (
                        <FormItem><FormLabel>Svetainė</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="flex gap-1">
                    {formTab !== "info" && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => {
                        const idx = TABS.findIndex((t) => t.id === formTab);
                        if (idx > 0) setFormTab(TABS[idx - 1].id);
                      }}>← Atgal</Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
                      Atšaukti
                    </Button>
                    {formTab !== "contact" ? (
                      <Button type="button" size="sm" onClick={() => {
                        const idx = TABS.findIndex((t) => t.id === formTab);
                        if (idx < TABS.length - 1) setFormTab(TABS[idx + 1].id);
                      }}>Toliau →</Button>
                    ) : (
                      <Button type="submit" disabled={createCourt.isPending || setPricing.isPending}>
                        {createCourt.isPending ? "Kuriama..." : "Sukurti aikštelę"}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}
