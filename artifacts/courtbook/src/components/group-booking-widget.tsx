import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay } from "date-fns";
import { lt as ltLocale } from "date-fns/locale";
import { useUser, useClerk } from "@clerk/react";
import { Loader2, CalendarDays, Users, RotateCcw, AlertCircle, CheckCircle2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateCalendar } from "@/components/ui/date-calendar";
import { WaitlistModal } from "@/components/waitlist-modal";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupCourt { id: number; name: string; surface: string | null; }
interface GroupSlot  { startTime: string; endTime: string; isAvailable: boolean; price: number; }
interface GroupAvailabilityResponse { facilityId: number; sport: string; date: string; slots: GroupSlot[]; courts: GroupCourt[]; }
interface BookGroupResponse { id: number; courtId: number; date: string; startTime: string; endTime: string; totalPrice: number; status: string; managementToken?: string; }
interface BookingResponse   { id: number; courtId: number; date: string; startTime: string; endTime: string; totalPrice: string | number; status: string; managementToken?: string; }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API  = `${BASE}/api`;

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtPrice(p: number) { return p % 1 === 0 ? p.toFixed(0) : p.toFixed(2); }

function fmtDuration(s: string, e: string) {
  const mins = toMin(e) - toMin(s);
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} val` : h > 0 ? `${h} val ${m} min` : `${mins} min`;
}

async function fetchGroupAvailability(facilityId: number, sport: string, date: string): Promise<GroupAvailabilityResponse> {
  return customFetch<GroupAvailabilityResponse>(`/api/search/groups/${facilityId}/${sport}/availability?date=${date}`, { responseType: "json" });
}

async function goToCheckout(booking: BookingResponse | BookGroupResponse, facilityId: number, sport: string) {
  const mgmt   = booking.managementToken ?? null;
  const isGuest = !!mgmt;
  const origin  = window.location.origin;
  const total   = Number(booking.totalPrice ?? 0);
  const ok  = isGuest ? `${origin}${BASE}/guest/booking/${mgmt}?paid=1`     : `${origin}${BASE}/booking-confirmed?id=${booking.id}`;
  const cancel = `${origin}${BASE}/facility/${facilityId}?sport=${sport}`;
  if (total > 0) {
    const r = await fetch(`${API}/payments/create-checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, ...(isGuest ? { managementToken: mgmt } : {}), successUrl: ok, cancelUrl: cancel }) });
    if (!r.ok) throw new Error("Checkout session failed");
    const { url } = await r.json();
    sessionStorage.setItem("stripeCancel_pending", JSON.stringify({ bookingId: booking.id, facilityId, ts: Date.now(), ...(isGuest ? { managementToken: mgmt } : {}) }));
    window.location.href = url;
  } else {
    const r = await fetch(`${API}/payments/confirm-free`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, ...(isGuest ? { managementToken: mgmt } : {}) }) });
    if (!r.ok) throw new Error("Free confirm failed");
    window.location.href = isGuest ? `${origin}${BASE}/guest/booking/${mgmt}` : `${origin}${BASE}/booking-confirmed?id=${booking.id}`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  facilityId: number;
  sport: string;
  /** Controlled: which court is pre-selected ("auto" = wear-balancing). */
  selectedCourtId: string;
  onCourtIdChange: (id: string) => void;
}

export function GroupBookingWidget({ facilityId, sport, selectedCourtId, onCourtIdChange }: Props) {
  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);
  const [date,          setDate]          = useState<Date>(today);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd,   setSelectedEnd]   = useState<number | null>(null);
  const [calendarOpen,  setCalendarOpen]  = useState(false);
  const [isBooking,     setIsBooking]     = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName,     setGuestName]     = useState("");
  const [guestEmail,    setGuestEmail]    = useState("");

  // Waitlist
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<{ startTime: string; endTime: string; courtId: number } | null>(null);

  // Recurring
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringWeeks,   setRecurringWeeks]   = useState(4);
  const [weekStatuses,     setWeekStatuses]     = useState<(boolean | null)[]>([]);
  const [recurringPending, setRecurringPending] = useState(false);

  // Split payment
  const [splitEnabled,   setSplitEnabled]   = useState(false);
  const [splitCount,     setSplitCount]     = useState(4);
  const [splitMatchType, setSplitMatchType] = useState<"casual" | "competitive">("casual");
  const [isPublicMatch,  setIsPublicMatch]  = useState(false);
  const [splitMinSkill,  setSplitMinSkill]  = useState(1.0);
  const [splitMaxSkill,  setSplitMaxSkill]  = useState(7.0);
  const [splitPending,   setSplitPending]   = useState(false);

  const { isSignedIn, user } = useUser();
  const { openSignIn }       = useClerk();
  const { toast }            = useToast();
  const stripRef             = useRef<HTMLDivElement>(null);

  const dateStr = format(date, "yyyy-MM-dd");
  const nowStr  = new Date().toTimeString().slice(0, 5);

  // Reset on date/context change
  useEffect(() => { setSelectedStart(null); setSelectedEnd(null); }, [dateStr, facilityId, sport]);

  // Mutual exclusion
  useEffect(() => { if (splitEnabled)     setRecurringEnabled(false); }, [splitEnabled]);
  useEffect(() => { if (recurringEnabled) setSplitEnabled(false);     }, [recurringEnabled]);

  // Auto-scroll date strip to selected chip
  useEffect(() => {
    const c = stripRef.current;
    if (!c) return;
    const chip = c.querySelector<HTMLElement>("[data-selected='true']");
    if (chip) c.scrollTo({ left: Math.max(0, chip.offsetLeft - (c.clientWidth - chip.offsetWidth) / 2), behavior: "smooth" });
  }, [date]);

  // Pre-check recurring week availability
  useEffect(() => {
    if (!recurringEnabled || !selectedSlotRange) { setWeekStatuses([]); return; }
    const { startTime, endTime } = selectedSlotRange;
    setWeekStatuses(Array(recurringWeeks).fill(null));
    const ctrl = new AbortController();
    (async () => {
      const results: (boolean | null)[] = Array(recurringWeeks).fill(null);
      await Promise.all(Array.from({ length: recurringWeeks }, (_, i) => {
        const d  = addDays(date, i * 7);
        const ds = format(d, "yyyy-MM-dd");
        return fetch(`${API}/search/groups/${facilityId}/${sport}/availability?date=${ds}`, { signal: ctrl.signal })
          .then(r => r.ok ? r.json() : null)
          .then((data: GroupAvailabilityResponse | null) => {
            if (!data?.slots) { results[i] = false; return; }
            const covered = data.slots.filter(s => s.startTime >= startTime && s.endTime <= endTime);
            results[i] = covered.length > 0 && covered.every(s => s.isAvailable);
          })
          .catch(() => { results[i] = false; });
      }));
      if (!ctrl.signal.aborted) setWeekStatuses([...results]);
    })();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringEnabled, recurringWeeks, dateStr, facilityId, sport]);

  const { data: availability, isLoading } = useQuery({
    queryKey: ["group-availability", facilityId, sport, dateStr],
    queryFn: () => fetchGroupAvailability(facilityId, sport, dateStr),
    staleTime: 30_000,
  });

  const slots  = availability?.slots ?? [];
  const courts = availability?.courts ?? [];
  const firstCourtId = courts[0]?.id ?? 0;

  const selectedSlotRange = useMemo(() => {
    if (selectedStart === null || !slots.length) return null;
    const end = selectedEnd ?? selectedStart;
    const rs  = Math.min(selectedStart, end);
    const re  = Math.max(selectedStart, end);
    const range = slots.slice(rs, re + 1);
    if (!range.length || !range.every(s => s.isAvailable)) return null;
    const startTime  = range[0].startTime;
    const endTime    = range[range.length - 1].endTime;
    const totalPrice = range.reduce((sum, s) => sum + s.price, 0);
    return { startTime, endTime, totalPrice, durationLabel: fmtDuration(startTime, endTime), rangeStart: rs, rangeEnd: re };
  }, [selectedStart, selectedEnd, slots]);

  const isLastMinute = useMemo(() => {
    if (!selectedSlotRange) return false;
    return new Date(`${dateStr}T${selectedSlotRange.startTime}:00`).getTime() - Date.now() < 2 * 60 * 60 * 1000;
  }, [selectedSlotRange, dateStr]);

  const hasVisibleSlots = useMemo(() => {
    if (!slots.length) return false;
    if (!isSameDay(date, today)) return true;
    return slots.some(s => s.startTime > nowStr);
  }, [slots, date, today, nowStr]);

  function handleSlotClick(idx: number) {
    const slot = slots[idx];
    if (!slot) return;
    if (!slot.isAvailable) {
      const endMin = toMin(slot.startTime) + 30;
      setWaitlistSlot({ startTime: slot.startTime, endTime: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`, courtId: firstCourtId });
      setWaitlistOpen(true);
      return;
    }
    if (selectedStart === null) { setSelectedStart(idx); setSelectedEnd(null); return; }
    const end = selectedEnd ?? selectedStart;
    const rs = Math.min(selectedStart, end), re = Math.max(selectedStart, end);
    if (idx >= rs && idx <= re) { setSelectedStart(null); setSelectedEnd(null); return; }
    const ns = idx < rs ? idx : rs, ne = idx > re ? idx : re;
    slots.slice(ns, ne + 1).every(s => s.isAvailable)
      ? (setSelectedStart(ns), setSelectedEnd(ne))
      : (setSelectedStart(idx), setSelectedEnd(null));
  }

  function callerInfo() {
    const email = (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "").trim();
    const name  = (user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || email.split("@")[0] || "Vartotojas").trim();
    return { name, email };
  }

  async function doBook(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setIsBooking(true);
    try {
      const booking = selectedCourtId === "auto"
        ? await customFetch<BookGroupResponse>(`/api/search/groups/${facilityId}/${sport}/book`, { method: "POST", body: JSON.stringify({ date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }), responseType: "json" })
        : await customFetch<BookingResponse>(`/api/bookings`, { method: "POST", body: JSON.stringify({ courtId: parseInt(selectedCourtId, 10), date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }), responseType: "json" });
      await goToCheckout(booking, facilityId, sport);
    } catch (err) {
      toast({ title: "Rezervacija nepavyko", description: err instanceof Error ? err.message : "Klaida", variant: "destructive" });
      setIsBooking(false);
    }
  }

  async function doSplit(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setSplitPending(true);
    try {
      const r = await fetch(`${API}/search/groups/${facilityId}/${sport}/checkout-split`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, totalSlots: splitCount, sport, customerName, customerEmail, matchType: splitMatchType, isPublic: isPublicMatch, ...(isPublicMatch ? { minSkillLevel: splitMinSkill, maxSkillLevel: splitMaxSkill } : {}) }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as any).error ?? "Nepavyko"); }
      const { url, shareToken } = await r.json();
      sessionStorage.setItem("splitShareToken", shareToken ?? "");
      window.location.href = url;
    } catch (err) {
      toast({ title: "Klaida", description: err instanceof Error ? err.message : "Bandykite dar kartą.", variant: "destructive" });
    } finally { setSplitPending(false); }
  }

  async function doRecurring(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setRecurringPending(true);
    let booked = 0;
    for (let i = 0; i < recurringWeeks; i++) {
      if (weekStatuses[i] === false) continue;
      try {
        const booking = await customFetch<BookGroupResponse>(`/api/search/groups/${facilityId}/${sport}/book`, {
          method: "POST", body: JSON.stringify({ date: format(addDays(date, i * 7), "yyyy-MM-dd"), startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }), responseType: "json",
        });
        if (Number(booking.totalPrice ?? 0) === 0) {
          await fetch(`${API}/payments/confirm-free`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ bookingId: booking.id }) });
        }
        booked++;
      } catch { /* skip conflicts */ }
    }
    setRecurringPending(false);
    if (booked === 0) toast({ title: "Nepavyko sukurti rezervacijų", description: "Pasirinkti laikai gali būti užimti.", variant: "destructive" });
    else { toast({ title: `${booked} rezervacij${booked === 1 ? "a" : booked < 10 ? "os" : "ų"} sukurta!` }); setSelectedStart(null); setSelectedEnd(null); setRecurringEnabled(false); }
  }

  function handleReserve(): void {
    if (!isSignedIn || !user) { setShowGuestForm(true); return; }
    const { name, email } = callerInfo();
    if (splitEnabled)     { doSplit(name, email); return; }
    if (recurringEnabled) { doRecurring(name, email); return; }
    doBook(name, email);
  }

  // 7-day chip strip (same length as court-detail)
  const stripDates  = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const isInStrip   = stripDates.some(d => isSameDay(d, date));
  const anyPending  = isBooking || splitPending || recurringPending;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-5 p-5">

      {/* ── Step 1: Date ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
          <p className="text-sm font-semibold">Pasirinkite datą</p>
        </div>
        <div className="flex items-stretch gap-2">
          <div ref={stripRef} className="flex-1 flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth">
            {/* Out-of-strip selected date chip */}
            {!isInStrip && (
              <button type="button" data-selected="true" onClick={() => setCalendarOpen(true)}
                className="shrink-0 min-w-[64px] rounded-xl border border-primary bg-primary/10 text-primary px-2 py-1.5 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary truncate">{format(date, "EEE", { locale: ltLocale })}</div>
                <div className="text-sm font-semibold leading-tight mt-0.5">{format(date, "MMM d", { locale: ltLocale })}</div>
              </button>
            )}
            {stripDates.map((d, i) => {
              const sel = isSameDay(d, date);
              return (
                <button key={i} type="button" data-selected={sel ? "true" : undefined}
                  onClick={() => setDate(d)}
                  className={`shrink-0 min-w-[64px] rounded-xl border px-2 py-1.5 text-center transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/60 text-foreground"}`}
                >
                  <div className={`text-[10px] font-semibold uppercase tracking-wide ${sel ? "text-primary" : "text-muted-foreground"}`}>
                    {i === 0 ? "Šiandien" : i === 1 ? "Rytoj" : format(d, "EEE", { locale: ltLocale })}
                  </div>
                  <div className="text-sm font-semibold leading-tight mt-0.5">{format(d, "MMM d", { locale: ltLocale })}</div>
                </button>
              );
            })}
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="Pasirinkti kitą datą"
                className="shrink-0 self-stretch w-11 rounded-xl border border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                <CalendarDays className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <DateCalendar selected={date} onSelect={d => { setDate(d); setCalendarOpen(false); }} minDate={today} onClose={() => setCalendarOpen(false)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Step 2: Time ── */}
      <div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
          <p className="text-sm font-semibold">Pasirinkite laiką</p>
          <span className="text-xs text-muted-foreground truncate min-w-0">vieną ar kelis 30 min laikotarpius</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />)}
          </div>
        ) : !hasVisibleSlots ? (
          <div className="text-center p-4 bg-muted rounded-xl text-sm text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 opacity-50" />
            <span>Šiai dienai laisvų laikų nėra.</span>
            <span className="text-xs">Pabandykite pasirinkti kitą datą.</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {slots.map((slot, idx) => {
              if (isSameDay(date, today) && slot.startTime <= nowStr) return null;
              const rs = selectedSlotRange?.rangeStart ?? null;
              const re = selectedSlotRange?.rangeEnd ?? null;
              const isSelected = rs !== null && re !== null ? idx >= rs && idx <= re : selectedStart === idx && selectedEnd === null;
              const isRangeEdge = idx === rs || idx === re;
              return (
                <button key={idx} type="button"
                  onClick={() => handleSlotClick(idx)}
                  className={`relative rounded-md border px-1 py-1.5 text-[11px] font-medium transition-all duration-150 focus:outline-none ${
                    !slot.isAvailable
                      ? "bg-muted/20 text-muted-foreground/30 border-transparent cursor-pointer hover:border-border/50"
                      : isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-lg ring-2 ring-primary/30 scale-[0.98]"
                        : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-primary/5 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  }`}
                >
                  <div className="text-center leading-tight">
                    <div className={`font-semibold text-xs tabular-nums ${isRangeEdge ? "text-[13px]" : ""} ${!slot.isAvailable ? "line-through opacity-50" : ""}`}>
                      {slot.startTime}
                    </div>
                    <div className={`mt-0.5 text-[10px] tabular-nums font-medium ${isSelected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                      {slot.isAvailable ? `${fmtPrice(slot.price)}€` : "Užimta"}
                    </div>
                  </div>
                  {isSelected && isRangeEdge && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary-foreground opacity-60 ring-1 ring-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Optional specific court selector */}
        {courts.length > 1 && (
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Aikštelė (Neprivaloma)</Label>
            <Select value={selectedCourtId} onValueChange={onCourtIdChange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Man nesvarbu (geriausia laisva)</SelectItem>
                {courts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.surface ? ` · ${c.surface}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Extras: recurring + split (only after slot selected) ── */}
      {selectedSlotRange && (
        <div className="space-y-2">

          {/* Recurring toggle card */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`rounded-lg border transition-colors overflow-hidden ${recurringEnabled ? "border-primary/30 bg-primary/5" : "border-transparent bg-muted/20 hover:bg-muted/40"}`}>
                <button type="button" onClick={() => setRecurringEnabled(v => !v)}
                  className="w-full flex items-center gap-2 px-2.5 py-2">
                  <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${recurringEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium flex-1 text-left">Kartoti kas savaitę</span>
                  <span onClick={e => e.stopPropagation()}>
                    <Switch checked={recurringEnabled} onCheckedChange={v => setRecurringEnabled(v)} />
                  </span>
                </button>
                {recurringEnabled && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-primary/15">
                    <div className="flex items-center gap-2 pt-2.5">
                      <span className="text-xs text-muted-foreground shrink-0">Savaitės:</span>
                      <div className="flex gap-1 flex-wrap">
                        {[2, 3, 4, 6, 8, 12].map(n => (
                          <button key={n} type="button" onClick={e => { e.stopPropagation(); setRecurringWeeks(n); }}
                            className={`text-xs px-2 py-0.5 rounded-md border font-medium transition-colors ${recurringWeeks === n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: recurringWeeks }, (_, i) => {
                        const d = addDays(date, i * 7);
                        const label = d.toLocaleDateString("lt-LT", { month: "short", day: "numeric" });
                        const st = weekStatuses[i];
                        return (
                          <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${
                            st === null ? "bg-muted/40 border-border text-muted-foreground animate-pulse"
                            : st ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400"
                            : "bg-destructive/5 border-destructive/20 text-muted-foreground/50 line-through"}`}>
                            {st === true  && <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />}
                            {st === false && <AlertCircle  className="w-2.5 h-2.5 shrink-0 text-destructive/50" />}
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    {weekStatuses.length === recurringWeeks && weekStatuses.some(s => s !== null) && (
                      <p className="text-xs text-muted-foreground border-t border-primary/10 pt-1.5">
                        {weekStatuses.filter(s => s === true).length} iš {recurringWeeks} savaitių laisvos
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            {splitEnabled && <TooltipContent side="top" className="text-xs max-w-[200px] text-center">Įjungus kartojimą, mokėjimo skaidymas bus išjungtas</TooltipContent>}
          </Tooltip>

          {/* Split toggle card */}
          {isSignedIn && selectedSlotRange.totalPrice > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" disabled={recurringEnabled || isLastMinute}
                  onClick={() => { if (!recurringEnabled && !isLastMinute) setSplitEnabled(v => !v); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                    recurringEnabled || isLastMinute ? "opacity-50 cursor-not-allowed bg-muted/10 border-transparent"
                    : splitEnabled ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-transparent hover:bg-muted/40"}`}>
                  <Users className={`w-3.5 h-3.5 shrink-0 ${splitEnabled && !isLastMinute && !recurringEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium flex-1 text-left">Skaidyti mokėjimą</span>
                  <span onClick={e => e.stopPropagation()}>
                    <Switch checked={splitEnabled && !isLastMinute && !recurringEnabled} onCheckedChange={v => { if (!recurringEnabled && !isLastMinute) setSplitEnabled(v); }} disabled={recurringEnabled || isLastMinute} />
                  </span>
                </button>
              </TooltipTrigger>
              {(recurringEnabled || isLastMinute) && (
                <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                  {recurringEnabled ? "Mokėjimo skaidymas negalimas kartotinėms rezervacijoms" : "Paskutinės minutės rezervacijas būtina apmokėti pilnai"}
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {/* Split expansion */}
          {splitEnabled && isSignedIn && selectedSlotRange.totalPrice > 0 && !isLastMinute && !recurringEnabled && (
            <div className="p-3 bg-muted/30 rounded-xl border space-y-3">
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-semibold">Organizatoriaus garantija:</span> jei kiti žaidėjai neapmokės savo dalies likus 2 val. iki žaidimo, likusi suma bus nuskaityta nuo jūsų kortelės.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm flex-1">Žaidėjų skaičius</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSplitCount(c => Math.max(2, c - 1))} disabled={splitCount <= 2} className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors font-bold text-lg leading-none disabled:opacity-40">−</button>
                  <span className="text-base font-bold w-5 text-center">{splitCount}</span>
                  <button type="button" onClick={() => setSplitCount(c => Math.min(8, c + 1))} disabled={splitCount >= 8} className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors font-bold text-lg leading-none disabled:opacity-40">+</button>
                </div>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t">
                <span className="text-muted-foreground">Jūsų dalis (1/{splitCount})</span>
                <span className="font-bold text-primary">{(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €</span>
              </div>
              <div className="border-t pt-2 space-y-2">
                <button type="button" onClick={() => setIsPublicMatch(v => !v)} className="w-full flex items-center justify-between text-sm hover:opacity-80">
                  <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-primary" />Ieškau žaidėjų (Viešas mačas)</span>
                  <span onClick={e => e.stopPropagation()}><Switch checked={isPublicMatch} onCheckedChange={setIsPublicMatch} /></span>
                </button>
                {isPublicMatch && (
                  <div className="p-2.5 bg-background rounded-md border space-y-2">
                    <p className="text-xs text-muted-foreground">Lygio reikalavimas: {splitMinSkill.toFixed(1)} – {splitMaxSkill.toFixed(1)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-7 shrink-0">min</span>
                      <input type="range" min="1" max="7" step="0.5" value={splitMinSkill} onChange={e => setSplitMinSkill(Math.min(parseFloat(e.target.value), splitMaxSkill - 0.5))} className="flex-1 accent-primary h-1.5" />
                      <span className="text-xs font-semibold w-7 text-right shrink-0">{splitMinSkill.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-7 shrink-0">max</span>
                      <input type="range" min="1" max="7" step="0.5" value={splitMaxSkill} onChange={e => setSplitMaxSkill(Math.max(parseFloat(e.target.value), splitMinSkill + 0.5))} className="flex-1 accent-primary h-1.5" />
                      <span className="text-xs font-semibold w-7 text-right shrink-0">{splitMaxSkill.toFixed(1)}</span>
                    </div>
                    <div className="flex gap-2">
                      {(["casual", "competitive"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setSplitMatchType(t)} className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${splitMatchType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"}`}>
                          {t === "casual" ? "Draugiškas" : "Reitinginis"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Book ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
          <p className="text-sm font-semibold">Rezervuoti</p>
        </div>

        {/* Price summary */}
        {selectedSlotRange && (
          <div className="mb-3 rounded-xl bg-muted/40 border px-4 py-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{format(date, "EEE, MMM d", { locale: ltLocale })} · {selectedSlotRange.startTime}–{selectedSlotRange.endTime}</span>
              {isLastMinute && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Last minute</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{selectedSlotRange.durationLabel}</span>
              <span className="text-lg font-bold text-foreground">{fmtPrice(selectedSlotRange.totalPrice)} €</span>
            </div>
            {splitEnabled && !recurringEnabled && (
              <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
                {splitCount} žaidėjai · po <span className="font-semibold text-foreground">{(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €</span> kiekvienas
              </p>
            )}
            {recurringEnabled && (
              <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
                {weekStatuses.filter(s => s === true).length || recurringWeeks} kartų · ~<span className="font-semibold text-foreground">{fmtPrice(selectedSlotRange.totalPrice * recurringWeeks)} €</span> iš viso
              </p>
            )}
          </div>
        )}

        {showGuestForm ? (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Vardas</Label>
              <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Jonas Jonaitis" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">El. paštas</Label>
              <Input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="jonas@email.com" type="email" className="h-9 text-sm mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowGuestForm(false)}>Atšaukti</Button>
              <Button size="sm" className="flex-1" disabled={!guestName.trim() || !guestEmail.trim() || isBooking}
                onClick={() => doBook(guestName.trim(), guestEmail.trim())}>
                {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rezervuoti"}
              </Button>
            </div>
            <button className="w-full text-xs text-muted-foreground hover:text-foreground text-center" onClick={() => { setShowGuestForm(false); openSignIn(); }}>
              Prisijungti vietoj to
            </button>
          </div>
        ) : (
          <Button className="w-full" size="lg" disabled={!selectedSlotRange || anyPending}
            onClick={handleReserve}>
            {anyPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {!selectedSlotRange ? "Pasirinkite laiką" : splitEnabled ? `Rezervuoti ir pakviesti (${splitCount} žaid.)` : recurringEnabled ? `Rezervuoti ${weekStatuses.filter(s => s === true).length || recurringWeeks} kartų` : `Rezervuoti · ${fmtPrice(selectedSlotRange.totalPrice)} €`}
          </Button>
        )}
      </div>

    </div>

    {/* Waitlist modal */}
    {waitlistSlot && (
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen}
        courtId={waitlistSlot.courtId} date={dateStr}
        startTime={waitlistSlot.startTime} endTime={waitlistSlot.endTime}
        prefillEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
        prefillName={user?.fullName ?? ""} />
    )}
    </TooltipProvider>
  );
}
