import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import {
  useListCourts, useCreateCourt, useUpdateCourt, useDeleteCourt, getListCourtsQueryKey,
  useGetCourtPricing, useSetCourtPricing, customFetch,
} from "@workspace/api-client-react";
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
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
          <span className="text-sm font-semibold">{DAYS[selectedDay]}</span>
          <button type="button" onClick={() => resetDay(selectedDay)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
              <div key={startTime} className={`bg-card p-2 flex flex-col items-center gap-0.5 cursor-pointer hover:bg-primary/5 transition-colors ${isEditing ? "bg-primary/10 ring-1 ring-primary" : ""}`} onClick={() => !isEditing && startEdit(selectedDay, startTime)}>
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
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={sending}
          className="min-h-[40px] max-h-32 resize-none flex-1"
          rows={1}
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="Siųsti"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
