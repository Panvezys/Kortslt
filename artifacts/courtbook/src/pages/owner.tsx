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
import { Plus, Edit2, Trash2, Euro, RotateCcw, CalendarClock, FileUp, AlertTriangle, Zap, Clock3, ShoppingBag, Lightbulb, ShowerHead, DoorOpen, Droplets, X } from "lucide-react";
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

  const createBlocked = useMutation({
    mutationFn: () =>
      customFetch(`/api/courts/${courtId}/blocked-slots`, {
        method: "POST",
        body: JSON.stringify({ date, startTime, endTime, reason: reason || undefined }),
      }),
    onSuccess: () => {
      toast({ title: "Laikas užblokuotas" });
      onClose();
    },
    onError: () => toast({ title: "Klaida užblokuojant laiką", variant: "destructive" }),
  });

  return null;
}
