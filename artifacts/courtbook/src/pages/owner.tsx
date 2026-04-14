import { useState, useEffect, useRef } from "react";
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
import { Plus, Edit2, Trash2, Euro, RotateCcw, CalendarClock, FileUp, AlertTriangle, Zap, Clock3, ShoppingBag, Lightbulb, ShowerHead, DoorOpen, Droplets, X, Trophy, UserPlus, UserMinus, MessageSquare, Send, ArrowLeft, ChevronRight } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationPicker, type LocationPickerResult } from "@/components/location-picker";
import { CourtImageUpload } from "@/components/court-image-upload";

const STANDARD_AMENITIES = [
  { id: "floodlights",     label: "Prožektoriai",       icon: Lightbulb },
  { id: "showers",         label: "Dušai",              icon: ShowerHead },
  { id: "changing_rooms",  label: "Persirengimo kambariai", icon: DoorOpen },
  { id: "water_station",   label: "Vandens stotis",     icon: Droplets },
] as const;

interface RentableItem {
  name: string;
  pricePerBooking: number;
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
  type: z.enum(["tennis", "basketball", "padel", "football", "badminton", "squash"]),
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
});

type CourtFormValues = z.infer<typeof courtSchema>;

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "approved") return null;
  if (status === "pending")
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
};

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

export default function OwnerDashboard() {
  const { user } = useUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [pricingCourtId, setPricingCourtId] = useState<number | null>(null);
  const [pricingDefaultPrice, setPricingDefaultPrice] = useState(20);
  const [blockedSlotsCourtId, setBlockedSlotsCourtId] = useState<number | null>(null);
  const [coachesCourtId, setCoachesCourtId] = useState<number | null>(null);
  const [ownershipDocUploading, setOwnershipDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [rentableItems, setRentableItems] = useState<RentableItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [showInbox, setShowInbox] = useState(false);

  const { data: courts, isLoading } = useListCourts(
    user?.id ? { ownerUserId: user.id } : undefined
  );
  const createCourt = useCreateCourt();
  const updateCourt = useUpdateCourt();
  const deleteCourt = useDeleteCourt();

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    }
  });

  const watchedLat = form.watch("latitude") ?? 0;
  const watchedLng = form.watch("longitude") ?? 0;

  const onSubmit = async (data: CourtFormValues) => {
    try {
      const rentableItemsJson = rentableItems.length > 0 ? JSON.stringify(rentableItems) : undefined;
      const payload = { ...data, rentableItems: rentableItemsJson };
      if (editingId) {
        await updateCourt.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Kortas atnaujintas" });
      } else {
        await createCourt.mutateAsync({ data: payload });
        toast({ title: "Kortas sukurtas — laukia patvirtinimo" });
      }
      setIsDialogOpen(false);
      setRentableItems([]);
      queryClient.invalidateQueries({ queryKey: getListCourtsQueryKey() });
    } catch {
      toast({ title: "Klaida išsaugant kortą", variant: "destructive" });
    }
  };

  const handleEdit = (court: any) => {
    setEditingId(court.id);
    setMapKey(k => k + 1);
    form.reset({
      name: court.name,
      type: court.type as "tennis" | "basketball" | "padel" | "football" | "badminton" | "squash",
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
    });
    try {
      setRentableItems(court.rentableItems ? JSON.parse(court.rentableItems) : []);
    } catch {
      setRentableItems([]);
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

  const handleDelete = async (id: number) => {
    if (!confirm("Ar tikrai norite ištrinti šį kortą?")) return;
    try {
      await deleteCourt.mutateAsync({ id });
      toast({ title: "Court deleted" });
      queryClient.invalidateQueries({ queryKey: getListCourtsQueryKey() });
    } catch {
      toast({ title: "Error deleting court", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Valdymo skydelis</h1>
            <p className="text-muted-foreground mt-1">Tvarkykite savo kortus ir kainas.</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={showInbox ? "default" : "outline"}
              onClick={() => setShowInbox(v => !v)}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Žinutės
            </Button>

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
                <Plus className="w-4 h-4 mr-2" /> Pridėti kortą
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Redaguoti kortą" : "Pridėti naują kortą"}</DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Korto pavadinimas</FormLabel>
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
                            <SelectItem value="squash">🎯 Squash</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

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

                  {/* Pricing */}
                  <div className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Euro className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">Kainos</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="pricePerHour" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Off-Peak kaina (€/val)</FormLabel>
                          <FormControl><Input type="number" min={1} step={0.5} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="peakPricePerHour" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            Peak kaina (€/val)
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={0.5}
                              placeholder="Neprivaloma"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                            />
                          </FormControl>
                          <p className="text-[11px] text-muted-foreground">Pir–Pen 17:00–22:00</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="bufferMinutes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <Clock3 className="w-3.5 h-3.5 text-blue-400" />
                            Buferis (min)
                          </FormLabel>
                          <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Nėra</SelectItem>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">Laikas tarp rezervacijų</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="maxPlayers" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maks. žaidėjai</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Korto nuotrauka</FormLabel>
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

                  {/* Ownership document upload — only shown for new courts */}
                  {!editingId && (
                    <div className="space-y-2">
                      <Label>Nuosavybės dokumentas</Label>
                      <p className="text-xs text-muted-foreground">
                        Įkelkite dokumentą, patvirtinantį, kad esate korto savininkas (nuotrauka arba PDF). Administratorius peržiūrės ir patvirtins kortą.
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
                          <FileUp className="w-4 h-4" />
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

                  <FormField control={form.control} name="isIndoor" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Patalpų kortas</FormLabel>
                      </div>
                    </FormItem>
                  )} />

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
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
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
                            <span className="text-muted-foreground">{item.pricePerBooking}€ / rezerv.</span>
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
                          placeholder="€"
                          value={newItemPrice}
                          onChange={e => setNewItemPrice(e.target.value)}
                          className="w-20"
                          min={0}
                          step={0.5}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const price = parseFloat(newItemPrice);
                            if (newItemName.trim() && !isNaN(price) && price >= 0) {
                              setRentableItems(prev => [...prev, { name: newItemName.trim(), pricePerBooking: price }]);
                              setNewItemName("");
                              setNewItemPrice("");
                            }
                          }}
                          disabled={!newItemName.trim() || !newItemPrice}
                          className="shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Pridėkite raketės, kamuolių ar kitos įrangos nuomą</p>
                    </div>
                  </div>

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

                  <Button type="submit" className="w-full mt-6" disabled={createCourt.isPending || updateCourt.isPending}>
                    {editingId ? "Išsaugoti pakeitimus" : "Sukurti kortą"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Owner Inbox */}
        {showInbox && user && (
          <OwnerInbox
            ownerUserId={user.id}
            ownerName={user.fullName ?? user.firstName ?? "Savininkas"}
            ownerEmail={user.primaryEmailAddress?.emailAddress ?? ""}
          />
        )}

        {/* Courts table */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Pavadinimas</TableHead>
                <TableHead className="hidden md:table-cell">Tipas</TableHead>
                <TableHead className="hidden md:table-cell">Miestas</TableHead>
                <TableHead className="hidden sm:table-cell">Kaina/val</TableHead>
                <TableHead className="text-right">Veiksmai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : courts && courts.length > 0 ? (
                courts.map((court) => (
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
                        {court.status === "pending" && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Laukiama administratoriaus patvirtinimo
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize hidden md:table-cell">{court.type}</TableCell>
                    <TableCell className="hidden md:table-cell">{court.city}</TableCell>
                    <TableCell className="hidden sm:table-cell">{court.pricePerHour}€/val</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs hidden sm:flex"
                          onClick={() => {
                            setPricingCourtId(court.id);
                            setPricingDefaultPrice(court.pricePerHour);
                          }}
                        >
                          <Euro className="w-3.5 h-3.5" /> Kainos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs hidden sm:flex"
                          onClick={() => setBlockedSlotsCourtId(court.id)}
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Blokai
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs hidden sm:flex"
                          onClick={() => setCoachesCourtId(court.id)}
                        >
                          <Trophy className="w-3.5 h-3.5" /> Treneriai
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    {user?.id ? "Kortų nerasta. Sukurkite pirmąjį kortą." : "Prisijunkite norėdami matyti savo kortus."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

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
                Korto treneriai
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
      </div>
    </Layout>
  );
}
