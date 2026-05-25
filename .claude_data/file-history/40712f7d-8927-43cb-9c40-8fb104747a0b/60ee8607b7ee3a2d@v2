import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, CalendarOff, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { useViewAsCoach, withCoachViewAs } from "@/lib/view-as-coach";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface BlockedSlot {
  id: number;
  startTime: string; // ISO
  endTime: string;
  reason: string | null;
}

interface BlockForm {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

const EMPTY_BLOCK: BlockForm = { date: "", startTime: "09:00", endTime: "12:00", reason: "" };

function formatHM(d: Date): string {
  return d.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
}

function BlockedSlotRow({
  block,
  onDelete,
  disabled,
}: {
  block: BlockedSlot;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const start = new Date(block.startTime);
  const end = new Date(block.endTime);
  const dateLabel = start.toLocaleDateString("lt-LT", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const timeLabel = `${formatHM(start)} – ${formatHM(end)}`;
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <CalendarOff className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{dateLabel}</div>
        <div className="text-xs text-muted-foreground truncate">
          {timeLabel}
          {block.reason ? ` · ${block.reason}` : ""}
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Pašalinti bloką"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  );
}

export function CoachBlockedSlots() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<BlockForm>(EMPTY_BLOCK);

  const { asCoachId } = useViewAsCoach();
  const isViewingAs = asCoachId != null;
  const { data: blocks = [], isLoading } = useQuery<BlockedSlot[]>({
    queryKey: ["coach-blocked-slots", asCoachId],
    queryFn: () => customFetch<BlockedSlot[]>(withCoachViewAs(`${API}/coaches/me/blocked-slots`)),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.date) throw new Error("Pasirinkite datą.");
      if (form.startTime >= form.endTime) {
        throw new Error("Pabaigos laikas turi būti vėlesnis už pradžią.");
      }
      const start = new Date(`${form.date}T${form.startTime}:00`);
      const end = new Date(`${form.date}T${form.endTime}:00`);
      return customFetch(`${API}/coaches/me/blocked-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          reason: form.reason || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Blokas pridėtas" });
      setForm(EMPTY_BLOCK);
      qc.invalidateQueries({ queryKey: ["coach-blocked-slots"] });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API}/coaches/me/blocked-slots/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Blokas pašalintas" });
      qc.invalidateQueries({ queryKey: ["coach-blocked-slots"] });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [blocks],
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Blokai ir atostogos</h2>
        <p className="text-xs text-muted-foreground">
          Vienkartiniai laikai, kuriais nesate prieinami — atostogos, varžybos, asmeniniai reikalai.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="block-date">Data</Label>
            <Input
              id="block-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-start">Nuo</Label>
            <Input
              id="block-start"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-end">Iki</Label>
            <Input
              id="block-end"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="block-reason">Priežastis (neprivaloma)</Label>
          <Textarea
            id="block-reason"
            rows={2}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Atostogos, varžybos..."
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.date || isViewingAs}
            size="sm"
            title={isViewingAs ? "Žiūrite kaip kitas treneris — keisti negalima" : undefined}
          >
            <Plus className="h-4 w-4 mr-1" />
            Pridėti bloką
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : sortedBlocks.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CalendarOff className="h-8 w-8 opacity-30" />
            Šiuo metu suplanuotų blokų nėra.
          </div>
        ) : (
          <ul className="divide-y">
            {sortedBlocks.map((b) => (
              <BlockedSlotRow
                key={b.id}
                block={b}
                onDelete={() => remove.mutate(b.id)}
                disabled={remove.isPending || isViewingAs}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
