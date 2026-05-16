import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerLayout } from "@/components/owner-layout";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const HOLIDAY_DOW = -1;

const DAYS = [
  { label: "Pr", dayOfWeek: 1 },
  { label: "An", dayOfWeek: 2 },
  { label: "Tr", dayOfWeek: 3 },
  { label: "Ke", dayOfWeek: 4 },
  { label: "Pe", dayOfWeek: 5 },
  { label: "Še", dayOfWeek: 6 },
  { label: "Se", dayOfWeek: 0 },
  { label: "Šv.", dayOfWeek: HOLIDAY_DOW },
];

function generateTimes(): string[] {
  const times: string[] = [];
  for (let h = 6; h < 23; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

const TIMES = generateTimes(); // 06:00 … 22:30

type PricingEntry = { dayOfWeek: number; startTime: string; price: number };
type PricingRule  = { id?: number; type: string; startTime: string | null; price: number };
type WHDay = { open: string; close: string; closed: boolean };
type WorkingHours = Record<string, WHDay>; // key = "0"–"6"

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellKey(dayOfWeek: number, time: string) {
  return `${dayOfWeek}:${time}`;
}

function parseCellKey(k: string): { dayOfWeek: number; time: string } {
  const idx = k.indexOf(":");
  return { dayOfWeek: Number(k.slice(0, idx)), time: k.slice(idx + 1) };
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isSlotOpen(wh: WorkingHours | null, dayOfWeek: number, slotTime: string): boolean {
  // holiday column and "no config" are always editable
  if (!wh || dayOfWeek === HOLIDAY_DOW) return true;
  const cfg = wh[String(dayOfWeek)];
  if (!cfg) return true;
  if (cfg.closed) return false;
  const slotMin = toMin(slotTime);
  return slotMin >= toMin(cfg.open ?? "07:00") && slotMin < toMin(cfg.close ?? "22:00");
}

function fmtPrice(n: number): string {
  const fixed = n.toFixed(2);
  return fixed.endsWith(".00") ? String(Math.round(n)) : fixed;
}

function priceColor(price: number, base: number, isHolidayDefault = false): string {
  if (isHolidayDefault) return "bg-violet-500/10 hover:bg-violet-500/15";
  if (price === base)   return "bg-muted/60 hover:bg-muted";
  if (price < base)     return "bg-emerald-500/20 hover:bg-emerald-500/30";
  if (price <= base * 1.3) return "bg-amber-400/25 hover:bg-amber-400/35";
  return "bg-rose-500/25 hover:bg-rose-500/35";
}

function priceTextColor(price: number, base: number): string {
  if (price === base)      return "text-muted-foreground";
  if (price < base)        return "text-emerald-600";
  if (price <= base * 1.3) return "text-amber-600";
  return "text-rose-600";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CourtPricingPage() {
  const { facilityId, courtId } = useParams<{ facilityId: string; courtId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [entries,    setEntries]    = useState<Map<string, number>>(new Map());
  const [basePrice,  setBasePrice]  = useState(10);
  const [basePriceInput, setBasePriceInput] = useState("");

  const [dragStart,   setDragStart]   = useState<{ d: number; t: number } | null>(null);
  const [dragEnd,     setDragEnd]     = useState<{ d: number; t: number } | null>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const [editPrice, setEditPrice] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: courtData } = useQuery({
    queryKey: ["owner-court-pricing-info", courtId],
    queryFn: async () => {
      const d = await customFetch<{ court: { id: number; name: string; pricePerHour: number; facilityId: number | null } }>(
        `${API_URL}/owner/courts/${courtId}/stats`
      );
      return d.court;
    },
    enabled: !!courtId,
  });

  // Public court endpoint includes workingHours
  const { data: courtDetail } = useQuery({
    queryKey: ["court-detail-wh", courtId],
    queryFn: () => customFetch<{ workingHours?: string | null }>(`${API_URL}/courts/${courtId}`),
    enabled: !!courtId,
    staleTime: 60_000,
  });

  const workingHours: WorkingHours | null = (() => {
    if (!courtDetail?.workingHours) return null;
    try { return JSON.parse(courtDetail.workingHours) as WorkingHours; }
    catch { return null; }
  })();

  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["court-pricing", courtId],
    queryFn: () => customFetch<{ courtId: number; entries: PricingEntry[] }>(`${API_URL}/courts/${courtId}/pricing`),
    enabled: !!courtId,
  });

  const { data: rulesData } = useQuery({
    queryKey: ["court-pricing-rules", courtId],
    queryFn: () => customFetch<PricingRule[]>(`${API_URL}/courts/${courtId}/pricing-rules`),
    enabled: !!courtId,
  });

  // ── Sync fetched data ─────────────────────────────────────────────────────

  useEffect(() => {
    if (courtData) {
      const perSlot = Number(courtData.pricePerHour) / 2;
      setBasePrice(perSlot);
      setBasePriceInput(String(Number(courtData.pricePerHour)));
    }
  }, [courtData]);

  useEffect(() => {
    if (!pricingData) return;
    setEntries(prev => {
      const next = new Map<string, number>();
      for (const [k, v] of prev) {
        if (parseCellKey(k).dayOfWeek === HOLIDAY_DOW) next.set(k, v);
      }
      for (const e of pricingData.entries) {
        next.set(cellKey(e.dayOfWeek, e.startTime), e.price);
      }
      return next;
    });
  }, [pricingData]);

  useEffect(() => {
    if (!rulesData) return;
    setEntries(prev => {
      const next = new Map(prev);
      for (const k of [...next.keys()]) {
        if (parseCellKey(k).dayOfWeek === HOLIDAY_DOW) next.delete(k);
      }
      for (const r of rulesData) {
        if (r.type === "holiday" && r.startTime) {
          next.set(cellKey(HOLIDAY_DOW, r.startTime), r.price);
        }
      }
      return next;
    });
  }, [rulesData]);

  // ── Selection (closed cells excluded) ────────────────────────────────────

  const selectedCells = useCallback((): Set<string> => {
    const s = new Set<string>();
    if (!dragStart) return s;
    const end = dragEnd ?? dragStart;
    const dMin = Math.min(dragStart.d, end.d);
    const dMax = Math.max(dragStart.d, end.d);
    const tMin = Math.min(dragStart.t, end.t);
    const tMax = Math.max(dragStart.t, end.t);
    for (let d = dMin; d <= dMax; d++) {
      for (let t = tMin; t <= tMax; t++) {
        const dow  = DAYS[d].dayOfWeek;
        const time = TIMES[t];
        // skip closed slots — they are masked and must not be selected
        if (!isSlotOpen(workingHours, dow, time)) continue;
        s.add(cellKey(dow, time));
      }
    }
    return s;
  }, [dragStart, dragEnd, workingHours]);

  const sel      = selectedCells();
  const selCount = sel.size;

  // ── Mouse handlers ────────────────────────────────────────────────────────

  function handleCellMouseDown(dIdx: number, tIdx: number, e: React.MouseEvent) {
    e.preventDefault();
    setDragStart({ d: dIdx, t: tIdx });
    setDragEnd({ d: dIdx, t: tIdx });
    setIsDragging(true);
  }

  function handleCellMouseEnter(dIdx: number, tIdx: number) {
    if (!isDragging) return;
    setDragEnd({ d: dIdx, t: tIdx });
  }

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ── Apply / clear / reset ─────────────────────────────────────────────────

  function applyPrice() {
    const p = parseFloat(editPrice.replace(",", "."));
    if (isNaN(p) || p < 0) {
      toast({ title: "Netinkama kaina", description: "Įveskite teigiamą skaičių.", variant: "destructive" });
      return;
    }
    setEntries(prev => {
      const next = new Map(prev);
      for (const key of sel) {
        if (p === basePrice && parseCellKey(key).dayOfWeek !== HOLIDAY_DOW) {
          next.delete(key);
        } else {
          next.set(key, p);
        }
      }
      return next;
    });
    setDragStart(null); setDragEnd(null); setEditPrice("");
  }

  function clearSelection() {
    setDragStart(null); setDragEnd(null); setEditPrice("");
  }

  function resetSelection() {
    setEntries(prev => {
      const next = new Map(prev);
      for (const key of sel) next.delete(key);
      return next;
    });
    clearSelection();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const gridEntries: PricingEntry[] = [];
      const holidayRules: Array<{ type: string; startTime: string; price: number }> = [];
      for (const [key, price] of entries) {
        const { dayOfWeek, time } = parseCellKey(key);
        if (dayOfWeek === HOLIDAY_DOW) {
          holidayRules.push({ type: "holiday", startTime: time, price });
        } else {
          gridEntries.push({ dayOfWeek, startTime: time, price });
        }
      }

      const newPricePerHour = parseFloat(basePriceInput.replace(",", "."));
      const calls: Promise<unknown>[] = [
        customFetch(`${API_URL}/courts/${courtId}/pricing`, {
          method: "PUT",
          body: JSON.stringify({ entries: gridEntries }),
          headers: { "Content-Type": "application/json" },
        }),
        customFetch(`${API_URL}/courts/${courtId}/pricing-rules`, {
          method: "PUT",
          body: JSON.stringify({ rules: holidayRules }),
          headers: { "Content-Type": "application/json" },
        }),
      ];
      if (!isNaN(newPricePerHour) && newPricePerHour >= 1) {
        calls.push(
          customFetch(`${API_URL}/courts/${courtId}/base-price`, {
            method: "PUT",
            body: JSON.stringify({ pricePerHour: newPricePerHour }),
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-pricing", courtId] });
      queryClient.invalidateQueries({ queryKey: ["court-pricing-rules", courtId] });
      queryClient.invalidateQueries({ queryKey: ["owner-court-pricing-info", courtId] });
      toast({ title: "Kainos išsaugotos" });
    },
    onError: () => toast({ title: "Klaida saugant kainas", variant: "destructive" }),
  });

  const facilityIdNum = Number(facilityId) || courtData?.facilityId || undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <OwnerLayout facilityId={facilityIdNum} facilityName={undefined} title="Kainodara">
      <div className="flex flex-col min-h-0">

        <header className="bg-card border-b border-border px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-bold text-base leading-tight">
            {courtData?.name ?? "Aikštelė"} — Kainodara
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Numatytoji kaina (€/val)</Label>
              <div className="relative">
                <Input
                  type="number" min="1" step="0.5"
                  value={basePriceInput}
                  onChange={e => {
                    setBasePriceInput(e.target.value);
                    const v = parseFloat(e.target.value.replace(",", "."));
                    if (!isNaN(v) && v >= 1) setBasePrice(v / 2);
                  }}
                  className="w-24 pr-8 h-8 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">€</span>
              </div>
            </div>
            <Button
              size="sm" className="h-8 text-xs"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saugoma…" : "Išsaugoti"}
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-4">

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs items-center text-muted-foreground">
            <span className="font-medium text-foreground">Spalvos:</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-muted/60 border border-border" /> Numatytoji
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> Pigesnė
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-amber-400/25 border border-amber-400/40" /> Brangesnė (iki +30%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-rose-500/25 border border-rose-500/30" /> Piko kaina (&gt;+30%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-violet-500/10 border border-violet-500/20" /> Šventė
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded border border-border opacity-60"
                style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(120,120,120,0.18) 2px,rgba(120,120,120,0.18) 4px)" }}
              /> Nedirba
            </span>
          </div>

          {/* Selection action bar */}
          {selCount > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">
                Pasirinkta: <span className="text-primary">{selCount}</span>{" "}
                {selCount === 1 ? "laikas" : "laikai"}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative">
                  <Input
                    type="number" min="0" step="0.5"
                    placeholder={`pvz. ${fmtPrice(basePrice)}`}
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    className="w-32 pr-8 text-sm h-8"
                    onKeyDown={e => e.key === "Enter" && applyPrice()}
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">/ 30 min</span>
                <Button size="sm" className="h-8 text-xs" onClick={applyPrice}>Taikyti</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetSelection}>Išvalyti</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clearSelection}>Atšaukti</Button>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-[580px] overflow-y-hidden hover:overflow-y-auto">
              {pricingLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  Kraunama…
                </div>
              ) : (
                <div
                  ref={gridRef}
                  className="select-none"
                  style={{ display: "grid", gridTemplateColumns: "3.5rem repeat(8, minmax(0, 1fr))" }}
                  onMouseLeave={() => { if (isDragging) setIsDragging(false); }}
                >
                  {/* Column headers */}
                  <div className="sticky top-0 z-10 bg-card border-b border-r border-border" />
                  {DAYS.map((day, dIdx) => {
                    const isHol = day.dayOfWeek === HOLIDAY_DOW;
                    // check whether this entire day is closed
                    const dayClosed = !isHol && workingHours?.[String(day.dayOfWeek)]?.closed === true;
                    return (
                      <div
                        key={dIdx}
                        className={`sticky top-0 z-10 border-b border-border text-center py-2 text-xs font-semibold ${
                          isHol
                            ? "bg-violet-500/10 text-violet-600 border-l-2 border-l-violet-500/30"
                            : dayClosed
                            ? "bg-muted/40 text-muted-foreground/50"
                            : "bg-card text-muted-foreground"
                        }`}
                      >
                        {day.label}
                      </div>
                    );
                  })}

                  {/* Time rows */}
                  {TIMES.map((time, tIdx) => {
                    const isHourMark = time.endsWith(":00");
                    return [
                      /* Time label */
                      <div
                        key={`lbl-${time}`}
                        className={`sticky left-0 z-10 bg-card border-r border-border flex items-center justify-end pr-2 text-[10px] text-muted-foreground tabular-nums ${isHourMark ? "border-t border-border" : ""}`}
                        style={{ height: 28 }}
                      >
                        {isHourMark ? time : ""}
                      </div>,

                      /* Day cells */
                      ...DAYS.map((day, dIdx) => {
                        const isHol    = day.dayOfWeek === HOLIDAY_DOW;
                        const open     = isSlotOpen(workingHours, day.dayOfWeek, time);
                        const key      = cellKey(day.dayOfWeek, time);
                        const hasCustom = entries.has(key);
                        const price    = entries.get(key) ?? basePrice;
                        const isSelected = sel.has(key);

                        if (!open) {
                          // Closed / outside working hours — masked, non-interactive
                          return (
                            <div
                              key={`${dIdx}-${time}`}
                              className={`border-b border-border ${isHourMark ? "border-t border-border" : ""} ${dIdx === 0 ? "" : isHol ? "border-l-2 border-l-violet-500/30" : "border-l border-border"}`}
                              style={{
                                height: 28,
                                pointerEvents: "none",
                                backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(120,120,120,0.1) 3px,rgba(120,120,120,0.1) 6px)",
                              }}
                            />
                          );
                        }

                        const bgClass = isSelected
                          ? "bg-primary/20 hover:bg-primary/25"
                          : priceColor(price, basePrice, isHol && !hasCustom);
                        const textClass = isSelected
                          ? "text-primary font-semibold"
                          : priceTextColor(price, basePrice);

                        return (
                          <div
                            key={`${dIdx}-${time}`}
                            className={`cursor-pointer transition-colors border-b border-border ${isHourMark ? "border-t border-border" : ""} ${dIdx === 0 ? "" : isHol ? "border-l-2 border-l-violet-500/30" : "border-l border-border"} ${bgClass}`}
                            style={{ height: 28 }}
                            onMouseDown={e => handleCellMouseDown(dIdx, tIdx, e)}
                            onMouseEnter={() => handleCellMouseEnter(dIdx, tIdx)}
                          >
                            <div className={`flex items-center justify-center h-full text-[10px] tabular-nums leading-none ${textClass}`}>
                              {fmtPrice(price)}
                            </div>
                          </div>
                        );
                      }),
                    ];
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Spustelkite ir vilkite, kad pasirinktumėte laikus. Stulpelis <strong>Šv.</strong> taikomas
            Lietuvos valstybinių švenčių dienomis.
            Pilkos juostelės — ne darbo laikas.
          </p>

        </div>
      </div>
    </OwnerLayout>
  );
}
