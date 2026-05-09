import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCourt, useUpdateCourt, useSetCourtPricing, customFetch, getListCourtsQueryKey,
  useGetCourt, useGetCourtPricing, getGetCourtQueryKey, getGetCourtPricingQueryKey,
  useGetCourtPriceOverrides, useSetCourtPriceOverrides, getGetCourtPriceOverridesQueryKey,
} from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft, Euro, Clock3, Lightbulb, ShoppingBag, ShowerHead, DoorOpen,
  Droplets, Car, Bath, Wifi, Coffee, HeartPulse, Thermometer, Wind, Lock,
  Flame, Plus, X, Images, Upload, Loader2, MapPin, RotateCcw, CalendarClock, Zap, Trash2,
} from "lucide-react";
import { CourtImageUpload } from "@/components/court-image-upload";
import { SPORT_LABELS } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;
const MAX_GALLERY_PHOTOS = 3;

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

// Court working hours use numeric day-of-week keys ("0"=Sunday … "6"=Saturday).
// Defaults must match the facility's DEFAULT_HOURS in settings.tsx so the
// inheritance preview shows the same values when the facility has no saved
// businessHours yet.
function defaultWorkingHours(): WorkingHoursMap {
  return {
    "0": { open: "09:00", close: "20:00", closed: false }, // Sunday
    "1": { open: "08:00", close: "22:00", closed: false },
    "2": { open: "08:00", close: "22:00", closed: false },
    "3": { open: "08:00", close: "22:00", closed: false },
    "4": { open: "08:00", close: "22:00", closed: false },
    "5": { open: "08:00", close: "22:00", closed: false },
    "6": { open: "09:00", close: "20:00", closed: false }, // Saturday
  };
}

// Facility business hours use named keys ("monday"…"sunday"). Convert → court format.
const FACILITY_DAY_TO_NUM: Record<string, string> = {
  sunday: "0", monday: "1", tuesday: "2", wednesday: "3",
  thursday: "4", friday: "5", saturday: "6",
};
function facilityHoursToCourtFormat(jsonStr: string | null | undefined): WorkingHoursMap | null {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, WorkingHourDay>;
    const out: WorkingHoursMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const num = FACILITY_DAY_TO_NUM[k.toLowerCase()];
      if (num && v && typeof v === "object") {
        out[num] = { open: v.open ?? "08:00", close: v.close ?? "22:00", closed: !!v.closed };
      }
    }
    // Fill in any missing days
    for (const d of ["0", "1", "2", "3", "4", "5", "6"]) {
      if (!out[d]) out[d] = { open: "08:00", close: "22:00", closed: false };
    }
    return out;
  } catch { return null; }
}

const HOUR_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of [0, 30]) {
    HOUR_OPTIONS.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  }
}

// 30-min slots range generator (used for pricing grid)
function generateSlotsRange(open: string, close: string): string[] {
  const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const openMin = toM(open);
  const closeMin = toM(close);
  const out: string[] = [];
  for (let m = openMin; m + 30 <= closeMin; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}
const DAYS_FULL = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];
const DAYS_SHORT = ["Sek", "Pir", "Ant", "Tre", "Ket", "Pen", "Šeš"];
const dayNames: Record<string, string> = {
  "0": "Sekmadienis", "1": "Pirmadienis", "2": "Antradienis", "3": "Trečiadienis",
  "4": "Ketvirtadienis", "5": "Penktadienis", "6": "Šeštadienis",
};

const courtSchema = z.object({
  name: z.string().min(2, "Pavadinimas privalomas"),
  type: z.enum(["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"]),
  description: z.string().optional(),
  pricePerHour: z.coerce.number().min(1),
  imageUrl: z.string().optional(),
  isIndoor: z.boolean().default(false),
  maxPlayers: z.coerce.number().min(2),
  amenities: z.array(z.string()).default([]),
  surface: z.string().optional(),
  surfaceSpeed: z.string().optional(),
  surfaceBounce: z.string().optional(),
  hasSmartLock: z.boolean().default(false),
  accessInstructions: z.string().optional(),
});
type CourtFormValues = z.infer<typeof courtSchema>;

interface FacilityData {
  id: number;
  name: string;
  ownerUserId?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  businessHours?: string | null;
  websiteUrl?: string | null;
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialWhatsapp?: string | null;
  verificationStatus?: string | null;
}

const TABS = [
  { id: "info", label: "Pagrindai" },
  { id: "schedule", label: "Grafikas" },
  { id: "pricing", label: "Kainoraštis" },
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
  const updateCourt = useUpdateCourt();
  const setPricing = useSetCourtPricing();
  const facilityId = Number(params.id ?? 0);
  const editingCourtId = params.courtId ? Number(params.courtId) : null;
  const isEdit = editingCourtId !== null;
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [formTab, setFormTab] = useState<TabId>("info");

  // Working hours: inherit from facility by default; override flag = use court-specific hours
  const [overrideHours, setOverrideHours] = useState(false);
  const [workingHoursState, setWorkingHoursState] = useState<WorkingHoursMap>(defaultWorkingHours());

  // Contacts: inherit from facility by default; override flag = use court-specific contacts
  const [overrideContacts, setOverrideContacts] = useState(false);
  const [courtPhone, setCourtPhone] = useState("");
  const [courtFacebook, setCourtFacebook] = useState("");
  const [courtInstagram, setCourtInstagram] = useState("");
  const [courtWhatsapp, setCourtWhatsapp] = useState("");
  const [courtWebsite, setCourtWebsite] = useState("");

  // Per-slot pricing: local price map saved after court creation
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [pricingDay, setPricingDay] = useState(1);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Bulk apply state
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkFromTime, setBulkFromTime] = useState("08:00");
  const [bulkToTime, setBulkToTime] = useState("22:00");
  const [bulkDays, setBulkDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Date override state
  const [overrideDate, setOverrideDate] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideFromTime, setOverrideFromTime] = useState("08:00");
  const [overrideToTime, setOverrideToTime] = useState("22:00");
  // local map: date → (startTime → price)
  const [dateOverrides, setDateOverrides] = useState<Record<string, Record<string, number>>>({});

  // Photo gallery: local file buffer uploaded after court creation
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState<{ current: number; total: number } | null>(null);

  const [rentableItems, setRentableItems] = useState<RentableItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [amenityPhotos, setAmenityPhotos] = useState<Record<string, string>>({});
  const [uploadingAmenity, setUploadingAmenity] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    customFetch<FacilityData>(`${API_URL}/facilities/${facilityId}`)
      .then((data) => {
        setFacility(data);
        // Pre-fill working hours from facility's businessHours
        const fromFacility = facilityHoursToCourtFormat(data.businessHours);
        if (fromFacility) setWorkingHoursState(fromFacility);
        // Pre-fill contacts
        setCourtPhone(data.phone ?? "");
        setCourtFacebook(data.socialFacebook ?? "");
        setCourtInstagram(data.socialInstagram ?? "");
        setCourtWhatsapp(data.socialWhatsapp ?? "");
        setCourtWebsite(data.websiteUrl ?? "");
      })
      .finally(() => setLoading(false));
  }, [facilityId]);

  // Cleanup blob URLs on unmount / change
  useEffect(() => {
    return () => { galleryPreviews.forEach((u) => URL.revokeObjectURL(u)); };
  }, [galleryPreviews]);

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
      surface: "",
      surfaceSpeed: "",
      surfaceBounce: "",
      hasSmartLock: false,
      accessInstructions: "",
    },
  });

  // Edit-mode: load existing court + pricing and hydrate form/state once.
  const { data: editingCourt } = useGetCourt(editingCourtId ?? 0, {
    query: {
      queryKey: getGetCourtQueryKey(editingCourtId ?? 0),
      enabled: isEdit && editingCourtId !== null && editingCourtId > 0,
    },
  });
  const { data: editingPricing } = useGetCourtPricing(editingCourtId ?? 0, {
    query: {
      queryKey: getGetCourtPricingQueryKey(editingCourtId ?? 0),
      enabled: isEdit && editingCourtId !== null && editingCourtId > 0,
    },
  });

  useEffect(() => {
    if (!isEdit || hydrated || !editingCourt) return;
    const c = editingCourt as any;
    form.reset({
      name: c.name ?? "",
      type: c.type ?? "tennis",
      description: c.description ?? "",
      pricePerHour: Number(c.pricePerHour ?? 20),
      imageUrl: c.imageUrl ?? "",
      isIndoor: !!c.isIndoor,
      maxPlayers: Number(c.maxPlayers ?? 4),
      amenities: Array.isArray(c.amenities) ? c.amenities : [],
      surface: c.surface ?? "",
      surfaceSpeed: c.surfaceSpeed ?? "",
      surfaceBounce: c.surfaceBounce ?? "",
      hasSmartLock: !!c.hasSmartLock,
      accessInstructions: c.accessInstructions ?? "",
    });
    if (c.workingHours) {
      try {
        const parsed = JSON.parse(c.workingHours);
        setWorkingHoursState({ ...defaultWorkingHours(), ...parsed });
        setOverrideHours(true);
      } catch { /* keep facility-inherited defaults */ }
    }
    if (c.rentableItems) {
      try {
        const raw: any[] = JSON.parse(c.rentableItems);
        setRentableItems(raw.map((r) => ({
          name: r.name,
          pricePerSlot: r.pricePerSlot ?? r.pricePerBooking ?? 0,
          stock: r.stock ?? 1,
        })));
      } catch { /* ignore */ }
    }
    if (c.amenityPhotos) {
      try {
        const photos = JSON.parse(c.amenityPhotos);
        if (typeof photos === "object" && photos !== null) setAmenityPhotos(photos);
      } catch { /* ignore */ }
    }
    // Contact override: if any court-specific contact value differs from facility, enable override
    const facPhone = facility?.phone ?? "";
    const facFb = facility?.socialFacebook ?? "";
    const facIg = facility?.socialInstagram ?? "";
    const facWa = facility?.socialWhatsapp ?? "";
    const facWeb = facility?.websiteUrl ?? "";
    const cPhone = c.phone ?? "";
    const cFb = c.socialFacebook ?? "";
    const cIg = c.socialInstagram ?? "";
    const cWa = c.socialWhatsapp ?? "";
    const cWeb = c.socialWebsite ?? "";
    const hasOverride =
      (cPhone && cPhone !== facPhone) || (cFb && cFb !== facFb) ||
      (cIg && cIg !== facIg) || (cWa && cWa !== facWa) || (cWeb && cWeb !== facWeb);
    if (hasOverride) {
      setOverrideContacts(true);
      setCourtPhone(cPhone); setCourtFacebook(cFb);
      setCourtInstagram(cIg); setCourtWhatsapp(cWa); setCourtWebsite(cWeb);
    }
    setHydrated(true);
  }, [isEdit, hydrated, editingCourt, facility, form]);

  useEffect(() => {
    if (!isEdit || !editingPricing?.entries) return;
    const map = new Map<string, number>();
    (editingPricing.entries as any[]).forEach((e) => {
      map.set(`${e.dayOfWeek}:${e.startTime}`, Number(e.price));
    });
    setPriceMap(map);
  }, [isEdit, editingPricing]);

  const { data: editingOverrides } = useGetCourtPriceOverrides(editingCourtId ?? 0, {
    query: { enabled: isEdit && !!editingCourtId, queryKey: getGetCourtPriceOverridesQueryKey(editingCourtId ?? 0) },
  });
  const setOverridesMutation = useSetCourtPriceOverrides();

  useEffect(() => {
    if (!isEdit || !editingOverrides?.overrides) return;
    const map: Record<string, Record<string, number>> = {};
    for (const o of editingOverrides.overrides as any[]) {
      if (!map[o.date]) map[o.date] = {};
      map[o.date][o.startTime] = Number(o.price);
    }
    setDateOverrides(map);
  }, [isEdit, editingOverrides]);

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

  const handleAddGalleryFiles = (files: FileList) => {
    const remaining = MAX_GALLERY_PHOTOS - galleryFiles.length;
    if (remaining <= 0) {
      toast({ title: "Pasiektas limitas", description: `Maks. ${MAX_GALLERY_PHOTOS} nuotraukos.`, variant: "destructive" });
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    if (toAdd.length < files.length) {
      toast({ title: `Pridedamos tik ${toAdd.length} nuotraukos` });
    }
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setGalleryFiles((p) => [...p, ...toAdd]);
    setGalleryPreviews((p) => [...p, ...newPreviews]);
  };
  const handleRemoveGallery = (idx: number) => {
    URL.revokeObjectURL(galleryPreviews[idx]);
    setGalleryFiles((p) => p.filter((_, i) => i !== idx));
    setGalleryPreviews((p) => p.filter((_, i) => i !== idx));
  };

  // Pricing helpers
  const defaultSlotPrice = useMemo(() => (form.watch("pricePerHour") || 20) / 2, [form.watch("pricePerHour")]);
  const pricingDayHours = workingHoursState[String(pricingDay)] ?? { open: "08:00", close: "22:00", closed: false };
  const pricingDaySlots = pricingDayHours.closed ? [] : generateSlotsRange(pricingDayHours.open, pricingDayHours.close);
  const getPrice = (day: number, t: string) => {
    const k = `${day}:${t}`;
    return priceMap.has(k) ? priceMap.get(k)! : defaultSlotPrice;
  };
  const startEdit = (day: number, t: string) => {
    setEditingKey(`${day}:${t}`);
    setEditValue(getPrice(day, t).toString());
  };
  const commitEdit = () => {
    if (!editingKey) return;
    const p = parseFloat(editValue);
    if (!isNaN(p) && p >= 0) {
      setPriceMap((prev) => { const next = new Map(prev); next.set(editingKey, p); return next; });
    }
    setEditingKey(null);
  };
  const resetDay = (day: number) => {
    setPriceMap((prev) => {
      const next = new Map(prev);
      for (const k of Array.from(next.keys())) {
        if (k.startsWith(`${day}:`)) next.delete(k);
      }
      return next;
    });
  };

  // Bulk apply: set a single price across selected days and time range
  const applyBulkPrice = () => {
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) return;
    const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fromMin = toM(bulkFromTime);
    const toMin2 = toM(bulkToTime);
    setPriceMap((prev) => {
      const next = new Map(prev);
      for (const day of bulkDays) {
        const dayHours = workingHoursState[String(day)] ?? { open: "08:00", close: "22:00", closed: false };
        if (dayHours.closed) continue;
        const daySlots = generateSlotsRange(dayHours.open, dayHours.close);
        for (const slot of daySlots) {
          const slotMin = toM(slot);
          if (slotMin >= fromMin && slotMin < toMin2) {
            next.set(`${day}:${slot}`, price);
          }
        }
      }
      return next;
    });
  };

  // Date override helpers
  const applyDateOverride = () => {
    if (!overrideDate) return;
    const price = parseFloat(overridePrice);
    if (isNaN(price) || price < 0) return;
    const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fromMin = toM(overrideFromTime);
    const toMin2 = toM(overrideToTime);
    const slots = generateSlotsRange(overrideFromTime, overrideToTime);
    setDateOverrides((prev) => {
      const next = { ...prev };
      if (!next[overrideDate]) next[overrideDate] = {};
      const datePrices = { ...next[overrideDate] };
      for (const slot of slots) {
        const slotMin = toM(slot);
        if (slotMin >= fromMin && slotMin < toMin2) {
          datePrices[slot] = price;
        }
      }
      next[overrideDate] = datePrices;
      return next;
    });
  };
  const removeDateOverride = (date: string) => {
    setDateOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  // Map form field name → tab id (for routing validation errors to the right tab)
  const FIELD_TO_TAB: Record<string, TabId> = {
    name: "info",
    type: "info",
    description: "info",
    surface: "info",
    surfaceSpeed: "info",
    surfaceBounce: "info",
    pricePerHour: "schedule",
    maxPlayers: "amenities",
    isIndoor: "amenities",
    hasSmartLock: "amenities",
    accessInstructions: "amenities",
    imageUrl: "media",
  };
  const FIELD_LABELS: Record<string, string> = {
    name: "Aikštelės pavadinimas",
    type: "Sporto šaka",
    pricePerHour: "Numatytoji kaina",
    maxPlayers: "Maks. žaidėjai",
    description: "Aprašymas",
    imageUrl: "Pagrindinė nuotrauka",
    surface: "Dangos tipas",
    accessInstructions: "Prieigos instrukcijos",
  };

  const onInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const fields = Object.keys(errors);
    if (fields.length === 0) return;
    // Switch to the first tab that has an error (in tab order)
    const tabOrder = TABS.map((t) => t.id) as TabId[];
    let firstTab: TabId | null = null;
    for (const tid of tabOrder) {
      if (fields.some((f) => FIELD_TO_TAB[f] === tid)) { firstTab = tid; break; }
    }
    if (firstTab) setFormTab(firstTab);
    const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
    toast({
      title: "Užpildykite privalomus laukus",
      description: `Trūksta arba neteisingi: ${labels}`,
      variant: "destructive",
    });
  };

  const buildPayload = (data: Partial<CourtFormValues>): Record<string, unknown> => {
    const cleanStr = (v: unknown): string | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    };
    const effPhone     = overrideContacts ? courtPhone     : facility?.phone     ?? "";
    const effFacebook  = overrideContacts ? courtFacebook  : facility?.socialFacebook  ?? "";
    const effInstagram = overrideContacts ? courtInstagram : facility?.socialInstagram ?? "";
    const effWhatsapp  = overrideContacts ? courtWhatsapp  : facility?.socialWhatsapp  ?? "";
    const effWebsite   = overrideContacts ? courtWebsite   : facility?.websiteUrl      ?? "";
    return {
      ...data,
      facilityId,
      rentableItems: rentableItems.length > 0 ? JSON.stringify(rentableItems) : undefined,
      workingHours: overrideHours ? JSON.stringify(workingHoursState) : null,
      amenityPhotos: Object.keys(amenityPhotos).length > 0 ? JSON.stringify(amenityPhotos) : undefined,
      description: cleanStr(data.description),
      imageUrl: cleanStr(data.imageUrl),
      surface: cleanStr((data as any).surface),
      surfaceSpeed: cleanStr((data as any).surfaceSpeed),
      surfaceBounce: cleanStr((data as any).surfaceBounce),
      hasSmartLock: !!(data as any).hasSmartLock,
      accessInstructions: cleanStr((data as any).accessInstructions),
      phone: cleanStr(effPhone),
      socialFacebook: cleanStr(effFacebook),
      socialInstagram: cleanStr(effInstagram),
      socialWhatsapp: cleanStr(effWhatsapp),
      socialWebsite: cleanStr(effWebsite),
    };
  };

  const [savingDraft, setSavingDraft] = useState(false);
  const saveAsDraft = async () => {
    const values = form.getValues();
    const name = (values.name ?? "").trim();
    if (!name) {
      setFormTab("info");
      form.setError("name", { type: "manual", message: "Įveskite bent pavadinimą juodraščiui" });
      toast({
        title: "Reikia bent pavadinimo",
        description: "Įveskite aikštelės pavadinimą, kad išsaugotumėte juodraštį.",
        variant: "destructive",
      });
      return;
    }
    setSavingDraft(true);
    try {
      // Relaxed defaults so the API always accepts the partial draft
      const payload = buildPayload({
        ...values,
        name,
        type: values.type ?? "tennis",
        pricePerHour: values.pricePerHour && values.pricePerHour >= 1 ? values.pricePerHour : 1,
        maxPlayers: values.maxPlayers && values.maxPlayers >= 2 ? values.maxPlayers : 2,
        isIndoor: !!values.isIndoor,
        amenities: values.amenities ?? [],
      });
      (payload as any).status = "draft";
      await createCourt.mutateAsync({ data: payload as any });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", String(facilityId)] });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      toast({ title: "Juodraštis išsaugotas" });
      navigate(`/owner/facility/${facilityId}`);
    } catch (err) {
      const anyErr = err as any;
      toast({
        title: "Nepavyko išsaugoti juodraščio",
        description: anyErr?.data?.error ?? anyErr?.message ?? "Bandykite dar kartą",
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const onSubmit = async (data: CourtFormValues) => {
    try {
      const payload = buildPayload(data);
      let courtIdResult: number;
      if (isEdit && editingCourtId) {
        await updateCourt.mutateAsync({ id: editingCourtId, data: payload as any });
        courtIdResult = editingCourtId;
      } else {
        const newCourt = await createCourt.mutateAsync({ data: payload as any });
        courtIdResult = (newCourt as any).id;
      }
      const newCourtId = courtIdResult;

      // Persist per-slot pricing (defaultPrice + custom entries)
      try {
        const entries: { dayOfWeek: number; startTime: string; price: number }[] = [];
        priceMap.forEach((price, key) => {
          const [dayStr, startTime] = key.split(":");
          const dayOfWeek = parseInt(dayStr);
          if (!isNaN(dayOfWeek) && startTime) entries.push({ dayOfWeek, startTime, price });
        });
        await setPricing.mutateAsync({
          id: newCourtId,
          data: { entries },
        });
      } catch { /* pricing failure should not block save */ }

      // Persist date overrides (one PUT per unique date)
      try {
        const datesWithOverrides = Object.keys(dateOverrides);
        for (const date of datesWithOverrides) {
          const slots = dateOverrides[date];
          const overrideEntries = Object.entries(slots).map(([startTime, price]) => ({
            date, startTime, price,
          }));
          await setOverridesMutation.mutateAsync({
            id: newCourtId,
            data: { date, overrides: overrideEntries },
          });
        }
      } catch { /* override failure should not block save */ }

      // Upload gallery photos sequentially
      if (galleryFiles.length > 0) {
        setUploadingGallery(true);
        setGalleryProgress({ current: 0, total: galleryFiles.length });
        try {
          for (let i = 0; i < galleryFiles.length; i++) {
            setGalleryProgress({ current: i + 1, total: galleryFiles.length });
            const fd = new FormData();
            fd.append("image", galleryFiles[i]);
            const r = await fetch(`${API_URL}/courts/${newCourtId}/photos`, {
              method: "POST", body: fd, credentials: "include",
            });
            if (!r.ok) throw new Error(`Photo upload failed (${r.status})`);
          }
        } catch (e: any) {
          toast({ title: "Galerijos įkėlimas nepavyko", description: e?.message ?? "Bandykite vėliau redaguodami aikštelę", variant: "destructive" });
        } finally {
          setUploadingGallery(false);
          setGalleryProgress(null);
        }
      }

      queryClient.invalidateQueries({
        queryKey: getListCourtsQueryKey(facility?.ownerUserId ? { ownerUserId: facility.ownerUserId } : undefined),
      });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", String(facilityId)] });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      if (isEdit && editingCourtId) {
        queryClient.invalidateQueries({ queryKey: getGetCourtQueryKey(editingCourtId) });
      }
      toast({ title: isEdit ? "Aikštelė atnaujinta" : "Aikštelė sukurta — laukia patvirtinimo" });
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

  if (loading || !facility || (isEdit && !editingCourt)) {
    return (
      <OwnerLayout facilityId={facilityId} title={isEdit ? "Redaguoti aikštelę" : "Pridėti aikštelę"}>
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </OwnerLayout>
    );
  }

  const editAddressHref = `${BASE_URL}/owner/settings?facility=${facilityId}&tab=profile&profileTab=vieta`;
  const courtUnderReview = isEdit && (editingCourt as any)?.status === "pending_review";
  const locked = facility.verificationStatus === "pending_verification" || courtUnderReview;

  // Read-only preview of facility hours when override is OFF
  const facilityHoursDisplay = facilityHoursToCourtFormat(facility.businessHours) ?? defaultWorkingHours();

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility.name} title={isEdit ? "Redaguoti aikštelę" : "Pridėti aikštelę"}>
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{isEdit ? "Redaguoti aikštelę" : "Pridėti naują aikštelę"}</h1>
            <p className="text-sm text-muted-foreground">{facility.name}{isEdit && editingCourt ? ` — ${(editingCourt as any).name}` : ""}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/owner/facility/${facilityId}`)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />Grįžti
          </Button>
        </div>

        {locked && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
            <span className="text-base shrink-0">⚠️</span>
            <span className="font-medium">
              {courtUnderReview
                ? "Aikštelė peržiūrima. Redagavimas laikinai išjungtas."
                : "Kompleksas peržiūrimas. Redagavimas laikinai išjungtas."}
            </span>
          </div>
        )}

        <div className="rounded-2xl border bg-card">
          <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none px-6">
            {TABS.map((t) => {
              const tabErrors = Object.keys(form.formState.errors).filter(
                (f) => FIELD_TO_TAB[f] === t.id,
              );
              const hasError = tabErrors.length > 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormTab(t.id)}
                  className={`relative px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                    formTab === t.id
                      ? hasError ? "border-destructive text-destructive" : "border-primary text-primary"
                      : hasError ? "border-transparent text-destructive" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {hasError && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                      {tabErrors.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={`p-6${locked ? " pointer-events-none opacity-60" : ""}`}>
            <Form {...form}>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-4"
              >
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

                    <div className="rounded-xl border p-4 space-y-3">
                      <p className="font-semibold text-sm">Aikštelės dangos charakteristikos</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField control={form.control} name="surface" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Dangos tipas</FormLabel>
                            <FormControl>
                              <Input placeholder="pvz. Kietoji, Žolė, Akrilas..." {...field} value={field.value ?? ""} />
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="surfaceSpeed" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Greitis</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="slow">Lėtas</SelectItem>
                                <SelectItem value="medium">Vidutinis</SelectItem>
                                <SelectItem value="fast">Greitas</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="surfaceBounce" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Atšokimas</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="low">Žemas</SelectItem>
                                <SelectItem value="medium">Vidutinis</SelectItem>
                                <SelectItem value="high">Aukštas</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 bg-muted/30 flex items-center gap-3 flex-wrap">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-muted-foreground">Vieta ir adresas paveldimas iš objekto. Redaguokite objekto nustatymuose.</p>
                        {facility.address && (
                          <p className="text-xs font-medium mt-0.5">{facility.address}{facility.city ? `, ${facility.city}` : ""}</p>
                        )}
                      </div>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => navigate(`/owner/settings?facility=${facilityId}&tab=profile&profileTab=vieta`)}
                        className="gap-1.5 shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                        Redaguoti adresą
                      </Button>
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
                      Detalų kainoraštį (kainas atskiriems laiko tarpams) galite nustatyti „Kainoraštis“ skirtuke.
                    </p>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Clock3 className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">Darbo laikas</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <Checkbox checked={overrideHours} onCheckedChange={(v) => setOverrideHours(Boolean(v))} />
                          Naudoti skirtingą darbo laiką šiai aikštelei
                        </label>
                      </div>

                      {!overrideHours && (
                        <p className="text-xs text-muted-foreground">
                          Paveldima iš objekto darbo grafiko. Pažymėkite langelį, kad nustatytumėte kitokį.
                        </p>
                      )}

                      <div className="space-y-2">
                        {(["1", "2", "3", "4", "5", "6", "0"] as const).map((dayKey) => {
                          const src = overrideHours ? workingHoursState : facilityHoursDisplay;
                          const dh = src[dayKey] ?? { open: "08:00", close: "22:00", closed: false };
                          const disabled = !overrideHours;
                          return (
                            <div key={dayKey} className={`flex flex-wrap items-center gap-2 py-1.5 border-b border-border/50 last:border-0 ${disabled ? "opacity-70" : ""}`}>
                              <span className="w-28 text-sm font-medium shrink-0">{dayNames[dayKey]}</span>
                              <button type="button"
                                disabled={disabled}
                                onClick={() => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...(p[dayKey] ?? dh), closed: !(p[dayKey]?.closed ?? dh.closed) } }))}
                                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${dh.closed ? "bg-red-500/15 text-red-500 border border-red-500/30" : "bg-green-500/15 text-green-600 border border-green-500/30"} ${disabled ? "cursor-not-allowed" : ""}`}>
                                {dh.closed ? "Uždaryta" : "Atidaryta"}
                              </button>
                              {!dh.closed && (
                                <>
                                  <select className="text-xs border rounded px-1.5 py-1 bg-background disabled:bg-muted/50 disabled:cursor-not-allowed" value={dh.open}
                                    disabled={disabled}
                                    onChange={(e) => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...(p[dayKey] ?? dh), open: e.target.value } }))}>
                                    {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-muted-foreground text-xs">–</span>
                                  <select className="text-xs border rounded px-1.5 py-1 bg-background disabled:bg-muted/50 disabled:cursor-not-allowed" value={dh.close}
                                    disabled={disabled}
                                    onChange={(e) => setWorkingHoursState((p) => ({ ...p, [dayKey]: { ...(p[dayKey] ?? dh), close: e.target.value } }))}>
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

                {formTab === "pricing" && (
                  <div className="space-y-5">
                    {/* Section header */}
                    <div>
                      <p className="font-semibold text-sm mb-0.5">Savaitinis šablonas</p>
                      <p className="text-xs text-muted-foreground">
                        Numatytoji kaina (bazinė): <strong>{defaultSlotPrice.toFixed(2)}€</strong> / 30 min. Tarpai paryškinti mėlyna — custom kaina.
                      </p>
                    </div>

                    {/* ── Bulk Apply panel ─────────────────────────────────── */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Masinis kainų taikymas</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Kaina (€/30 min)</label>
                          <Input type="number" min="0" step="0.5" placeholder="pvz. 10" value={bulkPrice}
                            onChange={(e) => setBulkPrice(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Nuo</label>
                          <select value={bulkFromTime} onChange={(e) => setBulkFromTime(e.target.value)}
                            className="w-full h-8 text-sm border rounded-md px-2 bg-background">
                            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Iki</label>
                          <select value={bulkToTime} onChange={(e) => setBulkToTime(e.target.value)}
                            className="w-full h-8 text-sm border rounded-md px-2 bg-background">
                            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Button type="button" size="sm" className="w-full h-8 text-xs gap-1.5"
                            disabled={!bulkPrice || parseFloat(bulkPrice) < 0 || bulkDays.length === 0}
                            onClick={applyBulkPrice}>
                            <Zap className="w-3 h-3" /> Taikyti
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Dienoms</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {DAYS_SHORT.map((label, i) => {
                            const dh = (overrideHours ? workingHoursState : facilityHoursDisplay)[String(i)];
                            const closed = dh?.closed === true;
                            const selected = bulkDays.includes(i);
                            return (
                              <button key={i} type="button" disabled={closed}
                                onClick={() => setBulkDays(prev => selected ? prev.filter(d => d !== i) : [...prev, i])}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${closed ? "opacity-30 cursor-not-allowed" : selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                                {label}
                              </button>
                            );
                          })}
                          <button type="button" onClick={() => setBulkDays([0,1,2,3,4,5,6])}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:border-primary/50 transition-all">
                            Visos
                          </button>
                          <button type="button" onClick={() => setBulkDays([])}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:border-primary/50 transition-all">
                            Išvalyti
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Weekly template grid ─────────────────────────────── */}
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS_FULL.map((_, i) => {
                        const dh = (overrideHours ? workingHoursState : facilityHoursDisplay)[String(i)];
                        const closed = dh?.closed === true;
                        return (
                          <button key={i} type="button" disabled={closed}
                            onClick={() => !closed && setPricingDay(i)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${closed ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground line-through" : pricingDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                            {DAYS_SHORT[i]}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
                        <span className="text-sm font-semibold">{DAYS_FULL[pricingDay]}</span>
                        {pricingDaySlots.length > 0 && (
                          <button type="button" onClick={() => resetDay(pricingDay)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" /> Atstatyti numatytąją
                          </button>
                        )}
                      </div>
                      {pricingDaySlots.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">Ši diena uždaryta pagal darbo valandas</div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-border max-h-72 overflow-y-auto">
                          {pricingDaySlots.map((startTime) => {
                            const key = `${pricingDay}:${startTime}`;
                            const isEditing = editingKey === key;
                            const price = getPrice(pricingDay, startTime);
                            const isCustom = priceMap.has(key);
                            return (
                              <div key={startTime}
                                className={`bg-card p-2 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-primary/5 transition-colors ${isEditing ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                                onClick={() => !isEditing && startEdit(pricingDay, startTime)}>
                                <span className="text-xs text-muted-foreground font-medium">{startTime}</span>
                                {isEditing ? (
                                  <input autoFocus type="number" value={editValue} min={0} step={0.5}
                                    onChange={(e) => setEditValue(e.target.value)} onBlur={commitEdit}
                                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingKey(null); }}
                                    className="w-full text-center text-xs font-bold bg-transparent border-0 outline-none p-0 text-primary"
                                    onClick={(e) => e.stopPropagation()} />
                                ) : (
                                  <span className={`text-sm font-bold flex items-center gap-0.5 ${isCustom ? "text-primary" : "text-foreground"}`}>
                                    <Euro className="w-3 h-3" />{price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paspaudę ant tarpo galite keisti individualią kainą.{" "}
                      {isEdit ? "Pakeitimai išsaugomi paspaudus mygtką \"Išsaugoti pakeitimus\"." : "Pakeitimai išsaugomi sukūrus aikštelę."}
                    </p>

                    {/* ── Date-specific overrides ──────────────────────────── */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Konkrečios datos išimtys</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nustatykite skirtingą kainą konkrečiai datai (pvz. švenčių dienoms). Datos išimtis turi aukščiausią prioritetą.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Data</label>
                          <Input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)}
                            className="h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Kaina (€/30 min)</label>
                          <Input type="number" min="0" step="0.5" placeholder="pvz. 15" value={overridePrice}
                            onChange={(e) => setOverridePrice(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Nuo–Iki</label>
                          <div className="flex items-center gap-1">
                            <select value={overrideFromTime} onChange={(e) => setOverrideFromTime(e.target.value)}
                              className="flex-1 h-8 text-xs border rounded-md px-1 bg-background">
                              {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">–</span>
                            <select value={overrideToTime} onChange={(e) => setOverrideToTime(e.target.value)}
                              className="flex-1 h-8 text-xs border rounded-md px-1 bg-background">
                              {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button type="button" size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5"
                            disabled={!overrideDate || !overridePrice}
                            onClick={applyDateOverride}>
                            <Plus className="w-3 h-3" /> Pridėti
                          </Button>
                        </div>
                      </div>

                      {/* List of added overrides */}
                      {Object.keys(dateOverrides).length > 0 && (
                        <div className="space-y-1.5 mt-1">
                          {Object.entries(dateOverrides).sort(([a], [b]) => a.localeCompare(b)).map(([date, slots]) => {
                            const slotCount = Object.keys(slots).length;
                            const prices = Object.values(slots);
                            const minP = Math.min(...prices);
                            const maxP = Math.max(...prices);
                            const priceStr = minP === maxP ? `${minP.toFixed(2)}€` : `${minP.toFixed(2)}–${maxP.toFixed(2)}€`;
                            const times = Object.keys(slots).sort();
                            const rangeStr = times.length > 0 ? `${times[0]}–${times[times.length - 1]}` : "";
                            const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("lt-LT", { weekday: "short", day: "numeric", month: "short" });
                            return (
                              <div key={date} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/40 border text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium">{dateLabel}</span>
                                  <span className="text-xs text-muted-foreground">{rangeStr} · {slotCount} tarpai · {priceStr}</span>
                                </div>
                                <button type="button" onClick={() => removeDateOverride(date)}
                                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
                        <Lock className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Išmanus prieigos valdymas</span>
                      </div>
                      <FormField control={form.control} name="hasSmartLock" render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3">
                          <FormControl>
                            <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                          </FormControl>
                          <div>
                            <FormLabel className="cursor-pointer">Aikštelėje yra išmanus užraktas / be administratoriaus</FormLabel>
                            <p className="text-xs text-muted-foreground">Klientai patenka savarankiškai pagal pateiktą instrukciją.</p>
                          </div>
                        </FormItem>
                      )} />
                      {form.watch("hasSmartLock") && (
                        <FormField control={form.control} name="accessInstructions" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Prieigos instrukcijos klientui</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                placeholder="Pvz.: Kodas durims atsiunčiamas SMS žinute prieš rezervacijos pradžią..."
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Bus rodoma klientui po patvirtintos rezervacijos.</p>
                          </FormItem>
                        )} />
                      )}
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
                  <div className="space-y-5">
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

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Images className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">Galerijos nuotraukos</span>
                          <span className="text-[10px] text-muted-foreground font-normal">({galleryFiles.length}/{MAX_GALLERY_PHOTOS})</span>
                        </div>
                        {galleryFiles.length < MAX_GALLERY_PHOTOS && (
                          <button type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:border-primary hover:text-primary transition-colors">
                            <Upload className="w-3 h-3" />
                            Pridėti (dar {MAX_GALLERY_PHOTOS - galleryFiles.length})
                          </button>
                        )}
                        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
                          onChange={(e) => { if (e.target.files?.length) handleAddGalleryFiles(e.target.files); e.target.value = ""; }} />
                      </div>
                      {galleryPreviews.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {galleryPreviews.map((src, i) => (
                            <div key={i} className="relative group rounded-lg overflow-hidden aspect-video bg-muted border border-border">
                              <img src={src} alt="" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => handleRemoveGallery(i)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="w-full border border-dashed rounded-lg py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex flex-col items-center gap-1.5">
                          <Images className="h-5 w-5 opacity-40" />
                          Nėra nuotraukų. Spauskite, kad pridėtumėte.
                        </button>
                      )}
                      <p className="text-[11px] text-muted-foreground italic">Nuotraukos bus įkeltos sukūrus aikštelę.</p>
                    </div>
                  </div>
                )}

                {formTab === "contact" && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm">Kontaktai</p>
                        <p className="text-xs text-muted-foreground">Pagal nutylėjimą paveldima iš objekto kontaktų.</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <Checkbox checked={overrideContacts} onCheckedChange={(v) => setOverrideContacts(Boolean(v))} />
                        Naudoti kitokius kontaktus šiai aikštelei
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Telefonas</Label>
                        <Input placeholder="+370..."
                          disabled={!overrideContacts}
                          value={overrideContacts ? courtPhone : (facility.phone ?? "")}
                          onChange={(e) => setCourtPhone(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>El. paštas (paveldima iš objekto)</Label>
                        <Input value={facility.email ?? ""} disabled placeholder="—" />
                      </div>
                    </div>

                    <p className="text-sm font-semibold mt-2">Socialiniai tinklai</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Facebook</Label>
                        <Input placeholder="https://facebook.com/..."
                          disabled={!overrideContacts}
                          value={overrideContacts ? courtFacebook : (facility.socialFacebook ?? "")}
                          onChange={(e) => setCourtFacebook(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Instagram</Label>
                        <Input placeholder="https://instagram.com/..."
                          disabled={!overrideContacts}
                          value={overrideContacts ? courtInstagram : (facility.socialInstagram ?? "")}
                          onChange={(e) => setCourtInstagram(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>WhatsApp</Label>
                        <Input placeholder="https://wa.me/370..."
                          disabled={!overrideContacts}
                          value={overrideContacts ? courtWhatsapp : (facility.socialWhatsapp ?? "")}
                          onChange={(e) => setCourtWhatsapp(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Svetainė</Label>
                        <Input placeholder="https://..."
                          disabled={!overrideContacts}
                          value={overrideContacts ? courtWebsite : (facility.websiteUrl ?? "")}
                          onChange={(e) => setCourtWebsite(e.target.value)} />
                      </div>
                    </div>

                    {!overrideContacts && (
                      <p className="text-xs text-muted-foreground">
                        <a href={editAddressHref.replace("profileTab=vieta", "profileTab=kontaktai")}
                          className="text-primary underline">
                          Redaguoti objekto kontaktus
                        </a>
                      </p>
                    )}
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
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
                      Atšaukti
                    </Button>
                    {isEdit ? (
                      <Button type="button" variant="outline" size="sm"
                        onClick={form.handleSubmit(onSubmit, onInvalid)}
                        disabled={updateCourt.isPending || createCourt.isPending || setPricing.isPending || uploadingGallery}>
                        {updateCourt.isPending ? "Saugoma..." : "Išsaugoti"}
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm"
                        onClick={saveAsDraft}
                        disabled={savingDraft || createCourt.isPending}>
                        {savingDraft ? "Saugoma..." : "Išsaugoti juodraštį"}
                      </Button>
                    )}
                    {formTab !== "contact" ? (
                      <Button
                        key="nav-next"
                        type="button"
                        size="sm"
                        onClick={() => {
                          const idx = TABS.findIndex((t) => t.id === formTab);
                          setFormTab(TABS[idx + 1].id);
                        }}
                      >
                        Toliau →
                      </Button>
                    ) : (
                      <Button
                        key="nav-submit"
                        type="button"
                        size="sm"
                        onClick={form.handleSubmit(onSubmit, onInvalid)}
                        disabled={createCourt.isPending || updateCourt.isPending || setPricing.isPending || uploadingGallery || savingDraft}
                      >
                        {isEdit
                          ? (updateCourt.isPending ? "Saugoma..." : "Išsaugoti pakeitimus")
                          : (createCourt.isPending
                              ? "Kuriama..."
                              : uploadingGallery
                                ? `Keliamos nuotraukos${galleryProgress ? ` ${galleryProgress.current}/${galleryProgress.total}` : ""}...`
                                : "Sukurti aikštelę")}
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
