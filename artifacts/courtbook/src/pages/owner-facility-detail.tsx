import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useLocation, useParams } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/layout";
import { CourtIcon } from "@/components/sport-icon";
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
  Star, Search, UserCheck, XCircle,
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

const SPORT_EMOJIS: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏓", football: "⚽",
  badminton: "🏸", squash: "🎯", table_tennis: "🏓", golf: "⛳",
  snooker: "🎱", bowling: "🎳",
};
const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

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
  bufferMinutes: z.coerce.number().min(0).max(120).default(0),
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
  if (!status || status === "approved" || status === "active")
    return <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Aktyvus</Badge>;
  if (status === "pending_review")
    return <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Peržiūroje</Badge>;
  if (status === "pending")
    return <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Laukia</Badge>;
  if (status === "hidden")
    return <Badge className="text-xs bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Paslėpta</Badge>;
  // draft
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

function PricingEditor({ courtId, defaultPrice, onClose }: { courtId: number; defaultPrice: number; onClose: () => void }) {
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
        {DAYS.map((day, i) => (
          <button key={i} type="button" onClick={() => setSelectedDay(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}
          >{DAY_SHORT[i]}</button>
        ))}
      </div>
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
          <span className="text-sm font-semibold">{DAYS[selectedDay]}</span>
          <button type="button" onClick={() => resetDay(selectedDay)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Atstatyti numatytąją
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-border max-h-72 overflow-y-auto">
          {TIME_SLOTS.map(startTime => {
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
                    <Euro className="w-3 h-3" />{price.toFixed(0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Atšaukti</Button>
        <Button onClick={handleSave} disabled={setPricing.isPending}>{setPricing.isPending ? "Išsaugoma..." : "Išsaugoti kainas"}</Button>
      </div>
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
    mutationFn: (payload: { targetUserId?: string; targetEmail?: string; targetName?: string }) =>
      customFetch(`${API_URL}/courts/${courtId}/coach-invite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
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
                  placeholder="Ieškoti pagal vardą arba el. paštą..."
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
                    <p className="text-xs text-muted-foreground">{u.userEmail}</p>
                  </div>
                  <Button size="sm" className="h-7 text-xs"
                    onClick={() => inviteMutation.mutate({ targetUserId: u.userId, targetName: u.userName, targetEmail: u.userEmail })}
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
  const [blockedSlotsCourtId, setBlockedSlotsCourtId] = useState<number | null>(null);
  const [coachesCourtId, setCoachesCourtId] = useState<number | null>(null);
  const [freeBookingCourtId, setFreeBookingCourtId] = useState<number | null>(null);
  const [membershipCourtId, setMembershipCourtId] = useState<number | null>(null);
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

  const { data: courts, isLoading: courtsLoading } = useListCourts(
    user?.id ? { ownerUserId: user.id } : undefined
  );

  const facilityCourts = courts?.filter(c => (c as any).facilityId === Number(id)) ?? [];

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
      pricePerHour: 20, peakPricePerHour: undefined, bufferMinutes: 0,
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
      const payload = { ...data, facilityId: Number(id), rentableItems: rentableItemsJson, workingHours: whJson, amenityPhotos: amenityPhotosJson };
      if (editingId) {
        await updateCourt.mutateAsync({ id: editingId, data: payload });
        await savePricingForCourt(editingId);
        toast({ title: "Aikštelė atnaujinta" });
      } else {
        const newCourt = await createCourt.mutateAsync({ data: payload });
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
    } catch {
      toast({ title: "Klaida išsaugant aikštelę", variant: "destructive" });
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
      bufferMinutes: court.bufferMinutes ?? 0, imageUrl: court.imageUrl || "",
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
      window.location.href = data.url;
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

  if (facilityLoading || courtsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!facility) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-xl font-semibold mb-2">Objektas nerastas</h2>
          <Button onClick={() => navigate("/owner")}>Grįžti</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <button onClick={() => navigate("/owner")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Visi objektai
        </button>

        <div className="bg-card border rounded-2xl overflow-hidden mb-8">
          <div className="relative h-40 sm:h-52 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
            {facility.photos && facility.photos.length > 0 ? (
              <img src={facility.photos[0].startsWith("http") ? facility.photos[0] : `${BASE_URL}/${facility.photos[0]}`} alt="" className="w-full h-full object-cover" />
            ) : facility.courts?.length > 0 && facility.courts[0].imageUrl ? (
              <img src={facility.courts[0].imageUrl.startsWith("http") ? facility.courts[0].imageUrl : `${BASE_URL}/${facility.courts[0].imageUrl}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-20 h-20 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{facility.name}</h1>
                {facility.verificationStatus === "verified" && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/40 gap-1">
                    <ShieldCheck className="w-3 h-3" /> Patvirtinta
                  </Badge>
                )}
              </div>
              {(facility.address || facility.city) && (
                <p className="text-white/80 text-sm flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[facility.address, facility.city].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-4 border-b">
            {facility.phone && (
              <a href={`tel:${facility.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Phone className="w-3.5 h-3.5" /> {facility.phone}
              </a>
            )}
            {facility.email && (
              <a href={`mailto:${facility.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <Mail className="w-3.5 h-3.5" /> {facility.email}
              </a>
            )}
            {(facility.latitude != null && facility.longitude != null) ? (
              <a
                href={`https://www.google.com/maps?q=${facility.latitude},${facility.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <MapPin className="w-3.5 h-3.5" /> Navigacija
              </a>
            ) : facility.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([facility.address, facility.city].filter(Boolean).join(", "))}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
              >
                <MapPin className="w-3.5 h-3.5" /> Navigacija
              </a>
            ) : null}
            {facility.companyName && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" /> {facility.companyName}
                {facility.registrationCode && <span className="text-xs">({facility.registrationCode})</span>}
              </span>
            )}
          </div>

          <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{facilityCourts.length}</div>
              <div className="text-xs text-muted-foreground">Aikštelės</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {[...new Set(facilityCourts.map(c => c.type))].length}
              </div>
              <div className="text-xs text-muted-foreground">Sporto šakos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {facilityCourts.filter(c => ["approved","active"].includes((c as any).status ?? "")).length}
              </div>
              <div className="text-xs text-muted-foreground">Aktyvūs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {facilityCourts.filter(c => ["pending","pending_review","draft"].includes((c as any).status ?? "")).length}
              </div>
              <div className="text-xs text-muted-foreground">Laukia</div>
            </div>
          </div>
        </div>

        {/* Stripe Connect banner */}
        {(facility as any).stripeConnectStatus !== "active" && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <CreditCard className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-yellow-300">Stripe Connect reikalingas mokėjimams priimti</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(facility as any).stripeConnectStatus === "pending"
                  ? "Prisijungimas pradėtas — užbaikite paskyrą, kad galėtumėte priimti mokėjimus."
                  : "Aikšteles galite pridėti jau dabar. Prijunkite Stripe paskyrą, kad galėtumėte priimti mokėjimus tiesiai į savo sąskaitą."}
              </p>
            </div>
            <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 shrink-0"
              onClick={handleFacilityConnectStripe}>
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              {(facility as any).stripeConnectStatus === "pending" ? "Tęsti registraciją" : "Prijungti Stripe"}
            </Button>
          </div>
        )}

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
                  pricePerHour: 20, bufferMinutes: 0,
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
                              {Object.entries(SPORT_EMOJIS).map(([val, emoji]) => (
                                <SelectItem key={val} value={val}>{emoji} {SPORT_LABELS[val]}</SelectItem>
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
                        <FormItem><FormLabel className="flex items-center gap-1.5"><Euro className="w-3.5 h-3.5 text-primary" /> Numatytoji kaina (€/val)</FormLabel>
                          <FormControl><Input type="number" min={1} step={0.5} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="bufferMinutes" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5 text-blue-400" /> Buferis (min)</FormLabel>
                          <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="0">Nėra</SelectItem><SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem><SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select><FormMessage /></FormItem>
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
                        <span className="text-xs text-muted-foreground">Numatytoji: {((form.watch("pricePerHour") || 20) / 2).toFixed(2)}€ / 30 min</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {DAYS.map((day, i) => (
                          <button key={i} type="button" onClick={() => setPricingDay(i)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${pricingDay === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                          >{DAY_SHORT[i]}</button>
                        ))}
                        <button type="button" onClick={() => {
                          setLocalPricingMap(prev => { const next = new Map(prev); TIME_SLOTS.forEach(s => next.delete(`${pricingDay}:${s}`)); return next; });
                        }} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Atstatyti dieną
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-1">
                        {TIME_SLOTS.map(slot => {
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
                      <span className="text-4xl">{SPORT_EMOJIS[court.type] || "🏟️"}</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <CourtStatusBadge status={(court as any).status} />
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
                      {SPORT_EMOJIS[court.type]} {SPORT_LABELS[court.type]}
                    </span>
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

                  <div className="flex items-center gap-1 flex-wrap">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => { setPricingCourtId(court.id); setPricingDefaultPrice(Number(court.pricePerHour)); }}>
                      <Euro className="w-3 h-3" /> Kainos
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => setBlockedSlotsCourtId(court.id)}>
                      <CalendarClock className="w-3 h-3" /> Blokai
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => setCoachesCourtId(court.id)}>
                      <Users className="w-3 h-3" /> Treneriai
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 text-green-600" onClick={() => setFreeBookingCourtId(court.id)}>
                      <CheckCircle2 className="w-3 h-3" /> Nemokama
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8 text-cyan-600" onClick={() => setMembershipCourtId(court.id)}>
                      <Star className="w-3 h-3" /> Narystės
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="QR" onClick={() => setQrCourt({ id: court.id, name: court.name, type: court.type })}>
                      <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      title="Peržiūrėti viešą puslapį"
                      onClick={() => window.open(`/courts/${court.id}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(court)}>
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(court.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t space-y-2">
                    {/* Stripe status */}
                    {(court as any).stripeConnectStatus && (court as any).stripeConnectStatus !== "not_connected" ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${(court as any).stripeConnectStatus === "active" ? "text-green-500 bg-green-500/10" : "text-yellow-500 bg-yellow-500/10"}`}>
                        <CreditCard className="w-3 h-3" />
                        {(court as any).stripeConnectStatus === "active" ? "Stripe aktyvus" : "Stripe laukia"}
                      </span>
                    ) : (
                      <button onClick={() => handleConnectStripe(court.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition-colors">
                        <CreditCard className="w-3 h-3" /> Prijungti Stripe
                      </button>
                    )}

                    {/* Instant booking toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Momentinė rezervacija</span>
                      <button
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${(court as any).instantBookingEnabled !== false ? "bg-primary" : "bg-muted-foreground/30"}`}
                        onClick={() => {
                          const next = !((court as any).instantBookingEnabled !== false);
                          customFetch(`${API_URL}/courts/${court.id}/instant-booking`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ enabled: next }),
                          }).then(() => queryClient.invalidateQueries({ queryKey: ["facility-courts", id] }))
                            .catch(() => toast({ title: "Klaida atnaujinant", variant: "destructive" }));
                        }}
                        title="Įjungus – rezervacijos patvirtinamos automatiškai"
                      >
                        <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transform ring-0 transition-transform ${(court as any).instantBookingEnabled !== false ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>

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

                    {/* Submit for review */}
                    {["draft", "hidden"].includes((court as any).status ?? "draft") && (
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
            {pricingCourtId !== null && <PricingEditor courtId={pricingCourtId} defaultPrice={pricingDefaultPrice} onClose={() => setPricingCourtId(null)} />}
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

        {/* Tournaments Section */}
        <FacilityTournaments facilityId={Number(id)} facilityCourts={facilityCourts} />
      </div>
    </Layout>
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
                  <span className="text-2xl">{SPORT_EMOJIS[t.sport] ?? "🏆"}</span>
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
