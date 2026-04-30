import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useLocation, useParams, Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { OwnerLayout } from "@/components/owner-layout";
import { CourtIcon, SportIcon, sportColor, SPORT_LABELS, SportPill } from "@/components/sport-icon";
import {
  useListCourts, useCreateCourt, useUpdateCourt, useDeleteCourt, getListCourtsQueryKey,
  useGetCourtPricing, useSetCourtPricing, customFetch,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Edit2, Trash2, Euro, RotateCcw, CalendarClock,
  AlertTriangle, Clock3, ShoppingBag, Lightbulb, ShowerHead, DoorOpen,
  Droplets, X, Trophy, UserPlus, UserMinus, MessageSquare, Send,
  ArrowLeft, ChevronRight, Images, Upload, Users, CreditCard,
  CheckCircle2, ExternalLink, Car, Bath, Wifi, Coffee, HeartPulse,
  Thermometer, Wind, Lock, Flame, Building2, QrCode, Download,
  Printer, MapPin, ChevronDown, Phone, Mail, Shield, ShieldCheck, Loader2,
  Star, Search, UserCheck, XCircle, LayoutDashboard, Settings, LogOut, Menu,
  BarChart3, Camera,
} from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CourtImageUpload } from "@/components/court-image-upload";
import { resolveCourtImage } from "@/lib/imageUrl";
import { validateEmail, validatePhone } from "@/lib/validators";

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

const DAYS = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];
const DAY_SHORT = ["Sek", "Pir", "Ant", "Tre", "Ket", "Pen", "Šeš"];

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

function generateTimeSlotsRange(open: string, close: string): string[] {
  const toM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const openMin = toM(open);
  const closeMin = toM(close);
  const slots: string[] = [];
  for (let m = openMin; m + 30 <= closeMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
  }
  return slots;
}

function slotsForDayFromJson(workingHoursJson: string | null | undefined, dayOfWeek: number): string[] | null {
  if (!workingHoursJson) return null;
  try {
    const wh = JSON.parse(workingHoursJson) as Record<string, { open: string; close: string; closed: boolean }>;
    const day = wh[String(dayOfWeek)];
    if (!day) return null;
    if (day.closed) return [];
    return generateTimeSlotsRange(day.open, day.close);
  } catch { return null; }
}

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

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const courtSchema = z.object({
  name: z.string().min(2, "Name required"),
  type: z.enum(["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"]),
  description: z.string().optional(),
  address: z.string().min(5, "Address required"),
  city: z.string().min(2, "City required"),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  pricePerHour: z.coerce.number().min(1),
  peakPricePerHour: z.coerce.number().optional(),
  ownershipDocUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  ownerName: z.string().min(2, "Owner name required"),
  ownerEmail: z.string().email("Invalid email"),
  isIndoor: z.boolean().default(false),
  maxPlayers: z.coerce.number().min(2),
  postcode: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  socialFacebook: z.string().optional(),
  socialInstagram: z.string().optional(),
  socialWhatsapp: z.string().optional(),
  socialWebsite: z.string().optional(),
  facilityId: z.number().optional(),
  workingHours: z.string().optional(),
});
type CourtFormValues = z.infer<typeof courtSchema>;

function CourtStatusBadge({ status }: { status?: string }) {
  if (status === "approved" || status === "active")
    return <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Aktyvus</Badge>;
  if (status === "pending_review")
    return <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Peržiūroje</Badge>;
  if (status === "pending")
    return <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Laukia</Badge>;
  if (status === "rejected")
    return <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">Atmesta</Badge>;
  if (status === "hidden")
    return <Badge className="text-xs bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Paslėpta</Badge>;
  // draft (or unknown / null / undefined)
  return <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">Juodraštis</Badge>;
}

interface CourtBlockedSlot {
  id: number; courtId: number; date: string; startTime: string; endTime: string; reason?: string;
}

function BlockedSlotsModal({ courtId, onClose }: { courtId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const qk = ["blocked-slots", courtId, date];
  const { data: slots = [], isLoading } = useQuery<CourtBlockedSlot[]>({
    queryKey: qk,
    queryFn: () => customFetch<CourtBlockedSlot[]>(`${API_URL}/courts/${courtId}/blocked-slots?date=${date}`, { method: "GET" }),
  });
  const qc = useQueryClient();
  const addMutation = useMutation({
    mutationFn: () => customFetch(`${API_URL}/courts/${courtId}/blocked-slots`, {
      method: "POST", body: JSON.stringify({ date, startTime, endTime, reason: reason || undefined }),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); toast({ title: "Laiko tarpas užblokuotas" }); },
    onError: () => toast({ title: "Klaida", variant: "destructive" }),
  });
  const removeMutation = useMutation({
    mutationFn: (slotId: number) => customFetch(`${API_URL}/courts/${courtId}/blocked-slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); toast({ title: "Blokavimas pašalintas" }); },
    onError: () => toast({ title: "Klaida", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nuo</Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{HOUR_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Iki</Label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{HOUR_OPTIONS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Input placeholder="Priežastis (neprivaloma)" value={reason} onChange={e => setReason(e.target.value)} />
      <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="w-full">
        {addMutation.isPending ? "Blokuojama..." : "Blokuoti laiką"}
      </Button>
      {isLoading ? <Skeleton className="h-20 w-full" /> : slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Esami blokavimai:</p>
          {slots.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium">{s.startTime} – {s.endTime}</span>
                {s.reason && <span className="text-xs text-muted-foreground ml-2">({s.reason})</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(s.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" onClick={onClose} className="w-full">Uždaryti</Button>
    </div>
  );
}

function PricingEditor({ courtId, defaultPrice, workingHours, onClose }: { courtId: number; defaultPrice: number; workingHours?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState(1);
  const defaultSlotPrice = defaultPrice / 2;
  const { data: pricing, isLoading } = useGetCourtPricing(courtId);
  const setPricing = useSetCourtPricing();
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (pricing) {
      const map = new Map<string, number>();
      pricing.entries.forEach((e: any) => map.set(`${e.dayOfWeek}:${e.startTime}`, e.price));
      setPriceMap(map);
    }
  }, [pricing]);

  const isDayClosed = (day: number) => {
    const slots = slotsForDayFromJson(workingHours, day);
    return slots !== null && slots.length === 0;
  };

  const daySlotsActive = slotsForDayFromJson(workingHours, selectedDay) ?? TIME_SLOTS;
  const selectedDayClosed = isDayClosed(selectedDay);

  const getPrice = (day: number, startTime: string) => {
    const key = `${day}:${startTime}`;
    return priceMap.has(key) ? priceMap.get(key)! : defaultSlotPrice;
  };
  const startEdit = (day: number, startTime: string) => {
    setEditingKey(`${day}:${startTime}`);
    setEditValue(getPrice(day, startTime).toString());
  };
  const commitEdit = () => {
    if (!editingKey) return;
    const price = parseFloat(editValue);
    if (!isNaN(price) && price >= 0) {
      setPriceMap(prev => { const next = new Map(prev); next.set(editingKey, price); return next; });
    }
    setEditingKey(null);
  };
  const resetDay = (day: number) => {
    setPriceMap(prev => { const next = new Map(prev); TIME_SLOTS.forEach(s => next.delete(`${day}:${s}`)); return next; });
  };
  const handleSave = async () => {
    const entries: { dayOfWeek: number; startTime: string; price: number }[] = [];
    priceMap.forEach((price, key) => {
      const [dayStr, startTime] = key.split(":");
      const dayOfWeek = parseInt(dayStr);
      if (!isNaN(dayOfWeek) && startTime) entries.push({ dayOfWeek, startTime, price });
    });
    try {
      await setPricing.mutateAsync({ id: courtId, data: { entries } });
      toast({ title: "Kainos išsaugotos" });
      onClose();
    } catch { toast({ title: "Klaida išsaugant", variant: "destructive" }); }
  };

  if (isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Nustatykite kainą kiekvienam 30 min. laiko tarpui. Numatytoji kaina: <strong>{defaultSlotPrice.toFixed(2)}€</strong> / 30 min.</p>
      <div className="flex gap-1.5 flex-wrap">
        {DAYS.map((day, i) => {
          const closed = isDayClosed(i);
          return (
            <button key={i} type="button" onClick={() => !closed && setSelectedDay(i)}
              disabled={closed}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${closed ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground line-through" : selectedDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}
            >{DAY_SHORT[i]}</button>
          );
        })}
      </div>
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
          <span className="text-sm font-semibold">{DAYS[selectedDay]}</span>
          {!selectedDayClosed && (
            <button type="button" onClick={() => resetDay(selectedDay)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Atstatyti numatytąją
            </button>
          )}
        </div>
        {selectedDayClosed ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Ši diena uždaryta pagal darbo valandas</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-border max-h-72 overflow-y-auto">
            {daySlotsActive.map(startTime => {
              const key = `${selectedDay}:${startTime}`;
              const isEditing = editingKey === key;
              const price = getPrice(selectedDay, startTime);
              const isCustom = priceMap.has(key);
              return (
                <div key={startTime}
                  className={`bg-card p-2 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-primary/5 transition-colors ${isEditing ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                  onClick={() => !isEditing && startEdit(selectedDay, startTime)}>
                  <span className="text-xs text-muted-foreground font-medium">{startTime}</span>
                  {isEditing ? (
                    <input autoFocus type="number" value={editValue} min={0} step={0.5}
                      onChange={e => setEditValue(e.target.value)} onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingKey(null); }}
                      className="w-full text-center text-xs font-bold bg-transparent border-0 outline-none p-0 text-primary"
                      onClick={e => e.stopPropagation()} />
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
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Atšaukti</Button>
        <Button onClick={handleSave} disabled={setPricing.isPending}>{setPricing.isPending ? "Išsaugoma..." : "Išsaugoti kainas"}</Button>
      </div>
    </div>
  );
}

function CourtPricingField({
  value,
  onChange,
  pricingCourtId,
  onOpenPricing,
}: {
  value: number;
  onChange: (value: number) => void;
  pricingCourtId: number | null;
  onOpenPricing: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        step={0.5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <Button type="button" variant="outline" onClick={onOpenPricing} disabled={pricingCourtId !== null}>
        Grafikas
      </Button>
    </div>
  );
}

function FreeBookingDialog({ courtId, open, onClose }: { courtId: number | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ date: today, startTime: "09:00", endTime: "10:00", customerName: "", customerEmail: "", customerPhone: "", note: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!courtId) return;
    const emailErr = validateEmail(form.customerEmail);
    if (emailErr) { toast({ title: emailErr, variant: "destructive" }); return; }
    const phoneErr = validatePhone(form.customerPhone, { required: false });
    if (phoneErr) { toast({ title: phoneErr, variant: "destructive" }); return; }
    setLoading(true);
    try {
      await customFetch(`${API_URL}/owner/bookings/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtId, ...form }),
      });
      toast({ title: "Nemokama rezervacija sukurta ✓" });
      setForm({ date: today, startTime: "09:00", endTime: "10:00", customerName: "", customerEmail: "", customerPhone: "", note: "" });
      onClose();
    } catch (err: any) {
      toast({ title: err?.message ?? "Klaida kuriant rezervaciją", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" /> Nemokama rezervacija
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data</label>
            <input type="date" min={today} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pradžia</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pabaiga</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" required />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kliento vardas</label>
            <input type="text" placeholder="Vardas Pavardė" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">El. paštas</label>
            <input type="email" placeholder="vardas@example.com" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tel. numeris (neprivaloma)</label>
            <input type="tel" placeholder="+370 600 00000" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pastaba (neprivaloma)</label>
            <input type="text" placeholder="pvz. treniruotė, renginys..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>Atšaukti</Button>
            <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
              {loading ? "Kuriama..." : "Sukurti"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CoachManagementModal({ courtId }: { courtId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const coachesQk = ["court-coaches", courtId];
  const invitesQk = ["court-coach-invitations", courtId];

  const { data: assigned = [] } = useQuery<any[]>({
    queryKey: coachesQk,
    queryFn: () => customFetch<any[]>(`${API_URL}/courts/${courtId}/coaches`),
  });
  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: invitesQk,
    queryFn: () => customFetch<any[]>(`${API_URL}/courts/${courtId}/coach-invitations`),
  });

  const removeMutation = useMutation({
    mutationFn: (coachId: number) => customFetch(`${API_URL}/courts/${courtId}/coaches/${coachId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: coachesQk }); toast({ title: "Treneris pašalintas" }); },
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, action }: { inviteId: number; action: "approve" | "reject" }) =>
      customFetch(`${API_URL}/courts/${courtId}/coach-invitations/${inviteId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: coachesQk });
      qc.invalidateQueries({ queryKey: invitesQk });
      toast({ title: vars.action === "approve" ? "Treneris patvirtintas!" : "Paraiška atmesta" });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const [inviteMode, setInviteMode] = useState<"idle" | "search" | "email">("idle");
  const [searchQ, setSearchQ] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["user-search-coaches", searchQ],
    queryFn: () => customFetch<any[]>(`${API_URL}/users/search?q=${encodeURIComponent(searchQ)}`),
    enabled: searchQ.trim().length >= 2,
  });

  const inviteMutation = useMutation({
    mutationFn: (payload: { targetUserId?: string; targetEmail?: string; targetName?: string }) => {
      if (payload.targetEmail !== undefined) {
        const emailErr = validateEmail(payload.targetEmail);
        if (emailErr) throw new Error(emailErr);
      }
      return customFetch(`${API_URL}/courts/${courtId}/coach-invite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitesQk });
      setInviteMode("idle");
      setSearchQ("");
      setInviteEmail("");
      setInviteName("");
      toast({ title: "Kvietimas išsiųstas!" });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message ?? "Bandykite dar kartą", variant: "destructive" }),
  });

  const pending = invitations.filter((i: any) => i.status === "pending");
  const pendingApps = pending.filter((i: any) => i.initiatedBy === "coach");
  const pendingInvites = pending.filter((i: any) => i.initiatedBy === "owner");

  return (
    <div className="space-y-2">
      <Tabs defaultValue="coaches">
        <TabsList className="w-full">
          <TabsTrigger value="coaches" className="flex-1">
            Treneriai {assigned.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{assigned.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            Prašymai {pendingApps.length > 0 && <Badge className="ml-1 text-xs bg-yellow-500 text-black">{pendingApps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex-1">Pakviesti</TabsTrigger>
        </TabsList>

        {/* ── Current coaches ── */}
        <TabsContent value="coaches" className="space-y-3 pt-3">
          {assigned.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6 italic">Dar nėra priskirtų trenerių.</p>
          )}
          {assigned.map((c: any) => (
            <div key={c.id} className="flex items-start gap-3 bg-primary/5 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-lg font-bold text-primary">
                {c.name?.[0]?.toUpperCase() ?? "T"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                {c.sports?.length > 0 && (
                  <p className="text-xs text-muted-foreground">{c.sports.join(", ")}</p>
                )}
                {c.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.bio}</p>}
                <div className="flex flex-wrap gap-2 mt-1">
                  {c.pricePerHour && (
                    <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">{c.pricePerHour}€/val</span>
                  )}
                  {c.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Phone className="w-3 h-3"/>{c.phone}</span>
                  )}
                  {c.email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Mail className="w-3 h-3"/>{c.email}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => removeMutation.mutate(c.id)}>
                <UserMinus className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </TabsContent>

        {/* ── Applications + sent invites ── */}
        <TabsContent value="requests" className="space-y-4 pt-3">
          {pendingApps.length === 0 && pendingInvites.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6 italic">Nėra laukiančių prašymų.</p>
          )}
          {pendingApps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trenerių paraiškos</p>
              {pendingApps.map((inv: any) => (
                <div key={inv.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{inv.targetName ?? inv.targetEmail ?? "Nežinomas"}</p>
                      {inv.message && <p className="text-xs text-muted-foreground mt-0.5 italic">„{inv.message}"</p>}
                      <p className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("lt-LT")}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                      onClick={() => respondMutation.mutate({ inviteId: inv.id, action: "approve" })}
                      disabled={respondMutation.isPending}>
                      <UserCheck className="w-3.5 h-3.5 mr-1" />Patvirtinti
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-500/40 text-red-500 hover:bg-red-500/10"
                      onClick={() => respondMutation.mutate({ inviteId: inv.id, action: "reject" })}
                      disabled={respondMutation.isPending}>
                      <XCircle className="w-3.5 h-3.5 mr-1" />Atmesti
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Išsiųsti kvietimai</p>
              {pendingInvites.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{inv.targetName ?? inv.targetEmail ?? "Vartotojas"}</p>
                    {inv.targetEmail && <p className="text-xs text-muted-foreground">{inv.targetEmail}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString("lt-LT")}</p>
                  </div>
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/40">Laukiama</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Invite form ── */}
        <TabsContent value="invite" className="pt-3 space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm" variant={inviteMode === "search" ? "default" : "outline"}
              className="flex-1 text-xs h-9"
              onClick={() => setInviteMode(inviteMode === "search" ? "idle" : "search")}
            >
              <Search className="w-3.5 h-3.5 mr-1" />Ieškoti vartotojo
            </Button>
            <Button
              size="sm" variant={inviteMode === "email" ? "default" : "outline"}
              className="flex-1 text-xs h-9"
              onClick={() => setInviteMode(inviteMode === "email" ? "idle" : "email")}
            >
              <Mail className="w-3.5 h-3.5 mr-1" />El. paštu
            </Button>
          </div>

          {inviteMode === "search" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Ieškoti pagal vardą..."
                  className="pl-9 text-sm h-9"
                />
              </div>
              {searchQ.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Vartotojų nerasta</p>
              )}
              {searchResults.map((u: any) => (
                <div key={u.userId} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{u.userName}</p>
                  </div>
                  <Button size="sm" className="h-7 text-xs"
                    onClick={() => inviteMutation.mutate({ targetUserId: u.userId, targetName: u.userName })}
                    disabled={inviteMutation.isPending}>
                    <UserPlus className="w-3 h-3 mr-1" />Pakviesti
                  </Button>
                </div>
              ))}
            </div>
          )}

          {inviteMode === "email" && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs mb-1">Vardas</Label>
                <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Trenerio vardas" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1">El. paštas</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="treneris@example.com" className="h-9 text-sm" />
              </div>
              <Button
                className="w-full h-9 text-sm"
                onClick={() => inviteMutation.mutate({ targetEmail: inviteEmail, targetName: inviteName || undefined })}
                disabled={!inviteEmail.includes("@") || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Siųsti kvietimą
              </Button>
            </div>
          )}

          {inviteMode === "idle" && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Pasirinkite kaip pakviesti trenerį — ieškokite pagal vardą arba siųskite kvietimą el. paštu.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MAX_GALLERY_PHOTOS = 3;

function CourtPhotosSection({ courtId }: { courtId: number }) {
  const { toast } = useToast();
  const qk = ["court-photos", courtId];
  const { data: photos = [] } = useQuery<any[]>({
    queryKey: qk,
    queryFn: () => customFetch<any[]>(`${API_URL}/courts/${courtId}/photos`),
  });
  const qc = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const remaining = Math.max(0, MAX_GALLERY_PHOTOS - photos.length);

  const handleUpload = async (files: FileList) => {
    if (remaining <= 0) {
      toast({ title: "Nuotraukų limitas pasiektas", description: `Ištrinkite esamą, kad galėtumėte įkelti naują (maks. ${MAX_GALLERY_PHOTOS}).`, variant: "destructive" });
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length < files.length) {
      toast({ title: `Įkeliamos tik ${toUpload.length} nuotraukos`, description: `Limitas: ${MAX_GALLERY_PHOTOS}` });
    }

    const previews = toUpload.map(f => URL.createObjectURL(f));
    setPendingPreviews(previews);
    setUploading(true);
    setUploadProgress({ current: 0, total: toUpload.length });

    try {
      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress({ current: i + 1, total: toUpload.length });
        const fd = new FormData();
        fd.append("image", toUpload[i]);
        const r = await fetch(`${API_URL}/courts/${courtId}/photos`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error ?? `Klaida (${r.status})`);
        }
      }
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: toUpload.length === 1 ? "Nuotrauka įkelta" : `${toUpload.length} nuotraukos įkeltos` });
    } catch (err: any) {
      toast({ title: "Įkėlimo klaida", description: err.message ?? "Bandykite dar kartą", variant: "destructive" });
      qc.invalidateQueries({ queryKey: qk });
    } finally {
      previews.forEach(URL.revokeObjectURL);
      setPendingPreviews([]);
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDelete = async (photoId: number) => {
    try {
      await customFetch(`${API_URL}/courts/${courtId}/photos/${photoId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: qk });
    } catch { toast({ title: "Klaida trinant nuotrauką", variant: "destructive" }); }
  };

  const canAddMore = (photos.length + pendingPreviews.length) < MAX_GALLERY_PHOTOS && !uploading;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Images className="w-3.5 h-3.5 text-muted-foreground" />
          Galerijos nuotraukos
          <span className="text-[10px] text-muted-foreground font-normal">({photos.length}/{MAX_GALLERY_PHOTOS})</span>
        </Label>
        {remaining > 0 && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => !uploading && photoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading
              ? <><Loader2 className="w-3 h-3 animate-spin" />{uploadProgress ? `${uploadProgress.current}/${uploadProgress.total} keliama...` : "Keliama..."}</>
              : <><Upload className="w-3 h-3" />{`Įkelti (dar ${remaining})`}</>
            }
          </button>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" disabled={uploading}
          onChange={e => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
      </div>

      {(photos.length > 0 || pendingPreviews.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p: any) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden aspect-video bg-muted border border-border">
              <img src={resolveCourtImage(p.url) ?? ""} alt="" className="w-full h-full object-cover" />
              <button onClick={() => handleDelete(p.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {pendingPreviews.map((src, i) => (
            <div key={`pending-${i}`} className="relative rounded-lg overflow-hidden aspect-video border-2 border-primary/40 animate-pulse">
              <img src={src} alt="" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            </div>
          ))}
          {canAddMore && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="aspect-video rounded-lg border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span className="text-[10px]">Pridėti</span>
            </button>
          )}
        </div>
      )}

      {photos.length === 0 && pendingPreviews.length === 0 && (
        <button
          type="button"
          onClick={() => !uploading && photoInputRef.current?.click()}
          disabled={uploading}
          className="w-full border border-dashed rounded-lg py-4 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex flex-col items-center gap-1.5 disabled:opacity-50"
        >
          <Images className="h-5 w-5 opacity-40" />
          Nėra nuotraukų. Spauskite, kad pridėtumėte.
        </button>
      )}

      {remaining === 0 && pendingPreviews.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Maksimalus kiekis pasiektas. Ištrinkite nuotrauką, kad įkeltumėte naują.</p>
      )}
    </div>
  );
}

interface FacilityData {
  id: number; name: string; description?: string; companyName?: string;
  registrationCode?: string; address?: string; city?: string; phone?: string;
  email?: string; verificationStatus: string; photos: string[];
  equipment: string[]; courtCount: number; sportTypes: string[];
  courts: any[];
  latitude?: number; longitude?: number; postcode?: string;
}

interface MembershipPlan {
  id: number; courtId: number; name: string; description: string | null;
  pricePerYear: number; weeklySlots: number; isActive: boolean;
}

function MembershipPlanManager({ courtId }: { courtId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerYear, setPricePerYear] = useState("");
  const [weeklySlots, setWeeklySlots] = useState("1");

  const { data: plans = [], isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["memberships", courtId],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/courts/${courtId}/memberships`);
      return r.json();
    },
  });

  const createPlan = useMutation({
    mutationFn: () => customFetch(`${API_URL}/courts/${courtId}/memberships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, pricePerYear: Number(pricePerYear), weeklySlots: Number(weeklySlots) }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memberships", courtId] });
      setName(""); setDescription(""); setPricePerYear(""); setWeeklySlots("1");
      toast({ title: "Planas sukurtas!" });
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  const deactivatePlan = useMutation({
    mutationFn: (planId: number) => customFetch(`${API_URL}/courts/${courtId}/memberships/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memberships", courtId] }),
  });

  return (
    <div className="space-y-4 py-2">
      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : plans.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-muted-foreground gap-2">
          <Star className="w-8 h-8 opacity-20" />
          <p className="text-sm">Nėra narystės planų</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map(plan => (
            <div key={plan.id} className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{plan.name}</div>
                {plan.description && <div className="text-xs text-muted-foreground">{plan.description}</div>}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="font-bold text-primary">{plan.pricePerYear}€/metai</span>
                  <span>· {plan.weeklySlots} slot/savaitė</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                onClick={() => deactivatePlan.mutate(plan.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-sm font-semibold">Naujas planas</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Pavadinimas</Label>
            <Input placeholder="pvz. Standartinė narystė" value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kaina (€/metus)</Label>
            <Input type="number" placeholder="360" value={pricePerYear} onChange={e => setPricePerYear(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Slotai/savaitę</Label>
            <Input type="number" placeholder="2" min="1" value={weeklySlots} onChange={e => setWeeklySlots(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Aprašymas (neprivaloma)</Label>
            <Input placeholder="pvz. 2 valandos per savaitę" value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        <Button size="sm" disabled={!name || !pricePerYear || createPlan.isPending} onClick={() => createPlan.mutate()} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Sukurti planą
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

export default function OwnerFacilityDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [pricingCourtId, setPricingCourtId] = useState<number | null>(null);
  const [pricingDefaultPrice, setPricingDefaultPrice] = useState(20);
  const [pricingWorkingHours, setPricingWorkingHours] = useState<string | null>(null);
  const [blockedSlotsCourtId, setBlockedSlotsCourtId] = useState<number | null>(null);
  const [coachesCourtId, setCoachesCourtId] = useState<number | null>(null);
  const [freeBookingCourtId, setFreeBookingCourtId] = useState<number | null>(null);
  const [membershipCourtId, setMembershipCourtId] = useState<number | null>(null);
  const [photosCourtId, setPhotosCourtId] = useState<number | null>(null);
  const [rentableItems, setRentableItems] = useState<RentableItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [formTab, setFormTab] = useState<"info" | "schedule" | "amenities" | "media" | "contact">("info");
  const [localPricingMap, setLocalPricingMap] = useState<Map<string, number>>(new Map());
  const [pricingDay, setPricingDay] = useState(1);
  const [pricingEditKey, setPricingEditKey] = useState<string | null>(null);
  const [pricingEditValue, setPricingEditValue] = useState("");
  const [workingHoursState, setWorkingHoursState] = useState<WorkingHoursMap>(defaultWorkingHours());
  const [amenityPhotos, setAmenityPhotos] = useState<Record<string, string>>({});
  const [uploadingAmenity, setUploadingAmenity] = useState<string | null>(null);
  const [qrCourt, setQrCourt] = useState<{ id: number; name: string; type: string } | null>(null);

  const { data: facility, isLoading: facilityLoading } = useQuery<FacilityData>({
    queryKey: ["facility-detail", id],
    queryFn: () => customFetch<FacilityData>(`${API_URL}/facilities/${id}`),
    enabled: !!id && !!user?.id,
  });

  const facilityOwnerId = (facility as any)?.ownerUserId as string | undefined;

  const { data: courts, isLoading: courtsLoading } = useListCourts(
    facilityOwnerId ? { ownerUserId: facilityOwnerId } : undefined,
    {
      query: {
        queryKey: getListCourtsQueryKey(facilityOwnerId ? { ownerUserId: facilityOwnerId } : undefined),
        enabled: !!facilityOwnerId,
      },
    }
  );

  const facilityCourts = courts?.filter(c => (c as any).facilityId === Number(id)) ?? [];

  const [facilityEditOpen, setFacilityEditOpen] = useState(false);
  const autoOpenedRef = useRef<{ court?: number; facility?: boolean }>({});

  const createCourt = useCreateCourt();
  const updateCourt = useUpdateCourt();
  const deleteCourt = useDeleteCourt();
  const setPricingMutation = useSetCourtPricing();

  const { data: editingPricing } = useGetCourtPricing(editingId ?? 0);

  useEffect(() => {
    if (editingId && editingPricing?.entries) {
      const map = new Map<string, number>();
      editingPricing.entries.forEach((e: any) => map.set(`${e.dayOfWeek}:${e.startTime}`, e.price));
      setLocalPricingMap(map);
    } else if (!editingId) {
      setLocalPricingMap(new Map());
    }
  }, [editingId, editingPricing]);

  const form = useForm<CourtFormValues>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      name: "", type: "tennis", description: "", address: facility?.address ?? "", city: facility?.city ?? "",
      latitude: facility?.latitude ?? 0, longitude: facility?.longitude ?? 0,
      pricePerHour: 20, peakPricePerHour: undefined,
      imageUrl: "", ownershipDocUrl: "", ownerName: user?.fullName ?? "Owner",
      ownerEmail: user?.primaryEmailAddress?.emailAddress ?? "owner@example.com",
      isIndoor: false, maxPlayers: 4, postcode: facility?.postcode ?? "", amenities: [],
      socialFacebook: "", socialInstagram: "", socialWhatsapp: "", socialWebsite: "",
      facilityId: Number(id), workingHours: undefined,
    },
  });


  const savePricingForCourt = async (courtId: number) => {
    if (localPricingMap.size === 0) return;
    const entries: { dayOfWeek: number; startTime: string; price: number }[] = [];
    localPricingMap.forEach((price, key) => {
      const [dayStr, startTime] = key.split(":");
      const dayOfWeek = parseInt(dayStr);
      if (!isNaN(dayOfWeek) && startTime) entries.push({ dayOfWeek, startTime, price });
    });
    if (entries.length > 0) {
      await setPricingMutation.mutateAsync({ id: courtId, data: { entries } });
    }
  };

  const onSubmit = async (data: CourtFormValues) => {
    try {
      const rentableItemsJson = rentableItems.length > 0 ? JSON.stringify(rentableItems) : undefined;
      const whJson = JSON.stringify(workingHoursState);
      const amenityPhotosJson = Object.keys(amenityPhotos).length > 0 ? JSON.stringify(amenityPhotos) : undefined;

      const cleanStr = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const trimmed = v.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      };

      const payload: Record<string, unknown> = {
        ...data,
        facilityId: Number(id),
        rentableItems: rentableItemsJson,
        workingHours: whJson,
        amenityPhotos: amenityPhotosJson,
        description: cleanStr(data.description),
        postcode: cleanStr(data.postcode),
        imageUrl: cleanStr(data.imageUrl),
        ownershipDocUrl: cleanStr(data.ownershipDocUrl),
        surface: cleanStr((data as any).surface),
        socialFacebook: cleanStr(data.socialFacebook),
        socialInstagram: cleanStr(data.socialInstagram),
        socialWhatsapp: cleanStr(data.socialWhatsapp),
        socialWebsite: cleanStr((data as any).socialWebsite),
      };

      if (editingId) {
        await updateCourt.mutateAsync({ id: editingId, data: payload as any });
        await savePricingForCourt(editingId);
        toast({ title: "Aikštelė atnaujinta" });
      } else {
        const newCourt = await createCourt.mutateAsync({ data: payload as any });
        await savePricingForCourt((newCourt as any).id);
        toast({ title: "Aikštelė sukurta — laukia patvirtinimo" });
      }
      setIsDialogOpen(false);
      setRentableItems([]);
      setAmenityPhotos({});
      setFormTab("info");
      queryClient.invalidateQueries({ queryKey: getListCourtsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
    } catch (err) {
      const anyErr = err as any;
      const description =
        (anyErr?.data && typeof anyErr.data === "object" && typeof anyErr.data.error === "string"
          ? anyErr.data.error
          : anyErr?.message) || "Patikrinkite užpildytus laukus";
      toast({ title: "Klaida išsaugant aikštelę", description, variant: "destructive" });
    }
  };

  const handleEdit = (court: any) => {
    setEditingId(court.id);
    setMapKey(k => k + 1);
    setFormTab("info");
    form.reset({
      name: court.name, type: court.type, description: court.description || "",
      address: court.address, city: court.city, latitude: court.latitude, longitude: court.longitude,
      pricePerHour: court.pricePerHour, peakPricePerHour: court.peakPricePerHour ?? undefined,
      imageUrl: court.imageUrl || "",
      ownershipDocUrl: court.ownershipDocUrl || "", ownerName: court.ownerName, ownerEmail: court.ownerEmail,
      isIndoor: court.isIndoor, maxPlayers: court.maxPlayers,
      amenities: Array.isArray(court.amenities) ? court.amenities : [],
      postcode: court.postcode ?? "",
      socialFacebook: court.socialFacebook ?? "", socialInstagram: court.socialInstagram ?? "",
      socialWhatsapp: court.socialWhatsapp ?? "", socialWebsite: court.socialWebsite ?? "",
      facilityId: Number(id), workingHours: court.workingHours ?? undefined,
    });
    if (court.workingHours) {
      try { setWorkingHoursState({ ...defaultWorkingHours(), ...JSON.parse(court.workingHours) }); }
      catch { setWorkingHoursState(defaultWorkingHours()); }
    } else { setWorkingHoursState(defaultWorkingHours()); }
    try {
      const raw: any[] = court.rentableItems ? JSON.parse(court.rentableItems) : [];
      setRentableItems(raw.map(r => ({ name: r.name, pricePerSlot: r.pricePerSlot ?? r.pricePerBooking ?? 0, stock: r.stock ?? 1 })));
    } catch { setRentableItems([]); }
    try {
      const photos = court.amenityPhotos ? JSON.parse(court.amenityPhotos) : {};
      setAmenityPhotos(typeof photos === "object" && photos !== null ? photos : {});
    } catch { setAmenityPhotos({}); }
    setIsDialogOpen(true);
  };

  const handleDelete = async (courtId: number) => {
    if (!confirm("Ar tikrai norite ištrinti šią aikštelę?")) return;
    try {
      await deleteCourt.mutateAsync({ id: courtId });
      toast({ title: "Aikštelė ištrinta" });
      queryClient.invalidateQueries({ queryKey: getListCourtsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
    } catch {
      toast({ title: "Klaida trinant aikštelę", variant: "destructive" });
    }
  };

  const handleAmenityPhotoUpload = async (amenityId: string, file: File) => {
    setUploadingAmenity(amenityId);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const resp = await fetch(`${BASE_URL}/api/upload/amenity-photo`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      setAmenityPhotos(prev => ({ ...prev, [amenityId]: url }));
      toast({ title: "Nuotrauka įkelta" });
    } catch { toast({ title: "Klaida", variant: "destructive" }); }
    finally { setUploadingAmenity(null); }
  };

  const handleConnectStripe = async (courtId: number) => {
    try {
      const origin = window.location.origin;
      const r = await fetch(`${BASE_URL}/api/payments/connect/onboard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          returnUrl: `${origin}${BASE_URL}/owner/facility/${id}?connect_success=1&courtId=${courtId}`,
          refreshUrl: `${origin}${BASE_URL}/owner/facility/${id}?connect_refresh=1&courtId=${courtId}`,
        }),
      });
      if (!r.ok) throw new Error("Klaida");
      const { url } = await r.json();
      window.location.href = url;
    } catch { toast({ title: "Nepavyko inicijuoti Stripe Connect", variant: "destructive" }); }
  };

  const handleFacilityConnectStripe = async () => {
    try {
      const origin = window.location.origin;
      const r = await fetch(`${API_URL}/facilities/${id}/connect/onboard`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${origin}${BASE_URL}/owner/facility/${id}?facility_connect_success=1`,
          refreshUrl: `${origin}${BASE_URL}/owner/facility/${id}?facility_connect_refresh=1`,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Klaida");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "Stripe Connect klaida", description: err?.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect_success") === "1" || params.get("facility_connect_success") === "1") {
      toast({ title: "Stripe Connect prijungtas!", description: "Dabar galite priimti mokėjimus." });
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["facility-detail", id] });
    } else if (params.get("connect_refresh") === "1" || params.get("facility_connect_refresh") === "1") {
      toast({ title: "Stripe Connect neužbaigtas", description: "Bandykite dar kartą." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Auto-open editors based on URL params (?editCourt=ID, ?editFacility=1)
  useEffect(() => {
    if (!facility) return;
    const params = new URLSearchParams(window.location.search);
    const editFacilityParam = params.get("editFacility");
    const editCourtParam = params.get("editCourt");

    if (editFacilityParam === "1" && !autoOpenedRef.current.facility) {
      autoOpenedRef.current.facility = true;
      setFacilityEditOpen(true);
      params.delete("editFacility");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }

    if (editCourtParam && courts && autoOpenedRef.current.court !== Number(editCourtParam)) {
      const targetId = Number(editCourtParam);
      const target = facilityCourts.find(c => c.id === targetId);
      if (target) {
        autoOpenedRef.current.court = targetId;
        handleEdit(target);
        params.delete("editCourt");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility, courts]);

  if (facilityLoading || courtsLoading) {
    return (
      <OwnerLayout facilityId={id ? Number(id) : undefined} title="Aikštelės">
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        </div>
      </OwnerLayout>
    );
  }

  if (!facility) {
    return (
      <OwnerLayout facilityId={id ? Number(id) : undefined} title="Aikštelės">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Objektas nerastas</h2>
            <Button onClick={() => navigate("/owner")}>Grįžti</Button>
          </div>
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout facilityId={Number(id)} facilityName={facility.name} title="Aikštelės">
      <div className="p-4 md:p-6">
        {/* Page header (facility-scoped actions) */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{facility.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Aikštelės</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setFacilityEditOpen(true)}>
              <Edit2 className="w-3.5 h-3.5" /> Redaguoti objektą
            </Button>
            {facility.verificationStatus === "verified" && (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30 gap-1 hidden sm:flex">
                <ShieldCheck className="w-3 h-3" /> Patvirtinta
              </Badge>
            )}
          </div>
        </div>

        {/* Facility stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Kortai</p>
              <p className="text-2xl font-bold text-primary">{facilityCourts.length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Sporto šakos</p>
              <p className="text-2xl font-bold text-primary">{[...new Set(facilityCourts.map(c => c.type))].length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Aktyvūs</p>
              <p className="text-2xl font-bold text-emerald-500">{facilityCourts.filter(c => ["approved","active"].includes((c as any).status ?? "")).length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Laukia</p>
              <p className="text-2xl font-bold text-amber-400">{facilityCourts.filter(c => ["pending","pending_review","draft"].includes((c as any).status ?? "")).length}</p>
            </div>
          </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Aikštelės</h2>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) { setEditingId(null); setMapKey(k => k + 1); }
          }}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                setEditingId(null);
                form.reset({
                  name: "", type: "tennis", description: "",
                  address: facility.address ?? "", city: facility.city ?? "",
                  latitude: facility.latitude ?? 0, longitude: facility.longitude ?? 0,
                  pricePerHour: 20,
                  imageUrl: "", ownershipDocUrl: "",
                  ownerName: user?.fullName ?? "Owner",
                  ownerEmail: user?.primaryEmailAddress?.emailAddress ?? "",
                  isIndoor: false, maxPlayers: 4, postcode: facility.postcode ?? "", amenities: [],
                  facilityId: Number(id), workingHours: undefined,
                });
                setMapKey(k => k + 1);
                setWorkingHoursState(defaultWorkingHours());
                setRentableItems([]);
                setAmenityPhotos({});
              }} className="gap-2">
                <Plus className="w-4 h-4" /> Pridėti aikštelę
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Redaguoti aikštelę" : "Pridėti naują aikštelę"}</DialogTitle>
              </DialogHeader>

              <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none -mx-6 px-6 pb-0">
                {([
                  { id: "info", label: "Pagrindai" }, { id: "schedule", label: "Grafikas" },
                  { id: "amenities", label: "Patogumai" }, { id: "media", label: "Medija" },
                  { id: "contact", label: "Kontaktai" },
                ] as const).map(t => (
                  <button key={t.id} type="button" onClick={() => setFormTab(t.id)}
                    className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${formTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >{t.label}</button>
                ))}
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

                  {formTab === "info" && (<div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Aikštelės pavadinimas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem><FormLabel>Sporto šaka</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.keys(SPORT_LABELS).filter(k => k !== "table-tennis").map((val) => (
                                <SelectItem key={val} value={val}>
                                  <span className="inline-flex items-center gap-2">
                                    <SportIcon sport={val} size={14} strokeWidth={2} style={{ color: sportColor[val] ?? "#84cc16" }} />
                                    {SPORT_LABELS[val]}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Aprašymas</FormLabel><FormControl><Textarea rows={2} placeholder="Trumpas aikštelės aprašymas..." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground">Vieta ir adresas paveldimas iš objekto. Redaguokite objekto nustatymuose.</p>
                    </div>
                  </div>)}

                  {formTab === "schedule" && (<div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Euro className="w-3.5 h-3.5 text-primary" /> Numatytoji kaina (€/val)</FormLabel>
                          <FormControl>
                            <CourtPricingField
                              value={field.value}
                              onChange={field.onChange}
                              pricingCourtId={pricingCourtId}
                              onOpenPricing={() => {
                                setPricingCourtId(editingId ?? null);
                                setPricingDefaultPrice(Number(field.value || 20));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1"><Clock3 className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Darbo laikas</span></div>
                      <div className="space-y-2">
                        {(["1","2","3","4","5","6","0"] as const).map(dayKey => {
                          const dayNames: Record<string, string> = { "0": "Sekmadienis", "1": "Pirmadienis", "2": "Antradienis", "3": "Trečiadienis", "4": "Ketvirtadienis", "5": "Penktadienis", "6": "Šeštadienis" };
                          const dh = workingHoursState[dayKey] ?? { open: "08:00", close: "22:00", closed: false };
                          return (
                            <div key={dayKey} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                              <span className="w-28 text-sm font-medium shrink-0">{dayNames[dayKey]}</span>
                              <button type="button" onClick={() => setWorkingHoursState(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], closed: !prev[dayKey]?.closed } }))}
                                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${dh.closed ? "bg-red-500/15 text-red-500 border border-red-500/30" : "bg-green-500/15 text-green-600 border border-green-500/30"}`}
                              >{dh.closed ? "Uždaryta" : "Atidaryta"}</button>
                              {!dh.closed && (<>
                                <select className="text-xs border rounded px-1.5 py-1 bg-background" value={dh.open}
                                  onChange={e => setWorkingHoursState(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], open: e.target.value } }))}>
                                  {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span className="text-muted-foreground text-xs">–</span>
                                <select className="text-xs border rounded px-1.5 py-1 bg-background" value={dh.close}
                                  onChange={e => setWorkingHoursState(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], close: e.target.value } }))}>
                                  {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </>)}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2"><Euro className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Kainos pagal laiką</span></div>
                        <span className="text-xs text-muted-foreground">Numatytoji: {(Number(form.watch("pricePerHour") || 20) / 2).toFixed(2)}€ / 30 min</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {DAYS.map((day, i) => {
                          const dayWh = workingHoursState[String(i)];
                          const dayClosed = dayWh?.closed ?? false;
                          return (
                            <button key={i} type="button" onClick={() => !dayClosed && setPricingDay(i)}
                              disabled={dayClosed}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dayClosed ? "opacity-40 cursor-not-allowed line-through bg-muted text-muted-foreground" : pricingDay === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                            >{DAY_SHORT[i]}</button>
                          );
                        })}
                        {!(workingHoursState[String(pricingDay)]?.closed) && (
                          <button type="button" onClick={() => {
                            setLocalPricingMap(prev => { const next = new Map(prev); TIME_SLOTS.forEach(s => next.delete(`${pricingDay}:${s}`)); return next; });
                          }} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Atstatyti dieną
                          </button>
                        )}
                      </div>
                      {workingHoursState[String(pricingDay)]?.closed ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">Ši diena uždaryta pagal darbo valandas</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-1">
                          {(slotsForDayFromJson(JSON.stringify(workingHoursState), pricingDay) ?? TIME_SLOTS).map(slot => {
                            const key = `${pricingDay}:${slot}`;
                            const defaultHalf = (form.watch("pricePerHour") || 20) / 2;
                            const slotPrice = localPricingMap.has(key) ? localPricingMap.get(key)! : defaultHalf;
                            const isOverridden = localPricingMap.has(key);
                            const isEditing = pricingEditKey === key;
                            return (
                              <div key={slot} className={`flex items-center justify-between gap-1 px-2 py-1 rounded text-xs ${isOverridden ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
                                <span className="font-mono text-muted-foreground w-10">{slot}</span>
                                {isEditing ? (
                                  <input autoFocus type="number" className="w-14 text-xs border rounded px-1 py-0.5 bg-background text-center"
                                    value={pricingEditValue} min={0} step={0.5}
                                    onChange={e => setPricingEditValue(e.target.value)}
                                    onBlur={() => {
                                      const price = parseFloat(pricingEditValue);
                                      if (!isNaN(price) && price >= 0) setLocalPricingMap(prev => { const m = new Map(prev); m.set(key, price); return m; });
                                      setPricingEditKey(null);
                                    }}
                                    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setPricingEditKey(null); }} />
                                ) : (
                                  <button type="button" onClick={() => { setPricingEditKey(key); setPricingEditValue(slotPrice.toString()); }}
                                    className={`font-medium tabular-nums w-14 text-right ${isOverridden ? "text-primary" : "text-foreground"}`}
                                  >{slotPrice.toFixed(2)}€</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>)}

                  {formTab === "media" && (<div className="space-y-4">
                    <FormField control={form.control} name="imageUrl" render={({ field }) => (
                      <FormItem><FormLabel>Pagrindinė nuotrauka</FormLabel><FormControl>
                        <CourtImageUpload value={field.value} onChange={(path) => form.setValue("imageUrl", path)} onClear={() => form.setValue("imageUrl", "")} />
                      </FormControl><FormMessage /></FormItem>
                    )} />
                    {editingId && <CourtPhotosSection courtId={editingId} />}
                  </div>)}

                  {formTab === "amenities" && (<div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="maxPlayers" render={({ field }) => (
                        <FormItem><FormLabel>Maks. žaidėjai</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="isIndoor" render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3 h-[62px]">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <div><FormLabel>Vidaus aikštelė</FormLabel></div>
                        </FormItem>
                      )} />
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Patogumai</span></div>
                      <FormField control={form.control} name="amenities" render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-2 gap-2">
                            {STANDARD_AMENITIES.map(({ id, label, icon: Icon }) => {
                              const checked = (field.value ?? []).includes(id);
                              return (
                                <button key={id} type="button" onClick={() => {
                                  const current = field.value ?? [];
                                  field.onChange(checked ? current.filter(a => a !== id) : [...current, id]);
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
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Images className="w-3.5 h-3.5" /> Nuotraukos patogumiams</p>
                              {STANDARD_AMENITIES.filter(a => (field.value ?? []).includes(a.id)).map(({ id, label, icon: Icon }) => {
                                const photoUrl = amenityPhotos[id];
                                const isUploading = uploadingAmenity === id;
                                return (
                                  <div key={id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
                                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                    <span className="text-xs font-medium flex-1 truncate">{label}</span>
                                    {photoUrl ? (<>
                                      <img src={`${BASE_URL}/${photoUrl}`} alt={label} className="w-12 h-8 object-cover rounded border shrink-0" />
                                      <button type="button" onClick={() => setAmenityPhotos(prev => { const n = { ...prev }; delete n[id]; return n; })} className="text-muted-foreground hover:text-destructive transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                                    </>) : (
                                      <label className="cursor-pointer shrink-0">
                                        <input type="file" accept="image/*" className="hidden" disabled={isUploading}
                                          onChange={e => { const file = e.target.files?.[0]; if (file) handleAmenityPhotoUpload(id, file); e.target.value = ""; }} />
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
                      <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Nuomojama įranga</span></div>
                      <div className="space-y-2">
                        {rentableItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{item.pricePerSlot}€</span>
                              <span className="text-muted-foreground">· {item.stock} vnt.</span>
                              <button type="button" onClick={() => setRentableItems(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input placeholder="Pavadinimas" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="flex-1" />
                          <Input type="number" placeholder="€" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-20" />
                          <Input type="number" placeholder="Kiekis" value={newItemStock} onChange={e => setNewItemStock(e.target.value)} className="w-20" />
                          <Button type="button" variant="outline" size="sm" onClick={() => {
                            const price = parseFloat(newItemPrice); const stock = parseInt(newItemStock);
                            if (newItemName.trim() && !isNaN(price) && price >= 0 && !isNaN(stock) && stock >= 1) {
                              setRentableItems(prev => [...prev, { name: newItemName.trim(), pricePerSlot: price, stock }]);
                              setNewItemName(""); setNewItemPrice(""); setNewItemStock("");
                            }
                          }} disabled={!newItemName.trim() || !newItemPrice || !newItemStock}><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>)}

                  {formTab === "contact" && (<div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="ownerName" render={({ field }) => (
                        <FormItem><FormLabel>Savininko vardas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="ownerEmail" render={({ field }) => (
                        <FormItem><FormLabel>Savininko el. paštas</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-3">Socialiniai tinklai</p>
                      <div className="grid grid-cols-2 gap-4">
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
                  </div>)}

                  <div className="flex items-center justify-between pt-2 border-t mt-4">
                    <div className="flex gap-1">
                      {formTab !== "info" && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          const order = ["info","schedule","amenities","media","contact"] as const;
                          const idx = order.indexOf(formTab as any);
                          if (idx > 0) setFormTab(order[idx - 1]);
                        }}>← Atgal</Button>
                      )}
                    </div>
                    {formTab !== "contact" ? (
                      <Button type="button" size="sm" onClick={() => {
                        const order = ["info","schedule","amenities","media","contact"] as const;
                        const idx = order.indexOf(formTab as any);
                        if (idx < order.length - 1) setFormTab(order[idx + 1]);
                      }}>Toliau →</Button>
                    ) : (
                      <Button type="submit" disabled={createCourt.isPending || updateCourt.isPending}>
                        {editingId ? "Išsaugoti pakeitimus" : "Sukurti aikštelę"}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {facilityCourts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-card border rounded-2xl">
            <CourtIcon size={48} className="text-muted-foreground/30 mb-4" strokeWidth={1.4} />
            <h3 className="text-lg font-semibold mb-2">Dar nėra aikštelių</h3>
            <p className="text-sm text-muted-foreground mb-4">Pridėkite pirmąją aikštelę prie šio objekto</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {facilityCourts.map(court => (
              <div key={court.id} className="bg-card border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-36 bg-muted overflow-hidden">
                  {court.imageUrl ? (
                    <img src={resolveCourtImage(court.imageUrl) ?? undefined} alt={court.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15">
                      <SportIcon sport={court.type} size={48} strokeWidth={1.5} style={{ color: sportColor[court.type] ?? "#84cc16" }} className="opacity-70" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <CourtStatusBadge status={(court as any).status} />
                  </div>
                  <div className="absolute top-2 right-2">
                    <SportPill sport={court.type} variant="solid" />
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-base mb-1">{court.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3" />
                    {court.city}, {court.address}
                  </div>

                  <div className="flex items-center gap-3 text-sm mb-4">
                    <span className="font-semibold text-primary">{court.pricePerHour}€/val</span>
                    {court.isIndoor && <Badge variant="outline" className="text-xs">Viduje</Badge>}
                    {(court as any).rating && (
                      <span className="text-xs text-yellow-500 flex items-center gap-0.5">★ {Number((court as any).rating).toFixed(1)}</span>
                    )}
                  </div>

                  {/* Primary action: Suvestinė */}
                  <Button
                    variant="default" size="sm"
                    className="w-full gap-2 mb-3 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:text-primary"
                    onClick={() => navigate(`/owner/facility/${id}/court/${court.id}`)}
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Suvestinė
                  </Button>

                  {/* Management actions */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => handleEdit(court)} title="Redaguoti">
                      <Edit2 className="w-3 h-3" /> Redaguoti
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-8 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
                      onClick={() => setBlockedSlotsCourtId(court.id)}
                      title="Blokuoti laiko tarpus, kad jie neatsidurtų viešam rezervavimui"
                    >
                      <CalendarClock className="w-3.5 h-3.5" /> Blokuoti kortą
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-8 border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20 hover:text-green-800 dark:hover:text-green-200 font-medium"
                      onClick={() => setFreeBookingCourtId(court.id)}
                      title="Sukurti rankinę rezervaciją (nemokamą / be Stripe)"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Rankinė rezervacija
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => setCoachesCourtId(court.id)}>
                      <Users className="w-3 h-3" /> Treneriai
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 text-cyan-600" onClick={() => setMembershipCourtId(court.id)}>
                      <Star className="w-3 h-3" /> Narystės
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="QR" onClick={() => setQrCourt({ id: court.id, name: court.name, type: court.type })}>
                      <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      title="Viešas puslapis"
                      onClick={() => window.open(`${BASE_URL}/courts/${court.id}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(court.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t space-y-2">
                    {/* Online/offline toggle */}
                    {["active", "hidden"].includes((court as any).status ?? "") && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Matoma viešai</span>
                        <button
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${(court as any).status === "active" ? "bg-green-500" : "bg-muted-foreground/30"}`}
                          title={(court as any).status === "active" ? "Slepia aikštelę" : "Parodo aikštelę viešai"}
                          onClick={() => {
                            const nextStatus = (court as any).status === "active" ? "hidden" : "active";
                            customFetch(`${API_URL}/courts/${court.id}/status`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: nextStatus }),
                            }).then(() => queryClient.invalidateQueries({ queryKey: ["facility-courts", id] }))
                              .catch(() => toast({ title: "Klaida keičiant statusą", variant: "destructive" }));
                          }}
                        >
                          <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transform ring-0 transition-transform ${(court as any).status === "active" ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                    )}

                    {/* Submit for review — only before first approval */}
                    {["draft", "rejected"].includes((court as any).status ?? "draft") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7 border-primary/40 text-primary hover:bg-primary/5"
                        disabled={
                          !(court.pricePerHour && Number(court.pricePerHour) > 0 && court.address && court.city)
                        }
                        onClick={() => {
                          customFetch(`${API_URL}/courts/${court.id}/submit-review`, { method: "POST" })
                            .then(() => { queryClient.invalidateQueries({ queryKey: ["facility-courts", id] }); toast({ title: "Pateikta peržiūrai ✓" }); })
                            .catch((err: any) => toast({ title: err?.message ?? "Klaida", variant: "destructive" }));
                        }}
                        title={!(court.pricePerHour && Number(court.pricePerHour) > 0 && court.address && court.city) ? "Pildykite: kaina, vieta" : ""}
                      >
                        Pateikti peržiūrai
                      </Button>
                    )}
                    {(court as any).status === "pending_review" && (
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <span>⏳</span> Laukiame administratoriaus patvirtinimo
                      </p>
                    )}
                    {(court as any).status === "rejected" && (court as any).rejectionReason && (
                      <p className="text-xs text-red-400">Priežastis: {(court as any).rejectionReason}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={pricingCourtId !== null} onOpenChange={(open) => { if (!open) setPricingCourtId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Euro className="w-5 h-5 text-primary" /> Kainų redaktorius</DialogTitle></DialogHeader>
            {pricingCourtId !== null && <PricingEditor courtId={pricingCourtId} defaultPrice={pricingDefaultPrice} workingHours={pricingWorkingHours} onClose={() => setPricingCourtId(null)} />}
          </DialogContent>
        </Dialog>

        <Dialog open={blockedSlotsCourtId !== null} onOpenChange={(open) => { if (!open) setBlockedSlotsCourtId(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" /> Blokuoti laiko tarpai</DialogTitle></DialogHeader>
            {blockedSlotsCourtId !== null && <BlockedSlotsModal courtId={blockedSlotsCourtId} onClose={() => setBlockedSlotsCourtId(null)} />}
          </DialogContent>
        </Dialog>

        <Dialog open={coachesCourtId !== null} onOpenChange={(open) => { if (!open) setCoachesCourtId(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Aikštelės treneriai</DialogTitle></DialogHeader>
            {coachesCourtId !== null && <CoachManagementModal courtId={coachesCourtId} />}
          </DialogContent>
        </Dialog>

        <FreeBookingDialog
          courtId={freeBookingCourtId}
          open={freeBookingCourtId !== null}
          onClose={() => setFreeBookingCourtId(null)}
        />

        <Dialog open={membershipCourtId !== null} onOpenChange={(open) => { if (!open) setMembershipCourtId(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-cyan-500" /> Narystės planai</DialogTitle></DialogHeader>
            {membershipCourtId !== null && <MembershipPlanManager courtId={membershipCourtId} />}
          </DialogContent>
        </Dialog>

        {qrCourt && (() => {
          const courtUrl = `${window.location.origin}${BASE_URL}/courts/${qrCourt.id}`;
          return (
            <Dialog open={!!qrCourt} onOpenChange={(open) => { if (!open) setQrCourt(null); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> QR kodas</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center p-4 text-center">
                  <div className="font-black text-xl text-primary mb-2">korts.lt</div>
                  <div className="text-sm font-bold mb-4">{qrCourt.name}</div>
                  <div className="p-3 bg-white rounded-xl border mb-4">
                    <QRCodeSVG id="court-qr-svg" value={courtUrl} size={200} bgColor="#ffffff" fgColor="#09090b" level="H" />
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 break-all font-mono w-full">{courtUrl}</div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" variant="outline" onClick={() => {
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.write(`<html><body style="display:flex;justify-content:center;padding:40px">${document.getElementById("court-qr-svg")?.outerHTML ?? ""}</body></html>`);
                    win.document.close();
                    setTimeout(() => { win.focus(); win.print(); }, 400);
                  }}><Printer className="h-4 w-4" /> Spausdinti</Button>
                  <Button className="flex-1 gap-2" onClick={() => {
                    const svg = document.getElementById("court-qr-svg");
                    if (!svg) return;
                    const serializer = new XMLSerializer();
                    const img = new Image();
                    const blob = new Blob([serializer.serializeToString(svg)], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    img.onload = () => {
                      const canvas = document.createElement("canvas"); canvas.width = 300; canvas.height = 300;
                      const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 300, 300);
                      ctx.drawImage(img, 50, 50, 200, 200); URL.revokeObjectURL(url);
                      const link = document.createElement("a"); link.download = `qr-${qrCourt.name.replace(/\s+/g, "-")}.png`;
                      link.href = canvas.toDataURL("image/png"); link.click();
                    };
                    img.src = url;
                  }}><Download className="h-4 w-4" /> PNG</Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

          {/* Photos dialog */}
          <Dialog open={photosCourtId !== null} onOpenChange={(open) => { if (!open) setPhotosCourtId(null); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Aikštelės nuotraukos</DialogTitle></DialogHeader>
              {photosCourtId !== null && <CourtPhotosSection courtId={photosCourtId} />}
            </DialogContent>
          </Dialog>

          {/* Tournaments Section */}
          <FacilityTournaments facilityId={Number(id)} facilityCourts={facilityCourts} />

          <FacilityEditDialog
            facility={facility}
            open={facilityEditOpen}
            onClose={() => setFacilityEditOpen(false)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["facility-detail", id] });
              queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
              queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
            }}
          />
      </div>
    </OwnerLayout>
  );
}

// ============ Facility edit dialog (5 tabs) ============

const facilityEditSchema = z.object({
  name: z.string().min(2, "Pavadinimas privalomas"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  companyName: z.string().optional(),
  registrationCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
type FacilityEditValues = z.infer<typeof facilityEditSchema>;

function FacilityEditDialog({
  facility, open, onClose, onSaved,
}: {
  facility: FacilityData | undefined;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"info" | "location" | "company" | "contact" | "media">("info");
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const form = useForm<FacilityEditValues>({
    resolver: zodResolver(facilityEditSchema),
    defaultValues: {
      name: "", description: "", address: "", city: "", postcode: "",
      latitude: undefined, longitude: undefined,
      companyName: "", registrationCode: "", phone: "", email: "",
    },
  });

  useEffect(() => {
    if (open && facility) {
      form.reset({
        name: facility.name ?? "",
        description: facility.description ?? "",
        address: facility.address ?? "",
        city: facility.city ?? "",
        postcode: facility.postcode ?? "",
        latitude: facility.latitude,
        longitude: facility.longitude,
        companyName: facility.companyName ?? "",
        registrationCode: facility.registrationCode ?? "",
        phone: facility.phone ?? "",
        email: facility.email ?? "",
      });
      setPhotos(Array.isArray(facility.photos) ? facility.photos : []);
      setTab("info");
      setNewPhotoUrl("");
    }
  }, [open, facility?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: FacilityEditValues) => {
      if (!facility) throw new Error("No facility");
      const cleanStr = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t.length > 0 ? t : undefined;
      };
      const payload: Record<string, unknown> = {
        name: data.name,
        description: cleanStr(data.description),
        address: cleanStr(data.address),
        city: cleanStr(data.city),
        postcode: cleanStr(data.postcode),
        latitude: typeof data.latitude === "number" && !isNaN(data.latitude) ? data.latitude : undefined,
        longitude: typeof data.longitude === "number" && !isNaN(data.longitude) ? data.longitude : undefined,
        companyName: cleanStr(data.companyName),
        registrationCode: cleanStr(data.registrationCode),
        phone: cleanStr(data.phone),
        email: cleanStr(data.email),
        photos,
      };
      return customFetch(`${API_URL}/facilities/${facility.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Objektas atnaujintas" });
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      const description = (err?.data && typeof err.data === "object" && typeof err.data.error === "string")
        ? err.data.error : (err?.message ?? "Patikrinkite užpildytus laukus");
      toast({ title: "Klaida išsaugant objektą", description, variant: "destructive" });
    },
  });

  const onSubmit = (data: FacilityEditValues) => saveMutation.mutate(data);

  const handlePhotoUpload = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("image", file);
      const resp = await fetch(`${BASE_URL}/api/upload/amenity-photo`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      setPhotos(prev => [...prev, url]);
      toast({ title: "Nuotrauka įkelta" });
    } catch {
      toast({ title: "Klaida įkeliant nuotrauką", variant: "destructive" });
    }
  };

  if (!facility) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redaguoti objektą</DialogTitle>
        </DialogHeader>

        <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none -mx-6 px-6 pb-0">
          {([
            { id: "info", label: "Pagrindai" },
            { id: "location", label: "Vieta" },
            { id: "company", label: "Įmonė" },
            { id: "contact", label: "Kontaktai" },
            { id: "media", label: "Medija" },
          ] as const).map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{t.label}</button>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {tab === "info" && (
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Pavadinimas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Aprašymas</FormLabel><FormControl><Textarea rows={4} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            )}

            {tab === "location" && (
              <div className="space-y-4">
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Adresas</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>Miestas</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="postcode" render={({ field }) => (
                    <FormItem><FormLabel>Pašto kodas</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="latitude" render={({ field }) => (
                    <FormItem><FormLabel>Platuma (lat)</FormLabel><FormControl>
                      <Input type="number" step="any" {...field} value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="longitude" render={({ field }) => (
                    <FormItem><FormLabel>Ilguma (lng)</FormLabel><FormControl>
                      <Input type="number" step="any" {...field} value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            )}

            {tab === "company" && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">Įmonės pavadinimas ir kodas reikalingi administratoriaus patvirtinimo. Pakeitimai bus peržiūrėti prieš aktyvuojant.</p>
                </div>
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">Įmonės pavadinimas <Lock className="w-3 h-3 text-muted-foreground" /></FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="registrationCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">Įmonės kodas <Lock className="w-3 h-3 text-muted-foreground" /></FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {tab === "contact" && (
              <div className="space-y-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefonas</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>El. paštas</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            )}

            {tab === "media" && (
              <div className="space-y-4">
                <Label className="text-sm">Objekto nuotraukos</Label>
                {photos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nuotraukų dar nepridėta.</p>
                )}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p, i) => (
                      <div key={`${p}-${i}`} className="relative group rounded-lg overflow-hidden border bg-muted/30 aspect-square">
                        <img
                          src={p.startsWith("http") ? p : `${BASE_URL}/${p}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Įklijuoti nuotraukos URL..."
                    value={newPhotoUrl}
                    onChange={e => setNewPhotoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={!newPhotoUrl.trim()}
                    onClick={() => {
                      const v = newPhotoUrl.trim();
                      if (!v) return;
                      setPhotos(prev => [...prev, v]);
                      setNewPhotoUrl("");
                    }}
                  >Pridėti</Button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted/60">
                    <Upload className="w-3.5 h-3.5" /> Įkelti failą
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 sticky bottom-0 bg-background">
              <Button type="button" variant="outline" onClick={onClose}>Atšaukti</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Išsaugoti
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ Tournaments Section ============

interface FacilityTournament {
  id: number;
  courtId: number;
  name: string;
  description: string | null;
  sport: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  maxParticipants: number;
  entryFee: number | null;
  prizeInfo: string | null;
  status: string;
  format: string;
  isFeatured: boolean;
  featuredUntil: string | null;
  coverPhotoUrl: string | null;
  registrationCount: number;
}

function FacilityTournaments({ facilityId, facilityCourts }: { facilityId: number; facilityCourts: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityTournament | null>(null);

  const { data: tournaments, isLoading } = useQuery<FacilityTournament[]>({
    queryKey: ["facility-tournaments", facilityId],
    queryFn: () => customFetch<FacilityTournament[]>(`${API_URL}/tournaments?facilityId=${facilityId}`),
    enabled: !!facilityId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => customFetch(`${API_URL}/tournaments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facility-tournaments", facilityId] });
      toast({ title: "Turnyras ištrintas" });
    },
  });

  const promoteMut = useMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) => customFetch(`${API_URL}/tournaments/${id}/promote`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facility-tournaments", facilityId] });
      toast({ title: "Turnyras reklamuojamas pagrindiniame puslapyje!" });
    },
  });

  return (
    <div className="bg-card border rounded-2xl p-6 mt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-primary"/>Turnyrai</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Organizuokite turnyrus ir reklamuokite juos pagrindiniame puslapyje.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={facilityCourts.length === 0}>
          <Plus className="w-4 h-4 mr-1.5"/>Naujas turnyras
        </Button>
      </div>

      {facilityCourts.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg">
          Pirmiausia sukurkite bent vieną aikštelę šiame objekte.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-24 rounded-lg"/>
      ) : (tournaments ?? []).length === 0 ? (
        <div className="text-center py-10 rounded-lg border border-dashed border-border">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2"/>
          <p className="text-sm text-muted-foreground">Dar nėra turnyrų.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments!.map((t) => {
            const isActiveFeatured = t.isFeatured && t.featuredUntil && new Date(t.featuredUntil) > new Date();
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <SportIcon sport={t.sport} size={26} strokeWidth={1.75} style={{ color: sportColor[t.sport] ?? "#84cc16" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{t.name}</h3>
                    {isActiveFeatured && <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Reklamuojamas</Badge>}
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {SPORT_LABELS[t.sport]} · {new Date(t.startDate).toLocaleDateString("lt-LT")} – {new Date(t.endDate).toLocaleDateString("lt-LT")} · {t.registrationCount}/{t.maxParticipants} dalyvių
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isActiveFeatured && (
                    <Button size="sm" variant="outline" onClick={() => promoteMut.mutate({ id: t.id, days: 14 })} disabled={promoteMut.isPending}>
                      📢 Reklamuoti 14d.
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                    <Edit2 className="w-4 h-4"/>
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => {
                    if (confirm(`Ištrinti turnyrą "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TournamentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        facilityId={facilityId}
        facilityCourts={facilityCourts}
        editing={editing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["facility-tournaments", facilityId] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function TournamentDialog({ open, onOpenChange, facilityId, facilityCourts, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; facilityId: number; facilityCourts: any[];
  editing: FacilityTournament | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", description: "", sport: "tennis", courtId: 0,
    startDate: "", endDate: "", registrationDeadline: "",
    maxParticipants: 16, entryFee: "", prizeInfo: "",
    status: "draft", format: "single_elimination", coverPhotoUrl: "",
    promote: false, promoteDays: 14,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        sport: editing.sport,
        courtId: editing.courtId,
        startDate: editing.startDate.slice(0, 10),
        endDate: editing.endDate.slice(0, 10),
        registrationDeadline: editing.registrationDeadline ? editing.registrationDeadline.slice(0, 10) : "",
        maxParticipants: editing.maxParticipants,
        entryFee: editing.entryFee != null ? String(editing.entryFee) : "",
        prizeInfo: editing.prizeInfo ?? "",
        status: editing.status,
        format: editing.format,
        coverPhotoUrl: editing.coverPhotoUrl ?? "",
        promote: false, promoteDays: 14,
      });
    } else {
      setForm({
        name: "", description: "", sport: facilityCourts[0]?.type ?? "tennis", courtId: facilityCourts[0]?.id ?? 0,
        startDate: "", endDate: "", registrationDeadline: "",
        maxParticipants: 16, entryFee: "", prizeInfo: "",
        status: "open", format: "single_elimination", coverPhotoUrl: "",
        promote: false, promoteDays: 14,
      });
    }
  }, [editing, facilityCourts, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        description: form.description || null,
        sport: form.sport,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationDeadline: form.registrationDeadline || null,
        maxParticipants: form.maxParticipants,
        entryFee: form.entryFee ? parseFloat(form.entryFee) : null,
        prizeInfo: form.prizeInfo || null,
        status: form.status,
        format: form.format,
        coverPhotoUrl: form.coverPhotoUrl || null,
        facilityId,
      };
      let tid: number;
      if (editing) {
        await customFetch(`${API_URL}/tournaments/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        tid = editing.id;
      } else {
        if (!form.courtId) throw new Error("Pasirinkite aikštelę");
        const res = await customFetch<{ id: number }>(`${API_URL}/courts/${form.courtId}/tournaments`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        tid = res.id;
      }
      if (form.promote) {
        await customFetch(`${API_URL}/tournaments/${tid}/promote`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: form.promoteDays }),
        });
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Turnyras atnaujintas" : "Turnyras sukurtas" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Redaguoti turnyrą" : "Naujas turnyras"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Pavadinimas *</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}/>
          </div>
          <div>
            <Label>Aprašymas</Label>
            <Textarea className="mt-1" rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sporto šaka *</Label>
              <Select value={form.sport} onValueChange={(v) => setForm(f => ({ ...f, sport: v }))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {Object.entries(SPORT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!editing && (
              <div>
                <Label>Aikštelė *</Label>
                <Select value={String(form.courtId)} onValueChange={(v) => setForm(f => ({ ...f, courtId: parseInt(v, 10) }))}>
                  <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {facilityCourts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Pradžia *</Label>
              <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}/>
            </div>
            <div>
              <Label>Pabaiga *</Label>
              <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}/>
            </div>
            <div>
              <Label>Reg. iki</Label>
              <Input type="date" className="mt-1" value={form.registrationDeadline} onChange={(e) => setForm(f => ({ ...f, registrationDeadline: e.target.value }))}/>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Dalyvių max</Label>
              <Input type="number" min={2} className="mt-1" value={form.maxParticipants} onChange={(e) => setForm(f => ({ ...f, maxParticipants: parseInt(e.target.value || "16", 10) }))}/>
            </div>
            <div>
              <Label>Dalyv. mokestis (€)</Label>
              <Input type="number" step="0.01" min={0} className="mt-1" value={form.entryFee} onChange={(e) => setForm(f => ({ ...f, entryFee: e.target.value }))}/>
            </div>
            <div>
              <Label>Statusas</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Juodraštis</SelectItem>
                  <SelectItem value="open">Registracija atvira</SelectItem>
                  <SelectItem value="closed">Uždaryta</SelectItem>
                  <SelectItem value="completed">Baigtas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Formatas</Label>
              <Select value={form.format} onValueChange={(v) => setForm(f => ({ ...f, format: v }))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Pašalinimas</SelectItem>
                  <SelectItem value="double_elimination">Dvigubas pašalinimas</SelectItem>
                  <SelectItem value="round_robin">Round robin</SelectItem>
                  <SelectItem value="league">Lyga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prizų info</Label>
              <Input className="mt-1" value={form.prizeInfo} onChange={(e) => setForm(f => ({ ...f, prizeInfo: e.target.value }))}/>
            </div>
          </div>
          <div>
            <Label>Nuotraukos URL (neprivaloma)</Label>
            <Input className="mt-1" placeholder="https://..." value={form.coverPhotoUrl} onChange={(e) => setForm(f => ({ ...f, coverPhotoUrl: e.target.value }))}/>
          </div>
          {!editing && (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={form.promote} onCheckedChange={(v) => setForm(f => ({ ...f, promote: !!v }))} className="mt-0.5"/>
                <div className="flex-1">
                  <Label className="text-sm font-semibold cursor-pointer" onClick={() => setForm(f => ({ ...f, promote: !f.promote }))}>
                    📢 Reklamuoti pagrindiniame puslapyje
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Turnyras bus rodomas korts.lt pradžioje matomoje vietoje.</p>
                  {form.promote && (
                    <div className="mt-3 flex items-center gap-2">
                      <Label className="text-xs">Dienų skaičius:</Label>
                      <Input type="number" min={1} max={90} className="w-24 h-8" value={form.promoteDays} onChange={(e) => setForm(f => ({ ...f, promoteDays: parseInt(e.target.value || "14", 10) }))}/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Atšaukti</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.startDate || !form.endDate}>
            {save.isPending ? "Saugoma..." : editing ? "Atnaujinti" : "Sukurti"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
