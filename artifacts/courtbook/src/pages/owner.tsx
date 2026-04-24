import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/layout";
import {
  useListCourts, useCreateCourt, useUpdateCourt, useDeleteCourt, getListCourtsQueryKey,
  useGetCourtPricing, useSetCourtPricing, customFetch,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { Plus, Edit2, Trash2, Euro, RotateCcw, CalendarClock, FileUp, AlertTriangle, Zap, Clock3, ShoppingBag, Lightbulb, ShowerHead, DoorOpen, Droplets, X, Trophy, UserPlus, UserMinus, MessageSquare, Send, ArrowLeft, ChevronRight, Images, Upload, ChevronLeft, Users, CreditCard, CheckCircle2, ExternalLink, Car, Bath, Wifi, Coffee, HeartPulse, Thermometer, Wind, Lock, Flame, Building2, ChevronDown, QrCode, Download, Printer, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationPicker, type LocationPickerResult } from "@/components/location-picker";
import { CourtImageUpload } from "@/components/court-image-upload";
import { resolveCourtImage } from "@/lib/imageUrl";

const STANDARD_AMENITIES = [
  { id: "floodlights",     label: "Prožektoriai",           icon: Lightbulb },
  { id: "showers",         label: "Dušai",                  icon: ShowerHead },
  { id: "changing_rooms",  label: "Persirengimo kambariai", icon: DoorOpen },
  { id: "water_station",   label: "Vandens stotis",         icon: Droplets },
  { id: "parking",         label: "Parkavimas",             icon: Car },
  { id: "toilets",         label: "Tualetai",               icon: Bath },
  { id: "wifi",            label: "Wi-Fi",                  icon: Wifi },
  { id: "cafe",            label: "Kavinė / Baras",         icon: Coffee },
  { id: "first_aid",       label: "Pirmoji pagalba",        icon: HeartPulse },
  { id: "heating",         label: "Šildymas",               icon: Thermometer },
  { id: "air_conditioning",label: "Oro kondicionierius",    icon: Wind },
  { id: "lockers",         label: "Spintelės",              icon: Lock },
  { id: "sauna",           label: "Pirtis",                 icon: Flame },
] as const;

interface RentableItem {
  name: string;
  pricePerSlot: number;
  stock: number;
}

const DAYS = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];
const DAY_SHORT = ["Sek", "Pir", "Ant", "Tre", "Ket", "Pen", "Šeš"];

function generateTimeSlots() {
  const slots = [];
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break;
      const start = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      slots.push(start);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

interface PricingEditorProps {
  courtId: number;
  defaultPrice: number;
  onClose: () => void;
}

function PricingEditor({ courtId, defaultPrice, onClose }: PricingEditorProps) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState(1);
  const defaultSlotPrice = defaultPrice / 2;

  const { data: pricing, isLoading } = useGetCourtPricing(courtId);
  const setPricing = useSetCourtPricing();

  // Local pricing state: Map<"dayOfWeek:startTime", price>
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (pricing) {
      const map = new Map<string, number>();
      pricing.entries.forEach(e => {
        map.set(`${e.dayOfWeek}:${e.startTime}`, e.price);
      });
      setPriceMap(map);
    }
  }, [pricing]);

  const getPrice = (day: number, startTime: string) => {
    const key = `${day}:${startTime}`;
    return priceMap.has(key) ? priceMap.get(key)! : defaultSlotPrice;
  };

  const startEdit = (day: number, startTime: string) => {
    const key = `${day}:${startTime}`;
    setEditingKey(key);
    setEditValue(getPrice(day, startTime).toString());
  };

  const commitEdit = () => {
    if (!editingKey) return;
    const price = parseFloat(editValue);
    if (!isNaN(price) && price >= 0) {
      setPriceMap(prev => {
        const next = new Map(prev);
        next.set(editingKey, price);
        return next;
      });
    }
    setEditingKey(null);
  };

  const resetDay = (day: number) => {
    setPriceMap(prev => {
      const next = new Map(prev);
      TIME_SLOTS.forEach(s => next.delete(`${day}:${s}`));
      return next;
    });
  };

  const handleSave = async () => {
    const entries: { dayOfWeek: number; startTime: string; price: number }[] = [];
    priceMap.forEach((price, key) => {
      const [dayStr, startTime] = key.split(":");
      const dayOfWeek = parseInt(dayStr);
      if (!isNaN(dayOfWeek) && startTime) {
        entries.push({ dayOfWeek, startTime, price });
      }
    });

    try {
      await setPricing.mutateAsync({ id: courtId, data: { entries } });
      toast({ title: "Kainos išsaugotos" });
      onClose();
    } catch {
      toast({ title: "Klaida išsaugant", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nustatykite kainą kiekvienam 30 min. laiko tarpui. Numatytoji kaina: <strong>{defaultSlotPrice.toFixed(2)}€</strong> / 30 min.
      </p>

      {/* Day tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {DAYS.map((day, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedDay(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              selectedDay === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
          >
            {DAY_SHORT[i]}
          </button>
        ))}
      </div>

      {/* Slot grid for selected day */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
          <span className="text-sm font-semibold">{DAYS[selectedDay]}</span>
          <button
            type="button"
            onClick={() => resetDay(selectedDay)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Atstatyti numatytąją
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-border max-h-72 overflow-y-auto">
          {TIME_SLOTS.map((startTime) => {
            const key = `${selectedDay}:${startTime}`;
            const isEditing = editingKey === key;
            const price = getPrice(selectedDay, startTime);
            const isCustom = priceMap.has(key);

            return (
              <div
                key={startTime}
                className={`bg-card p-2 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-primary/5 transition-colors ${isEditing ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                onClick={() => !isEditing && startEdit(selectedDay, startTime)}
              >
                <span className="text-xs text-muted-foreground font-medium">{startTime}</span>
                {isEditing ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    min={0}
                    step={0.5}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingKey(null); }}
                    className="w-full text-center text-xs font-bold bg-transparent border-0 outline-none p-0 text-primary"
                    onClick={e => e.stopPropagation()}
                  />
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

      <p className="text-xs text-muted-foreground">
        Spustelėkite ant laiko tarpo, kad pakeistumėte kainą. <span className="text-primary font-medium">Mėlyna</span> — pakeista kaina.
      </p>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Atšaukti</Button>
        <Button onClick={handleSave} disabled={setPricing.isPending}>
          {setPricing.isPending ? "Išsaugoma..." : "Išsaugoti kainas"}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// BlockedSlotsModal
// ──────────────────────────────────────────────
interface CourtBlockedSlot {
  id: number;
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
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
    queryFn: () =>
      customFetch<CourtBlockedSlot[]>(`/api/courts/${courtId}/blocked-slots?date=${date}`, { method: "GET" }),
  });

  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/courts/${courtId}/blocked-slots`, {
        method: "POST",
        body: JSON.stringify({ date, startTime, endTime, reason: reason || undefined }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Laiko tarpas užblokuotas" });
    },
    onError: () => toast({ title: "Klaida", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (slotId: number) =>
      customFetch(`/api/courts/${courtId}/blocked-slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast({ title: "Blokavimas pašalintas" });
    },
    onError: () => toast({ title: "Klaida", variant: "destructive" }),
  });

  function generateTimeOptions() {
    const opts: string[] = [];
    for (let h = 7; h <= 22; h++) {
      for (const m of [0, 30]) {
        opts.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    return opts;
  }

  const timeOptions = generateTimeOptions();

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Blokuokite laiko tarpus, kurie nebus prieinami rezervuoti (pvz., techninis aptarnavimas).
      </p>

      {/* Date picker */}
      <div className="space-y-1">
        <Label>Data</Label>
        <Input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} />
      </div>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nuo</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          >
            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Iki</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          >
            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Priežastis (neprivaloma)</Label>
        <Input placeholder="pvz. Techninis aptarnavimas" value={reason} onChange={e => setReason(e.target.value)} />
      </div>

      <Button
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending || startTime >= endTime}
        className="w-full"
      >
        {addMutation.isPending ? "Blokuojama..." : "Užblokuoti"}
      </Button>

      {/* List of blocked slots */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Blokuoti laikai {date}</p>
        {isLoading && <Skeleton className="h-10 w-full" />}
        {!isLoading && slots.length === 0 && (
          <p className="text-sm text-muted-foreground">Blokuotų laikų nėra</p>
        )}
        {slots.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <span className="text-sm font-medium">{s.startTime} – {s.endTime}</span>
              {s.reason && <span className="ml-2 text-xs text-muted-foreground">{s.reason}</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeMutation.mutate(s.id)}
              disabled={removeMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Uždaryti</Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Court form schema
// ──────────────────────────────────────────────
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

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "approved") return null;
  if (status === "pending" || status === "pending_review")
    return (
      <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-2">
        Laukiama
      </Badge>
    );
  return (
    <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 ml-2">
      Atmesta
    </Badge>
  );
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

interface Facility {
  id: number;
  name: string;
  description?: string;
  ownerUserId: string;
  createdAt: Date;
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

interface OwnerThread {
  courtId: number;
  courtName: string;
  threadUserId: string;
  threadUserName: string;
  lastMessage: { body: string; senderUserId: string; createdAt: string };
}

interface OwnerMsg {
  id: number;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

function OwnerChatPane({
  thread,
  ownerUserId,
  ownerName,
  ownerEmail,
  onBack,
}: {
  thread: OwnerThread;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  onBack: () => void;
}) {
  const [msgs, setMsgs] = useState<OwnerMsg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/courts/${thread.courtId}/messages?userId=${encodeURIComponent(thread.threadUserId)}`)
      .then(r => r.json())
      .then(data => { setMsgs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [thread.courtId, thread.threadUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/courts/${thread.courtId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderUserId: ownerUserId, senderName: ownerName, senderEmail: ownerEmail, body: text, threadUserId: thread.threadUserId }),
      });
      const msg = await r.json();
      setMsgs(prev => [...prev, msg]);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">{thread.threadUserName}</p>
          <p className="text-xs text-muted-foreground">{thread.courtName}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <Skeleton className="h-10 w-44 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p>Dar nėra žinučių šiame pokalbyje.</p>
          </div>
        ) : (
          msgs.map(msg => {
            const isMine = msg.senderUserId === ownerUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                  {!isMine && <span className="text-[11px] text-muted-foreground px-1">{msg.senderName}</span>}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    {msg.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {format(parseISO(msg.createdAt), "HH:mm · dd MMM")}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t bg-card px-3 py-2.5 flex gap-2 items-end shrink-0">
        <Textarea
          placeholder="Rašykite atsakymą..."
          className="resize-none min-h-[36px] max-h-[100px] text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={send} disabled={sending || !text.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function OwnerInbox({ ownerUserId, ownerName, ownerEmail }: { ownerUserId: string; ownerName: string; ownerEmail: string }) {
  const [threads, setThreads] = useState<OwnerThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OwnerThread | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/messages/owner-inbox?ownerUserId=${encodeURIComponent(ownerUserId)}`)
      .then(r => r.json())
      .then(data => { setThreads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ownerUserId]);

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-8" style={{ height: 520 }}>
      <div
        className="grid h-full"
        style={{ gridTemplateColumns: selected ? "280px 1fr" : "1fr", transition: "grid-template-columns 0.2s" }}
      >
        {/* Thread list */}
        <div className={`border-r flex flex-col min-w-0 ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-sm">Pokalbiai su vartotojais</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 items-center">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-sm gap-2">
                <MessageSquare className="w-10 h-10 opacity-20" />
                <p>Dar nėra žinučių.</p>
              </div>
            ) : (
              threads.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelected(t)}
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors ${selected?.courtId === t.courtId && selected?.threadUserId === t.threadUserId ? "bg-muted/60" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                    {t.threadUserName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{t.threadUserName}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.courtName}</p>
                    <p className="text-xs text-muted-foreground/70 truncate">{t.lastMessage.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{format(parseISO(t.lastMessage.createdAt), "dd MMM")}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat pane */}
        {selected ? (
          <div className="flex flex-col min-w-0 h-full">
            <OwnerChatPane
              thread={selected}
              ownerUserId={ownerUserId}
              ownerName={ownerName}
              ownerEmail={ownerEmail}
              onBack={() => setSelected(null)}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-12 h-12 opacity-15" />
            <p>Pasirinkite pokalbį</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface CoachItem {
  id: number;
  name: string;
  email: string;
  sports: string[];
  pricePerHour?: number;
  photoUrl?: string;
}

function CoachAssignModal({ courtId, onClose }: { courtId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: assigned = [], isLoading: assignedLoading } = useQuery<CoachItem[]>({
    queryKey: ["court-coaches-assigned", courtId],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/courts/${courtId}/coaches`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: allCoaches = [], isLoading: allLoading } = useQuery<CoachItem[]>({
    queryKey: ["all-coaches"],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/coaches`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const assignedIds = new Set(assigned.map(c => c.id));
  const availableToAssign = allCoaches.filter(c => !assignedIds.has(c.id));

  const assignMutation = useMutation({
    mutationFn: async (coachId: number) => {
      const r = await fetch(`${API_URL}/courts/${courtId}/coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ coachId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Klaida priskiriant trenerį");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-coaches-assigned", courtId] });
      qc.invalidateQueries({ queryKey: ["court-coaches", courtId] });
      toast({ title: "Treneris priskirtas" });
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (coachId: number) => {
      const r = await fetch(`${API_URL}/courts/${courtId}/coaches/${coachId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Klaida šalinant trenerį");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court-coaches-assigned", courtId] });
      qc.invalidateQueries({ queryKey: ["court-coaches", courtId] });
      toast({ title: "Treneris pašalintas" });
    },
    onError: (e: Error) => toast({ title: "Klaida", description: e.message, variant: "destructive" }),
  });

  if (assignedLoading || allLoading) {
    return <div className="py-8 text-center text-muted-foreground">Kraunama...</div>;
  }

  return (
    <div className="space-y-5 py-2">
      {/* Assigned coaches */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Priskirti treneriai</h3>
        {assigned.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3 border border-dashed">
            Nėra priskirtų trenerių.
          </div>
        ) : (
          <div className="space-y-2">
            {assigned.map(coach => (
              <div key={coach.id} className="flex items-center justify-between gap-3 border rounded-xl px-4 py-3 bg-card">
                <div className="flex items-center gap-3 min-w-0">
                  {coach.photoUrl ? (
                    <img src={coach.photoUrl} alt={coach.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-primary/60" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{coach.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {coach.sports.map(s => SPORT_LABELS[s] ?? s).join(", ")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeMutation.mutate(coach.id)}
                  disabled={removeMutation.isPending}
                >
                  <UserMinus className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available to assign */}
      {availableToAssign.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Pridėti trenerį</h3>
          <div className="space-y-2">
            {availableToAssign.map(coach => (
              <div key={coach.id} className="flex items-center justify-between gap-3 border rounded-xl px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-3 min-w-0">
                  {coach.photoUrl ? (
                    <img src={coach.photoUrl} alt={coach.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{coach.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{coach.sports.map(s => SPORT_LABELS[s] ?? s).join(", ")}</span>
                      {coach.pricePerHour != null && <span>· {coach.pricePerHour}€/val</span>}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 text-xs"
                  onClick={() => assignMutation.mutate(coach.id)}
                  disabled={assignMutation.isPending}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Priskirti
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {allCoaches.length === 0 && (
        <div className="text-sm text-center py-4 text-muted-foreground">
          Sistemoje dar nėra trenerių.{" "}
          <a href="/coach/me" className="text-primary hover:underline">Sukurti profilį</a>
        </div>
      )}
    </div>
  );
}

const BASE_API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

interface CourtPhoto { id: number; url: string; caption: string | null; displayOrder: number; }

const MAX_GALLERY_PHOTOS = 3;

function CourtPhotosSection({ courtId }: { courtId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const { data: photos = [], isLoading } = useQuery<CourtPhoto[]>({
    queryKey: ["court-photos", courtId],
    queryFn: async () => {
      const r = await fetch(`${BASE_API}/courts/${courtId}/photos`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    const remaining = MAX_GALLERY_PHOTOS - photos.length;
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
        const r = await fetch(`${BASE_API}/courts/${courtId}/photos`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error ?? `Klaida (${r.status})`);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["court-photos", courtId] });
      toast({ title: toUpload.length === 1 ? "Nuotrauka įkelta" : `${toUpload.length} nuotraukos įkeltos` });
    } catch (err: any) {
      toast({ title: "Įkėlimo klaida", description: err.message ?? "Bandykite dar kartą", variant: "destructive" });
      await queryClient.invalidateQueries({ queryKey: ["court-photos", courtId] });
    } finally {
      previews.forEach(URL.revokeObjectURL);
      setPendingPreviews([]);
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(photoId: number) {
    await fetch(`${BASE_API}/courts/${courtId}/photos/${photoId}`, {
      method: "DELETE", credentials: "include",
    });
    await queryClient.invalidateQueries({ queryKey: ["court-photos", courtId] });
  }

  const confirmedCount = photos.length;
  const totalShown = confirmedCount + pendingPreviews.length;
  const canAddMore = totalShown < MAX_GALLERY_PHOTOS && !uploading;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Images className="h-4 w-4 text-muted-foreground" />
          Galerijos nuotraukos
          <span className="text-xs text-muted-foreground font-normal">
            ({confirmedCount}/{MAX_GALLERY_PHOTOS})
          </span>
        </Label>
        {confirmedCount < MAX_GALLERY_PHOTOS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => !uploading && photoInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 h-8 text-xs"
          >
            {uploading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{uploadProgress ? `${uploadProgress.current}/${uploadProgress.total} keliama...` : "Keliama..."}</>
              : <><Upload className="h-3.5 w-3.5" />Pridėti</>
            }
          </Button>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2].map(i => <Skeleton key={i} className="aspect-video rounded-lg" />)}
        </div>
      ) : photos.length === 0 && pendingPreviews.length === 0 ? (
        <button
          type="button"
          onClick={() => !uploading && photoInputRef.current?.click()}
          disabled={uploading}
          className="w-full border border-dashed rounded-xl py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Images className="h-6 w-6 opacity-40" />
          Nėra papildomų nuotraukų. Spauskite, kad pridėtumėte.
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-video rounded-lg overflow-hidden border border-border">
              <img src={resolveCourtImage(photo.url) ?? ""} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
            </div>
          ))}
          {pendingPreviews.map((src, i) => (
            <div key={`pending-${i}`} className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/40 animate-pulse">
              <img src={src} alt="" className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
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
    </div>
  );
}

const API = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

const SPORT_OPTIONS = [
  { value: "tennis", label: "🎾 Tenisas" }, { value: "basketball", label: "🏀 Krepšinis" },
  { value: "padel", label: "🏓 Padelis" }, { value: "football", label: "⚽ Futbolas" },
  { value: "badminton", label: "🏸 Badmintonas" }, { value: "squash", label: "🎯 Skvošas" },
  { value: "table_tennis", label: "🏓 Stalo tenisas" }, { value: "golf", label: "⛳ Golfas" },
  { value: "snooker", label: "🎱 Snukeris" }, { value: "bowling", label: "🎳 Boulingas" },
];

const OWNER_DAYS = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];

interface TrainerRow { id: number; courtId: number; name: string; bio: string|null; photoUrl: string|null; sports: string[]; hourlyRate: number|null; availabilityJson: string|null; email: string|null; phone: string|null; }

function OwnerTrainersSection({ courts, ownerUserId }: { courts: { id: number; name: string }[]; ownerUserId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<TrainerRow | null>(null);
  const [form, setForm] = useState({ courtId: courts[0]?.id ?? 0, name: "", bio: "", photoUrl: "", email: "", phone: "", hourlyRate: "", sports: [] as string[], availability: {} as Record<string, { start: string; end: string }> });

  const { data: trainers = [], isLoading } = useQuery<TrainerRow[]>({
    queryKey: ["owner-trainers", ownerUserId],
    queryFn: async () => {
      const all = await Promise.all(courts.map(c => fetch(`${API}/courts/${c.id}/trainers`).then(r => r.json())));
      return all.flat();
    },
    enabled: courts.length > 0,
  });

  const courtName = (id: number) => courts.find(c => c.id === id)?.name ?? `Court ${id}`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, bio: form.bio || null, photoUrl: form.photoUrl || null,
        sports: form.sports, hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        availabilityJson: Object.keys(form.availability).length ? JSON.stringify(form.availability) : null,
        email: form.email || null, phone: form.phone || null,
      };
      if (editingTrainer) {
        const r = await fetch(`${API}/trainers/${editingTrainer.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Klaida");
        return r.json();
      } else {
        const r = await fetch(`${API}/courts/${form.courtId}/trainers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Klaida");
        return r.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-trainers", ownerUserId] });
      setDialogOpen(false);
      toast({ title: editingTrainer ? "Treneris atnaujintas" : "Treneris pridėtas" });
    },
    onError: () => toast({ title: "Klaida išsaugant", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/trainers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-trainers", ownerUserId] }); toast({ title: "Treneris ištrintas" }); },
  });

  const openCreate = () => {
    setEditingTrainer(null);
    setForm({ courtId: courts[0]?.id ?? 0, name: "", bio: "", photoUrl: "", email: "", phone: "", hourlyRate: "", sports: [], availability: {} });
    setDialogOpen(true);
  };

  const openEdit = (t: TrainerRow) => {
    setEditingTrainer(t);
    let avail: Record<string, { start: string; end: string }> = {};
    try { avail = t.availabilityJson ? JSON.parse(t.availabilityJson) : {}; } catch { /* ignore */ }
    setForm({ courtId: t.courtId, name: t.name, bio: t.bio ?? "", photoUrl: t.photoUrl ?? "", email: t.email ?? "", phone: t.phone ?? "", hourlyRate: t.hourlyRate != null ? String(t.hourlyRate) : "", sports: t.sports, availability: avail });
    setDialogOpen(true);
  };

  const toggleSport = (s: string) => setForm(f => ({ ...f, sports: f.sports.includes(s) ? f.sports.filter(x => x !== s) : [...f.sports, s] }));
  const toggleDay = (d: number, enabled: boolean) => {
    setForm(f => {
      const av = { ...f.availability };
      if (enabled) av[String(d)] = { start: "09:00", end: "18:00" };
      else delete av[String(d)];
      return { ...f, availability: av };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{trainers.length} trenerių</p>
        <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="w-4 h-4" />Pridėti trenerį</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : trainers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p className="font-medium">Trenerių dar nėra</p>
          <p className="text-sm mt-1">Pridėkite pirmąjį trenerį savo aikštelei</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Vardas</TableHead>
                <TableHead className="hidden md:table-cell">Aikštelė</TableHead>
                <TableHead className="hidden sm:table-cell">Sportas</TableHead>
                <TableHead className="hidden md:table-cell">Kaina/val</TableHead>
                <TableHead className="text-right">Veiksmai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainers.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {t.photoUrl ? (
                        <img src={t.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{t.name[0]}</div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{courtName(t.courtId)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {t.sports.slice(0, 2).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                      {t.sports.length > 2 && <Badge variant="outline" className="text-xs">+{t.sports.length-2}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{t.hourlyRate != null ? `€${t.hourlyRate}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Ištrinti trenerį?")) deleteMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrainer ? "Redaguoti trenerį" : "Pridėti trenerį"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!editingTrainer && courts.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Aikštelė *</Label>
                <Select value={String(form.courtId)} onValueChange={v => setForm(f => ({ ...f, courtId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{courts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Vardas *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vardas Pavardė" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">El. paštas</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefonas</Label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kaina/val (€)</Label>
                <Input type="number" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nuotraukos URL</Label>
                <Input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aprašymas</Label>
              <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sporto šakos</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SPORT_OPTIONS.map(s => (
                  <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.sports.includes(s.value)} onCheckedChange={() => toggleSport(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Darbo laikas</Label>
              <div className="space-y-2">
                {OWNER_DAYS.map((day, d) => {
                  const slot = form.availability[String(d)];
                  return (
                    <div key={d} className="flex items-center gap-2">
                      <Checkbox checked={!!slot} onCheckedChange={v => toggleDay(d, !!v)} />
                      <span className="text-sm w-28">{day}</span>
                      {slot && (
                        <>
                          <Input type="time" value={slot.start} onChange={e => setForm(f => ({ ...f, availability: { ...f.availability, [d]: { ...slot, start: e.target.value } } }))} className="h-8 w-24 text-xs" />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input type="time" value={slot.end} onChange={e => setForm(f => ({ ...f, availability: { ...f.availability, [d]: { ...slot, end: e.target.value } } }))} className="h-8 w-24 text-xs" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending ? "Saugoma..." : editingTrainer ? "Išsaugoti" : "Pridėti trenerį"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TournamentRow { id: number; courtId: number; name: string; description: string|null; sport: string; startDate: string; endDate: string; registrationDeadline: string|null; maxParticipants: number; entryFee: number|null; prizeInfo: string|null; status: string; format: string; registrationCount: number; }
interface TournamentRegRow { id: number; playerName: string; playerEmail: string; playerPhone: string|null; status: string; registeredAt: string; }

const FORMAT_OPTIONS = [
  { value: "single_elimination", label: "Viengubas pašalinimas" },
  { value: "double_elimination", label: "Dvigubas pašalinimas" },
  { value: "round_robin", label: "Round Robin" },
  { value: "league", label: "Lyga" },
];
const STATUS_OPTIONS_OWNER = [
  { value: "draft", label: "Rengiamas" },
  { value: "open", label: "Registracija atidaryta" },
  { value: "closed", label: "Registracija uždaryta" },
  { value: "completed", label: "Baigtas" },
];

function OwnerTournamentsSection({ courts, ownerUserId }: { courts: { id: number; name: string }[]; ownerUserId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingT, setEditingT] = useState<TournamentRow | null>(null);
  const [viewRegsId, setViewRegsId] = useState<number | null>(null);
  const emptyForm = () => ({
    courtId: courts[0]?.id ?? 0, name: "", description: "", sport: "tennis",
    startDate: "", endDate: "", registrationDeadline: "",
    maxParticipants: "16", entryFee: "", prizeInfo: "", status: "draft", format: "single_elimination",
  });
  const [form, setForm] = useState(emptyForm());

  const { data: tournaments = [], isLoading } = useQuery<TournamentRow[]>({
    queryKey: ["owner-tournaments", ownerUserId],
    queryFn: async () => {
      const all = await Promise.all(courts.map(c => fetch(`${API}/courts/${c.id}/tournaments`).then(r => r.json())));
      return all.flat();
    },
    enabled: courts.length > 0,
  });

  const { data: regs = [] } = useQuery<TournamentRegRow[]>({
    queryKey: ["tournament-regs", viewRegsId],
    queryFn: async () => {
      const r = await fetch(`${API}/tournaments/${viewRegsId}/registrations`, { credentials: "include" });
      if (!r.ok) throw new Error("Not allowed");
      return r.json();
    },
    enabled: viewRegsId !== null,
  });

  const courtName = (id: number) => courts.find(c => c.id === id)?.name ?? `Court ${id}`;
  const STATUS_LABEL: Record<string, string> = { draft: "Rengiamas", open: "Registracija", closed: "Uždaryta", completed: "Baigtas" };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, description: form.description || null, sport: form.sport,
        startDate: form.startDate, endDate: form.endDate,
        registrationDeadline: form.registrationDeadline || null,
        maxParticipants: Number(form.maxParticipants),
        entryFee: form.entryFee ? Number(form.entryFee) : null,
        prizeInfo: form.prizeInfo || null, status: form.status, format: form.format,
      };
      if (editingT) {
        const r = await fetch(`${API}/tournaments/${editingT.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Klaida");
        return r.json();
      } else {
        const r = await fetch(`${API}/courts/${form.courtId}/tournaments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error("Klaida");
        return r.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-tournaments", ownerUserId] });
      setDialogOpen(false);
      toast({ title: editingT ? "Turnyras atnaujintas" : "Turnyras sukurtas" });
    },
    onError: () => toast({ title: "Klaida išsaugant", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await fetch(`${API}/tournaments/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-tournaments", ownerUserId] }); toast({ title: "Turnyras ištrintas" }); },
  });

  const deleteRegMutation = useMutation({
    mutationFn: async ({ tid, rid }: { tid: number; rid: number }) => { await fetch(`${API}/tournaments/${tid}/registrations/${rid}`, { method: "DELETE" }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-regs", viewRegsId] }),
  });

  const openCreate = () => { setEditingT(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (t: TournamentRow) => {
    setEditingT(t);
    setForm({ courtId: t.courtId, name: t.name, description: t.description ?? "", sport: t.sport, startDate: t.startDate, endDate: t.endDate, registrationDeadline: t.registrationDeadline ?? "", maxParticipants: String(t.maxParticipants), entryFee: t.entryFee != null ? String(t.entryFee) : "", prizeInfo: t.prizeInfo ?? "", status: t.status, format: t.format });
    setDialogOpen(true);
  };

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground", open: "bg-green-500/15 text-green-500",
    closed: "bg-orange-500/15 text-orange-500", completed: "bg-blue-500/15 text-blue-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tournaments.length} turnyrų</p>
        <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="w-4 h-4" />Sukurti turnyrą</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : tournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p className="font-medium">Turnyrų dar nėra</p>
          <p className="text-sm mt-1">Sukurkite pirmąjį turnyrą</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Pavadinimas</TableHead>
                <TableHead className="hidden md:table-cell">Aikštelė</TableHead>
                <TableHead className="hidden sm:table-cell">Data</TableHead>
                <TableHead>Būsena</TableHead>
                <TableHead className="hidden md:table-cell">Dalyviai</TableHead>
                <TableHead className="text-right">Veiksmai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.sport}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{courtName(t.courtId)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{t.startDate}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status]}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{t.registrationCount}/{t.maxParticipants}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Žiūrėti dalyvius" onClick={() => setViewRegsId(viewRegsId === t.id ? null : t.id)}>
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Ištrinti turnyrą?")) deleteMutation.mutate(t.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Registrations panel */}
      {viewRegsId !== null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Dalyvių sąrašas ({regs.length})</h3>
            <Button variant="ghost" size="icon" onClick={() => setViewRegsId(null)}><X className="w-4 h-4" /></Button>
          </div>
          {regs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Dalyvių dar nėra</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vardas</TableHead>
                <TableHead>El. paštas</TableHead>
                <TableHead className="hidden sm:table-cell">Tel.</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {regs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.playerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.playerEmail}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{r.playerPhone ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.registeredAt.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Pašalinti dalyvį?")) deleteRegMutation.mutate({ tid: viewRegsId!, rid: r.id }); }}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Tournament form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingT ? "Redaguoti turnyrą" : "Sukurti turnyrą"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!editingT && courts.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Aikštelė *</Label>
                <Select value={String(form.courtId)} onValueChange={v => setForm(f => ({ ...f, courtId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{courts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Pavadinimas *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vilniaus teniso čempionatas" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aprašymas</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sporto šaka *</Label>
                <Select value={form.sport} onValueChange={v => setForm(f => ({ ...f, sport: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPORT_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Formatas</Label>
                <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pradžia *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pabaiga *</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Registracija iki</Label>
                <Input type="date" value={form.registrationDeadline} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Maks. dalyviai</Label>
                <Input type="number" value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dalyvio mokestis (€)</Label>
                <Input type="number" value={form.entryFee} onChange={e => setForm(f => ({ ...f, entryFee: e.target.value }))} placeholder="0 = nemokama" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Būsena</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS_OWNER.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prizai</Label>
              <Input value={form.prizeInfo} onChange={e => setForm(f => ({ ...f, prizeInfo: e.target.value }))} placeholder="1 vieta – €200, 2 vieta – €100" />
            </div>
            <Button onClick={() => saveMutation.mutate()} className="w-full" disabled={saveMutation.isPending || !form.name.trim() || !form.startDate || !form.endDate}>
              {saveMutation.isPending ? "Saugoma..." : editingT ? "Išsaugoti" : "Sukurti turnyrą"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OwnerDashboard() {
  const { user } = useUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [pricingCourtId, setPricingCourtId] = useState<number | null>(null);
  const [qrCourt, setQrCourt] = useState<{ id: number; name: string; type: string } | null>(null);
  const [pricingDefaultPrice, setPricingDefaultPrice] = useState(20);
  const [blockedSlotsCourtId, setBlockedSlotsCourtId] = useState<number | null>(null);
  const [coachesCourtId, setCoachesCourtId] = useState<number | null>(null);
  const [ownershipDocUploading, setOwnershipDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [rentableItems, setRentableItems] = useState<RentableItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");
  const [showInbox, setShowInbox] = useState(false);
  const [activeOwnerTab, setActiveOwnerTab] = useState<"courts" | "trainers" | "tournaments">("courts");
  const [formTab, setFormTab] = useState<"info" | "schedule" | "amenities" | "media" | "contact">("info");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showNewFacilityInput, setShowNewFacilityInput] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState("");
  const [localPricingMap, setLocalPricingMap] = useState<Map<string, number>>(new Map());
  const [workingHoursState, setWorkingHoursState] = useState<WorkingHoursMap>(defaultWorkingHours());
  const [amenityPhotos, setAmenityPhotos] = useState<Record<string, string>>({});
  const [uploadingAmenity, setUploadingAmenity] = useState<string | null>(null);

  const { data: courts, isLoading } = useListCourts(
    user?.id ? { ownerUserId: user.id } : undefined
  );
  const createCourt = useCreateCourt();
  const updateCourt = useUpdateCourt();
  const deleteCourt = useDeleteCourt();
  const setPricingMutation = useSetCourtPricing();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: editingPricing } = useGetCourtPricing(editingId ?? 0);

  useEffect(() => {
    if (editingId && editingPricing?.entries) {
      const map = new Map<string, number>();
      editingPricing.entries.forEach((e: { dayOfWeek: number; startTime: string; price: number }) => {
        map.set(`${e.dayOfWeek}:${e.startTime}`, e.price);
      });
      setLocalPricingMap(map);
    } else if (!editingId) {
      setLocalPricingMap(new Map());
    }
  }, [editingId, editingPricing]);

  useEffect(() => {
    if (!user?.id) return;
    customFetch<Facility[]>(`${API_URL}/facilities`)
      .then(data => setFacilities(data))
      .catch(() => { /* ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createFacility = async (name: string): Promise<number | null> => {
    try {
      const fac = await customFetch<Facility>(`${API_URL}/facilities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setFacilities(prev => [...prev, fac]);
      return fac.id;
    } catch { return null; }
  };

  const deleteFacility = async (id: number) => {
    try {
      await customFetch(`${API_URL}/facilities/${id}`, { method: "DELETE" });
      setFacilities(prev => prev.filter(f => f.id !== id));
    } catch { /* ignore */ }
  };

  const form = useForm<CourtFormValues>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      name: "",
      type: "tennis",
      description: "",
      address: "",
      city: "",
      latitude: 0,
      longitude: 0,
      pricePerHour: 20,
      peakPricePerHour: undefined,
      bufferMinutes: 0,
      imageUrl: "",
      ownershipDocUrl: "",
      ownerName: user?.fullName ?? "Owner",
      ownerEmail: user?.primaryEmailAddress?.emailAddress ?? "owner@example.com",
      isIndoor: false,
      maxPlayers: 4,
      postcode: "",
      amenities: [],
      socialFacebook: "",
      socialInstagram: "",
      socialWhatsapp: "",
      socialWebsite: "",
      facilityId: undefined,
      workingHours: undefined,
    }
  });

  const watchedLat = form.watch("latitude") ?? 0;
  const watchedLng = form.watch("longitude") ?? 0;

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
      const payload = { ...data, rentableItems: rentableItemsJson, workingHours: whJson, amenityPhotos: amenityPhotosJson };
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
    } catch {
      toast({ title: "Klaida išsaugant aikštelę", variant: "destructive" });
    }
  };

  const handleEdit = (court: any) => {
    setEditingId(court.id);
    setMapKey(k => k + 1);
    setFormTab("info");
    form.reset({
      name: court.name,
      type: court.type as "tennis" | "basketball" | "padel" | "football" | "badminton" | "squash" | "table_tennis" | "golf" | "snooker" | "bowling",
      description: court.description || "",
      address: court.address,
      city: court.city,
      latitude: court.latitude,
      longitude: court.longitude,
      pricePerHour: court.pricePerHour,
      peakPricePerHour: court.peakPricePerHour ?? undefined,
      bufferMinutes: court.bufferMinutes ?? 0,
      imageUrl: court.imageUrl || "",
      ownershipDocUrl: court.ownershipDocUrl || "",
      ownerName: court.ownerName,
      ownerEmail: court.ownerEmail,
      isIndoor: court.isIndoor,
      maxPlayers: court.maxPlayers,
      amenities: Array.isArray(court.amenities) ? court.amenities : [],
      postcode: court.postcode ?? "",
      socialFacebook: court.socialFacebook ?? "",
      socialInstagram: court.socialInstagram ?? "",
      socialWhatsapp: court.socialWhatsapp ?? "",
      socialWebsite: court.socialWebsite ?? "",
      facilityId: court.facilityId ?? undefined,
      workingHours: court.workingHours ?? undefined,
    });
    if (court.workingHours) {
      try {
        const parsed = JSON.parse(court.workingHours) as WorkingHoursMap;
        setWorkingHoursState({ ...defaultWorkingHours(), ...parsed });
      } catch {
        setWorkingHoursState(defaultWorkingHours());
      }
    } else {
      setWorkingHoursState(defaultWorkingHours());
    }
    try {
      const raw: Array<{ name: string; pricePerSlot?: number; pricePerBooking?: number; stock?: number }> =
        court.rentableItems ? JSON.parse(court.rentableItems) : [];
      setRentableItems(raw.map(r => ({
        name: r.name,
        pricePerSlot: r.pricePerSlot ?? r.pricePerBooking ?? 0,
        stock: r.stock ?? 1,
      })));
    } catch {
      setRentableItems([]);
    }
    try {
      const photos = court.amenityPhotos ? JSON.parse(court.amenityPhotos) : {};
      setAmenityPhotos(typeof photos === "object" && photos !== null ? photos : {});
    } catch {
      setAmenityPhotos({});
    }
    setIsDialogOpen(true);
  };

  const handleDocUpload = async (file: File) => {
    setOwnershipDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("doc", file);
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${baseUrl}/api/upload/ownership-doc`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      form.setValue("ownershipDocUrl", url);
      toast({ title: "Dokumentas įkeltas" });
    } catch {
      toast({ title: "Klaida įkeliant dokumentą", variant: "destructive" });
    } finally {
      setOwnershipDocUploading(false);
    }
  };

  const handleAmenityPhotoUpload = async (amenityId: string, file: File) => {
    setUploadingAmenity(amenityId);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${baseUrl}/api/upload/amenity-photo`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      setAmenityPhotos(prev => ({ ...prev, [amenityId]: url }));
      toast({ title: "Nuotrauka įkelta" });
    } catch {
      toast({ title: "Klaida įkeliant nuotrauką", variant: "destructive" });
    } finally {
      setUploadingAmenity(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Ar tikrai norite ištrinti šią aikštelę?")) return;
    try {
      await deleteCourt.mutateAsync({ id });
      toast({ title: "Court deleted" });
      queryClient.invalidateQueries({ queryKey: getListCourtsQueryKey() });
    } catch {
      toast({ title: "Error deleting court", variant: "destructive" });
    }
  };

  const handleConnectStripe = async (courtId: number) => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const origin = window.location.origin;
      const r = await fetch(`${base}/api/payments/connect/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          returnUrl: `${origin}${base}/owner?connect_success=1&courtId=${courtId}`,
          refreshUrl: `${origin}${base}/owner?connect_refresh=1&courtId=${courtId}`,
        }),
      });
      if (!r.ok) throw new Error("Klaida");
      const { url } = await r.json();
      window.location.href = url;
    } catch {
      toast({ title: "Nepavyko inicijuoti Stripe Connect", variant: "destructive" });
    }
  };

  // Handle Stripe Connect return from onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect_success") === "1" || params.get("stripe_connect") === "success") {
      toast({ title: "✅ Stripe Connect prijungtas!", description: "Dabar galite priimti mokėjimus." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("connect_refresh") === "1" || params.get("stripe_connect") === "refresh") {
      toast({ title: "Stripe Connect neužbaigtas", description: "Bandykite dar kartą." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Owner-level Stripe Connect (Express account on user) ──────────────────
  const stripeConnectStatusQuery = useQuery<{ status: string; accountId: string | null }>({
    queryKey: ["stripe-connect-status"],
    queryFn: () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      return fetch(`${base}/api/stripe/connect/status`, { credentials: "include" })
        .then(r => r.ok ? r.json() : { status: "not_connected", accountId: null });
    },
  });
  const [connectingStripe, setConnectingStripe] = useState(false);
  const handleConnectStripeOwner = async () => {
    setConnectingStripe(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/stripe/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "Klaida");
      }
      const { url } = await r.json();
      if (!url) throw new Error("Negautas onboarding URL");
      window.location.href = url;
    } catch (err: any) {
      toast({ title: "Nepavyko prijungti Stripe", description: err?.message ?? "", variant: "destructive" });
      setConnectingStripe(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Valdymo skydelis</h1>
            <p className="text-muted-foreground mt-1">Tvarkykite savo aikšteles, trenerius ir turnyrus.</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {stripeConnectStatusQuery.data?.status === "active" ? (
              <Button variant="outline" disabled className="gap-2 border-green-500/40 text-green-500">
                <CheckCircle2 className="w-4 h-4" /> Stripe prijungtas
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleConnectStripeOwner}
                disabled={connectingStripe}
                className="gap-2 border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
              >
                <CreditCard className="w-4 h-4" />
                {connectingStripe
                  ? "Nukreipiama..."
                  : stripeConnectStatusQuery.data?.status === "pending"
                    ? "Tęsti Stripe registraciją"
                    : "Prijungti Stripe"}
              </Button>
            )}

            <Button
              variant={showInbox ? "default" : "outline"}
              onClick={() => setShowInbox(v => !v)}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Žinutės
            </Button>

          {activeOwnerTab === "courts" && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) { setEditingId(null); setMapKey(k => k + 1); }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingId(null);
                form.reset();
                setMapKey(k => k + 1);
              }}>
                <Plus className="w-4 h-4 mr-2" /> Pridėti aikštelę
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Redaguoti aikštelę" : "Pridėti naują aikštelę"}</DialogTitle>
              </DialogHeader>

              {/* Form section tabs */}
              <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none -mx-6 px-6 pb-0">
                {([
                  { id: "info", label: "Pagrindai" },
                  { id: "schedule", label: "Grafikas" },
                  { id: "amenities", label: "Patogumai" },
                  { id: "media", label: "Medija" },
                  { id: "contact", label: "Kontaktai" },
                ] as const).map(t => (
                  <button key={t.id} type="button" onClick={() => setFormTab(t.id)}
                    className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                      formTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >{t.label}</button>
                ))}
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

                  {/* ── TAB: PAGRINDAI ── */}
                  {formTab === "info" && (<div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tennis">🎾 Tenisas</SelectItem>
                            <SelectItem value="basketball">🏀 Krepšinis</SelectItem>
                            <SelectItem value="padel">🏓 Padelis</SelectItem>
                            <SelectItem value="football">⚽ Futbolas</SelectItem>
                            <SelectItem value="badminton">🏸 Badmintonas</SelectItem>
                            <SelectItem value="squash">🎯 Skvoše</SelectItem>
                            <SelectItem value="table_tennis">🏓 Stalo tenisas</SelectItem>
                            <SelectItem value="golf">⛳ Golfas</SelectItem>
                            <SelectItem value="snooker">🎱 Snukeris</SelectItem>
                            <SelectItem value="bowling">🎳 Boulingas</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Facility selector */}
                  <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Objektas (neprivaloma)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Jei ši aikštelė priklauso sporto centrui ar klubui, susiekite ją su objektu.</p>
                    <FormField control={form.control} name="facilityId" render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-wrap gap-2 items-center">
                          <button type="button"
                            onClick={() => field.onChange(undefined)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!field.value ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                          >Nėra objekto</button>
                          {facilities.map(f => (
                            <button key={f.id} type="button"
                              onClick={() => field.onChange(f.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${field.value === f.id ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                            >{f.name}</button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {!showNewFacilityInput ? (
                      <button type="button" onClick={() => setShowNewFacilityInput(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Sukurti naują objektą
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          placeholder="Objekto pavadinimas (pvz. Tennis Club)"
                          value={newFacilityName}
                          onChange={e => setNewFacilityName(e.target.value)}
                          className="text-sm h-8"
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newFacilityName.trim()) {
                                const id = await createFacility(newFacilityName.trim());
                                if (id) form.setValue("facilityId", id);
                                setNewFacilityName("");
                                setShowNewFacilityInput(false);
                              }
                            } else if (e.key === "Escape") {
                              setShowNewFacilityInput(false);
                            }
                          }}
                        />
                        <Button type="button" size="sm" className="h-8"
                          onClick={async () => {
                            if (newFacilityName.trim()) {
                              const id = await createFacility(newFacilityName.trim());
                              if (id) form.setValue("facilityId", id);
                              setNewFacilityName("");
                              setShowNewFacilityInput(false);
                            }
                          }}
                        >Sukurti</Button>
                        <button type="button" onClick={() => setShowNewFacilityInput(false)} className="text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aprašymas</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Trumpas aikštelės aprašymas..." {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <LocationPicker
                    key={mapKey}
                    latitude={Number(watchedLat) || 0}
                    longitude={Number(watchedLng) || 0}
                    onChange={(result: LocationPickerResult) => {
                      form.setValue("latitude", result.lat, { shouldValidate: true });
                      form.setValue("longitude", result.lng, { shouldValidate: true });
                      if (result.city) form.setValue("city", result.city, { shouldValidate: true });
                      if (result.address) form.setValue("address", result.address, { shouldValidate: true });
                      if (result.postcode != null) form.setValue("postcode", result.postcode, { shouldValidate: true });
                    }}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresas</FormLabel>
                        <FormControl><Input placeholder="Auto-užpildoma iš žemėlapio" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Miestas</FormLabel>
                        <FormControl><Input placeholder="Auto-užpildoma iš žemėlapio" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="postcode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pašto kodas</FormLabel>
                      <FormControl><Input placeholder="LT-XXXXX — auto-užpildoma iš paieškos" className="max-w-[180px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="latitude" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Platuma (auto)</FormLabel>
                        <FormControl><Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="longitude" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Ilguma (auto)</FormLabel>
                        <FormControl><Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  </div>)} {/* end info tab */}

                  {/* ── TAB: GRAFIKAS ── */}
                  {formTab === "schedule" && (<div className="space-y-5">

                    {/* Base price */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <Euro className="w-3.5 h-3.5 text-primary" />
                            Numatytoji kaina (€/val)
                          </FormLabel>
                          <FormControl><Input type="number" min={1} step={0.5} {...field} /></FormControl>
                          <p className="text-[11px] text-muted-foreground">Slotų numatytoji vertė</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bufferMinutes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <Clock3 className="w-3.5 h-3.5 text-blue-400" />
                            Buferis (min)
                          </FormLabel>
                          <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="0">Nėra</SelectItem>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Working hours per day */}
                    <div className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock3 className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Darbo laikas</span>
                      </div>
                      <div className="space-y-2">
                        {(["1","2","3","4","5","6","0"] as const).map(dayKey => {
                          const dayNames: Record<string, string> = {
                            "0": "Sekmadienis", "1": "Pirmadienis", "2": "Antradienis",
                            "3": "Trečiadienis", "4": "Ketvirtadienis", "5": "Penktadienis", "6": "Šeštadienis"
                          };
                          const dh = workingHoursState[dayKey] ?? { open: "08:00", close: "22:00", closed: false };
                          return (
                            <div key={dayKey} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                              <span className="w-28 text-sm font-medium shrink-0">{dayNames[dayKey]}</span>
                              <button type="button"
                                onClick={() => setWorkingHoursState(prev => ({
                                  ...prev,
                                  [dayKey]: { ...prev[dayKey], closed: !prev[dayKey]?.closed }
                                }))}
                                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 transition-colors ${
                                  dh.closed ? "bg-red-500/15 text-red-500 border border-red-500/30" : "bg-green-500/15 text-green-600 border border-green-500/30"
                                }`}
                              >{dh.closed ? "Uždaryta" : "Atidaryta"}</button>
                              {!dh.closed && (
                                <>
                                  <select
                                    className="text-xs border rounded px-1.5 py-1 bg-background"
                                    value={dh.open}
                                    onChange={e => setWorkingHoursState(prev => ({
                                      ...prev,
                                      [dayKey]: { ...prev[dayKey], open: e.target.value }
                                    }))}
                                  >
                                    {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-muted-foreground text-xs">–</span>
                                  <select
                                    className="text-xs border rounded px-1.5 py-1 bg-background"
                                    value={dh.close}
                                    onChange={e => setWorkingHoursState(prev => ({
                                      ...prev,
                                      [dayKey]: { ...prev[dayKey], close: e.target.value }
                                    }))}
                                  >
                                    {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                  </select>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>)} {/* end schedule tab */}

                  {/* ── TAB: MEDIJA ── */}
                  {formTab === "media" && (<div className="space-y-4">
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

                  {editingId && (
                    <CourtPhotosSection courtId={editingId} />
                  )}

                  {/* Ownership document upload — only shown for new courts */}
                  {!editingId && (
                    <div className="space-y-2">
                      <Label>Nuosavybės dokumentas</Label>
                      <p className="text-xs text-muted-foreground">
                        Įkelkite dokumentą, patvirtinantį, kad esate aikštelės savininkas (nuotrauka arba PDF). Administratorius peržiūrės ir patvirtins aikštelę.
                      </p>
                      <input
                        ref={docInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) handleDocUpload(e.target.files[0]); }}
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => docInputRef.current?.click()}
                          disabled={ownershipDocUploading}
                          className="gap-2"
                        >
                          {ownershipDocUploading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileUp className="w-4 h-4" />}
                          {ownershipDocUploading ? "Įkeliama..." : "Įkelti dokumentą"}
                        </Button>
                        {form.watch("ownershipDocUrl") && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            ✓ Dokumentas įkeltas
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  </div>)} {/* end media tab */}

                  {/* ── TAB: PATOGUMAI ── */}
                  {formTab === "amenities" && (<div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="maxPlayers" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maks. žaidėjai</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="isIndoor" render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-3 h-[62px]">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel>Vidaus aikštelė</FormLabel>
                        </div>
                      </FormItem>
                    )} />
                  </div>

                  {/* Smart Amenities */}
                  <div className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">Patogumai</span>
                    </div>
                    <FormField control={form.control} name="amenities" render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 gap-2">
                          {STANDARD_AMENITIES.map(({ id, label, icon: Icon }) => {
                            const checked = (field.value ?? []).includes(id);
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  const current = field.value ?? [];
                                  field.onChange(
                                    checked ? current.filter(a => a !== id) : [...current, id]
                                  );
                                }}
                                className={`flex items-center gap-2.5 p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                                  checked
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "bg-muted/30 border-border hover:border-primary/40"
                                }`}
                              >
                                <Icon className={`w-4 h-4 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                                {label}
                                {checked && amenityPhotos[id] && (
                                  <Images className="w-3 h-3 ml-auto shrink-0 text-primary/70" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />

                        {/* Amenity photo uploads — shown for each selected amenity */}
                        {(field.value ?? []).length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Images className="w-3.5 h-3.5" /> Nuotraukos patogumiams (neprivaloma)
                            </p>
                            {STANDARD_AMENITIES.filter(a => (field.value ?? []).includes(a.id)).map(({ id, label, icon: Icon }) => {
                              const photoUrl = amenityPhotos[id];
                              const isUploading = uploadingAmenity === id;
                              const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                              return (
                                <div key={id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
                                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                  <span className="text-xs font-medium flex-1 truncate">{label}</span>
                                  {photoUrl ? (
                                    <>
                                      <img
                                        src={`${base}/${photoUrl}`}
                                        alt={label}
                                        className="w-12 h-8 object-cover rounded border shrink-0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setAmenityPhotos(prev => { const n = { ...prev }; delete n[id]; return n; })}
                                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                        title="Pašalinti nuotrauką"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <label className="cursor-pointer shrink-0">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={isUploading}
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) handleAmenityPhotoUpload(id, file);
                                          e.target.value = "";
                                        }}
                                      />
                                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:text-primary"}`}>
                                        <Upload className="w-3 h-3" />
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

                  {/* Rentable Items */}
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
                            <span className="text-muted-foreground">{item.pricePerSlot}€ / laikot.</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{item.stock} vnt.</span>
                            <button
                              type="button"
                              onClick={() => setRentableItems(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Pavadinimas (pvz. Raketė)"
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="€/laikot."
                          value={newItemPrice}
                          onChange={e => setNewItemPrice(e.target.value)}
                          className="w-24"
                          min={0}
                          step={0.5}
                        />
                        <Input
                          type="number"
                          placeholder="Kiekis"
                          value={newItemStock}
                          onChange={e => setNewItemStock(e.target.value)}
                          className="w-20"
                          min={1}
                          step={1}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const price = parseFloat(newItemPrice);
                            const stock = parseInt(newItemStock, 10);
                            if (newItemName.trim() && !isNaN(price) && price >= 0 && !isNaN(stock) && stock >= 1) {
                              setRentableItems(prev => [...prev, { name: newItemName.trim(), pricePerSlot: price, stock }]);
                              setNewItemName("");
                              setNewItemPrice("");
                              setNewItemStock("");
                            }
                          }}
                          disabled={!newItemName.trim() || !newItemPrice || !newItemStock}
                          className="shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Pridėkite raketės, kamuolių ar kitos įrangos nuomą (kaina × laikotarpių skaičius)</p>
                    </div>
                  </div>

                  </div>)} {/* end amenities tab */}

                  {/* ── TAB: KONTAKTAI ── */}
                  {formTab === "contact" && (<div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="ownerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Savininko vardas</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="ownerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Savininko el. paštas</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Socialiniai tinklai</p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="socialFacebook" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#1877f2]"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.016 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.027 1.793-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.268h3.328l-.532 3.49h-2.796v8.437C19.612 23.089 24 18.097 24 12.073z"/></svg>
                            Facebook
                          </FormLabel>
                          <FormControl><Input placeholder="https://facebook.com/..." {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="socialInstagram" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5"><defs><radialGradient id="ig-g" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><path fill="url(#ig-g)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                            Instagram
                          </FormLabel>
                          <FormControl><Input placeholder="https://instagram.com/..." {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="socialWhatsapp" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25d366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                            WhatsApp
                          </FormLabel>
                          <FormControl><Input placeholder="https://wa.me/370..." {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="socialWebsite" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            Svetainė
                          </FormLabel>
                          <FormControl><Input placeholder="https://..." {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  </div>)} {/* end contact tab */}

                  {/* Always-visible submit + navigation */}
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
          )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(["courts", "trainers", "tournaments"] as const).map(tab => {
            const labels = { courts: "Aikštelės", trainers: "Treneriai", tournaments: "Turnyrai" };
            const icons = { courts: "🏟️", trainers: "💪", tournaments: "🏆" };
            return (
              <button
                key={tab}
                onClick={() => setActiveOwnerTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
                  activeOwnerTab === tab
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Owner Inbox */}
        {showInbox && user && (
          <OwnerInbox
            ownerUserId={user.id}
            ownerName={user.fullName ?? user.firstName ?? "Savininkas"}
            ownerEmail={user.primaryEmailAddress?.emailAddress ?? ""}
          />
        )}

        {/* Courts tab */}
        {activeOwnerTab === "courts" && (() => {
          // Group courts by facilityId
          const facilityGroups = new Map<string | null, typeof courts>();
          facilityGroups.set(null, []);
          facilities.forEach(f => facilityGroups.set(f.id.toString(), []));
          courts?.forEach(c => {
            const key = (c as any).facilityId != null ? String((c as any).facilityId) : null;
            if (!facilityGroups.has(key)) facilityGroups.set(key, []);
            facilityGroups.get(key)!.push(c);
          });

          type CourtItem = NonNullable<typeof courts>[0];
          const CourtRow = ({ court }: { court: CourtItem }) => (
            <TableRow key={court.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center flex-wrap gap-1">
                    {court.name}
                    <StatusBadge status={court.status} />
                  </div>
                  {court.status === "rejected" && court.rejectionReason && (
                    <div className="flex items-center gap-1 text-xs text-red-400 mt-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {court.rejectionReason}
                    </div>
                  )}
                  {(court.status === "pending" || court.status === "pending_review") && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Laukiama administratoriaus patvirtinimo
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="capitalize hidden md:table-cell">{court.type}</TableCell>
              <TableCell className="hidden md:table-cell">{court.city}</TableCell>
              <TableCell className="hidden sm:table-cell">{court.pricePerHour}€/val</TableCell>
              <TableCell className="hidden lg:table-cell">
                {(court as any).stripeConnectStatus === "active" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Aktyvus
                  </span>
                ) : (court as any).stripeConnectStatus === "pending" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                    <CreditCard className="w-3 h-3" /> Laukiama
                  </span>
                ) : (
                  <button
                    onClick={() => handleConnectStripe(court.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition-colors"
                  >
                    <CreditCard className="w-3 h-3" /> Prijungti
                  </button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex"
                    onClick={() => { setPricingCourtId(court.id); setPricingDefaultPrice(court.pricePerHour); }}>
                    <Euro className="w-3.5 h-3.5" /> Kainos
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex"
                    onClick={() => setBlockedSlotsCourtId(court.id)}>
                    <CalendarClock className="w-3.5 h-3.5" /> Blokai
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs hidden sm:flex"
                    onClick={() => setCoachesCourtId(court.id)}>
                    <Trophy className="w-3.5 h-3.5" /> Treneriai
                  </Button>
                  <Button variant="ghost" size="icon" title="QR kodas" onClick={() => setQrCourt({ id: court.id, name: court.name, type: court.type })}>
                    <QrCode className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(court)}>
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(court.id)} disabled={deleteCourt.isPending}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );

          const TableFrame = ({ children, facilityName }: { children: React.ReactNode; facilityName?: string }) => (
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm mb-4">
              {facilityName && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{facilityName}</span>
                </div>
              )}
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Pavadinimas</TableHead>
                    <TableHead className="hidden md:table-cell">Tipas</TableHead>
                    <TableHead className="hidden md:table-cell">Miestas</TableHead>
                    <TableHead className="hidden sm:table-cell">Kaina/val</TableHead>
                    <TableHead className="hidden lg:table-cell">Stripe</TableHead>
                    <TableHead className="text-right">Veiksmai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{children}</TableBody>
              </Table>
            </div>
          );

          if (isLoading) return (
            <TableFrame>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableFrame>
          );

          if (!courts || courts.length === 0) return (
            <TableFrame>
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {user?.id ? "Aikštelių nerasta. Sukurkite pirmąją aikštelę." : "Prisijunkite norėdami matyti savo aikšteles."}
                </TableCell>
              </TableRow>
            </TableFrame>
          );

          // Render facility groups (only non-empty ones)
          const groups: React.ReactNode[] = [];
          facilityGroups.forEach((groupCourts, facilityKey) => {
            if (!groupCourts || groupCourts.length === 0) return;
            const facilityName = facilityKey === null
              ? (facilities.length > 0 ? "Be objekto" : undefined)
              : facilities.find(f => String(f.id) === facilityKey)?.name;
            groups.push(
              <TableFrame key={facilityKey ?? "__none__"} facilityName={facilityName}>
                {groupCourts.map(c => <CourtRow key={c.id} court={c} />)}
              </TableFrame>
            );
          });
          return <>{groups}</>;
        })()}
        {activeOwnerTab === "courts" && null /* anchor */}

        {/* Trainers tab */}
        {activeOwnerTab === "trainers" && courts && (
          <OwnerTrainersSection courts={courts} ownerUserId={user?.id ?? ""} />
        )}

        {/* Tournaments tab */}
        {activeOwnerTab === "tournaments" && courts && (
          <OwnerTournamentsSection courts={courts} ownerUserId={user?.id ?? ""} />
        )}

        {/* Pricing Editor Dialog */}
        <Dialog open={pricingCourtId !== null} onOpenChange={(open) => { if (!open) setPricingCourtId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Euro className="w-5 h-5 text-primary" />
                Kainų redaktorius
              </DialogTitle>
            </DialogHeader>
            {pricingCourtId !== null && (
              <PricingEditor
                courtId={pricingCourtId}
                defaultPrice={pricingDefaultPrice}
                onClose={() => setPricingCourtId(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Blocked Slots Dialog */}
        <Dialog open={blockedSlotsCourtId !== null} onOpenChange={(open) => { if (!open) setBlockedSlotsCourtId(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" />
                Blokuoti laiko tarpai
              </DialogTitle>
            </DialogHeader>
            {blockedSlotsCourtId !== null && (
              <BlockedSlotsModal
                courtId={blockedSlotsCourtId}
                onClose={() => setBlockedSlotsCourtId(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Coaches Dialog */}
        <Dialog open={coachesCourtId !== null} onOpenChange={(open) => { if (!open) setCoachesCourtId(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Aikštelės treneriai
              </DialogTitle>
            </DialogHeader>
            {coachesCourtId !== null && (
              <CoachAssignModal
                courtId={coachesCourtId}
                onClose={() => setCoachesCourtId(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      {/* QR Code Modal */}
      {qrCourt && (() => {
        const courtUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/courts/${qrCourt.id}`;
        const sportEmojis: Record<string, string> = {
          tennis: "🎾", basketball: "🏀", padel: "🏓", football: "⚽",
          badminton: "🏸", squash: "🎯", table_tennis: "🏓", golf: "⛳", snooker: "🎱", bowling: "🎳",
        };
        const sportNames: Record<string, string> = {
          tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis", football: "Futbolas",
          badminton: "Badmintonas", squash: "Skvoše", table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
        };

        const handleDownload = () => {
          const svg = document.getElementById("court-qr-svg");
          if (!svg) return;
          const card = document.getElementById("court-qr-card");
          if (!card) return;
          const serializer = new XMLSerializer();
          const svgStr = serializer.serializeToString(svg);
          const img = new Image();
          const blob = new Blob([svgStr], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 400; canvas.height = 500;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 400, 500);
            ctx.fillStyle = "#09090b";
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(qrCourt.name, 200, 44);
            ctx.drawImage(img, 50, 60, 300, 300);
            ctx.fillStyle = "#84cc16";
            ctx.font = "bold 20px sans-serif";
            ctx.fillText("korts.lt", 200, 400);
            ctx.fillStyle = "#71717a";
            ctx.font = "13px sans-serif";
            ctx.fillText("Rezervuokite aikštelę online", 200, 424);
            ctx.fillText(courtUrl, 200, 446);
            URL.revokeObjectURL(url);
            const link = document.createElement("a");
            link.download = `qr-${qrCourt.name.toLowerCase().replace(/\s+/g, "-")}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
          };
          img.src = url;
        };

        const handlePrint = () => {
          const card = document.getElementById("court-qr-printable");
          if (!card) return;
          const win = window.open("", "_blank");
          if (!win) return;
          win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR — ${qrCourt.name}</title><style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; background: #fff; display: flex; justify-content: center; align-items: flex-start; padding: 32px; }
            .card { width: 360px; border: 2px solid #e4e4e7; border-radius: 20px; padding: 28px 24px 24px; text-align: center; background: #fff; }
            .logo { font-weight: 900; font-size: 28px; letter-spacing: -1px; color: #84cc16; margin-bottom: 2px; }
            .sport { font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
            .court-name { font-size: 20px; font-weight: 700; color: #09090b; margin-bottom: 20px; line-height: 1.2; }
            .qr-wrap { display: flex; justify-content: center; margin-bottom: 20px; }
            .headline { font-size: 15px; font-weight: 600; color: #09090b; margin-bottom: 4px; }
            .sub { font-size: 12px; color: #71717a; margin-bottom: 12px; }
            .url { font-size: 10px; color: #a1a1aa; word-break: break-all; background: #f4f4f5; border-radius: 8px; padding: 6px 10px; }
            .divider { height: 1px; background: #e4e4e7; margin: 18px 0; }
            .steps { text-align: left; font-size: 11px; color: #52525b; line-height: 1.8; }
          </style></head><body><div class="card">
            <div class="logo">korts.lt</div>
            <div class="sport">${sportEmojis[qrCourt.type] ?? ""} ${sportNames[qrCourt.type] ?? qrCourt.type}</div>
            <div class="court-name">${qrCourt.name}</div>
            <div class="qr-wrap">${document.getElementById("court-qr-svg")?.outerHTML ?? ""}</div>
            <div class="headline">Rezervuokite aikštelę internetu</div>
            <div class="sub">Nuskensuokite QR kodą telefonu</div>
            <div class="url">${courtUrl}</div>
            <div class="divider"></div>
            <div class="steps">1. Nuskensuokite QR kodą<br>2. Pasirinkite datą ir laiką<br>3. Apmokėkite saugiai online<br>4. Gaukite patvirtinimą iš karto</div>
          </div></body></html>`);
          win.document.close();
          setTimeout(() => { win.focus(); win.print(); }, 400);
        };

        return (
          <Dialog open={!!qrCourt} onOpenChange={(open) => { if (!open) setQrCourt(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  QR kodas rezervacijoms
                </DialogTitle>
              </DialogHeader>

              {/* Printable card */}
              <div id="court-qr-printable" className="flex flex-col items-center rounded-2xl border-2 border-border bg-white dark:bg-zinc-900 p-6 text-center">
                <div className="font-black text-2xl tracking-tight text-primary mb-0.5">korts.lt</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                  {sportEmojis[qrCourt.type] ?? ""} {sportNames[qrCourt.type] ?? qrCourt.type}
                </div>
                <div className="text-lg font-bold text-foreground mb-5 leading-tight">{qrCourt.name}</div>

                <div className="p-3 bg-white rounded-xl shadow-inner border mb-5">
                  <QRCodeSVG
                    id="court-qr-svg"
                    value={courtUrl}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#09090b"
                    level="H"
                    imageSettings={{
                      src: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/icons/tennis-ball.png`,
                      x: undefined,
                      y: undefined,
                      height: 32,
                      width: 32,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="text-sm font-semibold text-foreground mb-1">Rezervuokite aikštelę internetu</div>
                <div className="text-xs text-muted-foreground mb-3">Nuskensuokite QR kodą telefonu</div>

                <div className="w-full text-[10px] text-muted-foreground bg-muted rounded-lg px-3 py-2 break-all font-mono">
                  {courtUrl}
                </div>

                <div className="mt-4 w-full border-t pt-4 text-left space-y-1">
                  {["Nuskensuokite QR kodą", "Pasirinkite datą ir laiką", "Apmokėkite saugiai online", "Gaukite patvirtinimą iš karto"].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Spausdinti
                </Button>
                <Button className="flex-1 gap-2" onClick={handleDownload}>
                  <Download className="h-4 w-4" /> Atsisiųsti PNG
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      </div>
    </Layout>
  );
}
