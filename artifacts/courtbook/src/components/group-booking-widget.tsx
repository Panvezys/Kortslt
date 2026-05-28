import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay } from "date-fns";
import { lt as ltLocale } from "date-fns/locale";
import { useUser, useClerk } from "@clerk/react";
import { Loader2, CalendarDays, Users, RefreshCw, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
const STRIP_DAYS = 14;

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function fmtDuration(startTime: string, endTime: string) {
  const mins = toMin(endTime) - toMin(startTime);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} val` : `${h} val ${m} min`;
}

async function fetchGroupAvailability(facilityId: number, sport: string, date: string): Promise<GroupAvailabilityResponse> {
  return customFetch<GroupAvailabilityResponse>(`/api/search/groups/${facilityId}/${sport}/availability?date=${date}`, { responseType: "json" });
}

async function goToCheckout(booking: BookingResponse | BookGroupResponse, facilityId: number, sport: string) {
  const mgmtToken = booking.managementToken ?? null;
  const isGuest   = !!mgmtToken;
  const origin    = window.location.origin;
  const total     = Number(booking.totalPrice ?? 0);
  const successUrl = isGuest ? `${origin}${BASE}/guest/booking/${mgmtToken}?paid=1` : `${origin}${BASE}/booking-confirmed?id=${booking.id}`;
  const cancelUrl  = `${origin}${BASE}/facility/${facilityId}?sport=${sport}`;
  if (total > 0) {
    const resp = await fetch(`${API}/payments/create-checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, ...(isGuest ? { managementToken: mgmtToken } : {}), successUrl, cancelUrl }) });
    if (!resp.ok) throw new Error("Checkout session failed");
    const { url } = await resp.json();
    sessionStorage.setItem("stripeCancel_pending", JSON.stringify({ bookingId: booking.id, facilityId, ts: Date.now(), ...(isGuest ? { managementToken: mgmtToken } : {}) }));
    window.location.href = url;
  } else {
    const resp = await fetch(`${API}/payments/confirm-free`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id, ...(isGuest ? { managementToken: mgmtToken } : {}) }) });
    if (!resp.ok) throw new Error("Free confirm failed");
    window.location.href = isGuest ? `${origin}${BASE}/guest/booking/${mgmtToken}` : `${origin}${BASE}/booking-confirmed?id=${booking.id}`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GroupBookingWidgetProps { facilityId: number; sport: string; }

export function GroupBookingWidget({ facilityId, sport }: GroupBookingWidgetProps) {
  const today = useMemo(() => new Date(), []);
  const [date,          setDate]          = useState<Date>(today);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd,   setSelectedEnd]   = useState<number | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("auto");
  const [calendarOpen,  setCalendarOpen]  = useState(false);
  const [isBooking,     setIsBooking]     = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName,     setGuestName]     = useState("");
  const [guestEmail,    setGuestEmail]    = useState("");

  // Waitlist
  const [waitlistOpen, setWaitlistOpen]   = useState(false);
  const [waitlistSlot, setWaitlistSlot]   = useState<{ startTime: string; endTime: string; courtId: number } | null>(null);

  // Recurring
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringWeeks,   setRecurringWeeks]   = useState(4);
  const [recurringPending, setRecurringPending] = useState(false);

  // Split payment
  const [splitEnabled,   setSplitEnabled]   = useState(false);
  const [splitCount,     setSplitCount]     = useState(4);
  const [splitMatchType, setSplitMatchType] = useState<"casual" | "competitive">("casual");
  const [splitPending,   setSplitPending]   = useState(false);

  const { isSignedIn, user } = useUser();
  const { openSignIn } = useClerk();
  const { toast } = useToast();
  const dateStripRef = useRef<HTMLDivElement>(null);

  const dateStr = format(date, "yyyy-MM-dd");

  // Reset slot selection when date or facility changes
  useEffect(() => { setSelectedStart(null); setSelectedEnd(null); }, [dateStr, facilityId, sport]);

  // Mutual exclusion: split + recurring can't both be on
  useEffect(() => { if (splitEnabled && recurringEnabled) setRecurringEnabled(false); }, [splitEnabled]);
  useEffect(() => { if (recurringEnabled && splitEnabled) setSplitEnabled(false); }, [recurringEnabled]);

  // Auto-scroll date strip so selected chip is centred
  useEffect(() => {
    const c = dateStripRef.current;
    if (!c) return;
    const chip = c.querySelector<HTMLElement>("[data-selected='true']");
    if (!chip) return;
    c.scrollTo({ left: Math.max(0, chip.offsetLeft - (c.clientWidth - chip.offsetWidth) / 2), behavior: "smooth" });
  }, [date]);

  const { data: availability, isLoading } = useQuery({
    queryKey: ["group-availability", facilityId, sport, dateStr],
    queryFn: () => fetchGroupAvailability(facilityId, sport, dateStr),
    staleTime: 30_000,
  });

  const slots  = availability?.slots ?? [];
  const courts = availability?.courts ?? [];

  // First unavailable court ID for waitlist (fallback to courts[0].id)
  const firstCourtId = courts[0]?.id ?? 0;

  const selectedSlotRange = useMemo(() => {
    if (selectedStart === null || slots.length === 0) return null;
    const end = selectedEnd ?? selectedStart;
    const rs = Math.min(selectedStart, end);
    const re = Math.max(selectedStart, end);
    const range = slots.slice(rs, re + 1);
    if (!range.length || !range.every(s => s.isAvailable)) return null;
    const startTime = range[0].startTime;
    const endTime   = range[range.length - 1].endTime;
    const totalPrice = range.reduce((sum, s) => sum + s.price, 0);
    return { startTime, endTime, totalPrice, durationLabel: fmtDuration(startTime, endTime) };
  }, [selectedStart, selectedEnd, slots]);

  const isLastMinute = useMemo(() => {
    if (!selectedSlotRange) return false;
    return new Date(`${dateStr}T${selectedSlotRange.startTime}:00`).getTime() - Date.now() < 2 * 60 * 60 * 1000;
  }, [selectedSlotRange, dateStr]);

  function handleSlotClick(idx: number) {
    const slot = slots[idx];
    if (!slot) return;
    if (!slot.isAvailable) {
      const endMin = toMin(slot.startTime) + 30;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      setWaitlistSlot({ startTime: slot.startTime, endTime, courtId: firstCourtId });
      setWaitlistOpen(true);
      return;
    }
    if (selectedStart === null) { setSelectedStart(idx); setSelectedEnd(null); return; }
    const end = selectedEnd ?? selectedStart;
    const rs = Math.min(selectedStart, end);
    const re = Math.max(selectedStart, end);
    if (idx >= rs && idx <= re) { setSelectedStart(null); setSelectedEnd(null); return; }
    const ns = idx < rs ? idx : rs;
    const ne = idx > re ? idx : re;
    const allAvail = slots.slice(ns, ne + 1).every(s => s.isAvailable);
    if (allAvail) { setSelectedStart(ns); setSelectedEnd(ne); }
    else { setSelectedStart(idx); setSelectedEnd(null); }
  }

  function getCallerInfo() {
    const anyEmail = (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "").trim();
    const anyName  = (user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || anyEmail.split("@")[0] || "").trim();
    return { name: anyName || "Vartotojas", email: anyEmail };
  }

  async function doBook(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setIsBooking(true);
    try {
      let booking: BookingResponse | BookGroupResponse;
      if (selectedCourtId === "auto") {
        booking = await customFetch<BookGroupResponse>(`/api/search/groups/${facilityId}/${sport}/book`, {
          method: "POST",
          body: JSON.stringify({ date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }),
          responseType: "json",
        });
      } else {
        booking = await customFetch<BookingResponse>(`/api/bookings`, {
          method: "POST",
          body: JSON.stringify({ courtId: parseInt(selectedCourtId, 10), date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }),
          responseType: "json",
        });
      }
      await goToCheckout(booking, facilityId, sport);
    } catch (err: unknown) {
      toast({ title: "Rezervacija nepavyko", description: err instanceof Error ? err.message : "Klaida", variant: "destructive" });
      setIsBooking(false);
    }
  }

  async function doSplitBook(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setSplitPending(true);
    try {
      const resp = await fetch(`${API}/search/groups/${facilityId}/${sport}/checkout-split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: dateStr, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, totalSlots: splitCount, sport, customerName, customerEmail, matchType: splitMatchType }),
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error((d as any).error ?? "Nepavyko"); }
      const { url, shareToken } = await resp.json();
      sessionStorage.setItem("splitShareToken", shareToken ?? "");
      window.location.href = url;
    } catch (err: unknown) {
      toast({ title: "Klaida", description: err instanceof Error ? err.message : "Bandykite dar kartą.", variant: "destructive" });
    } finally {
      setSplitPending(false);
    }
  }

  async function doRecurring(customerName: string, customerEmail: string) {
    if (!selectedSlotRange) return;
    setRecurringPending(true);
    let booked = 0;
    for (let i = 0; i < recurringWeeks; i++) {
      const d = addDays(date, i * 7);
      const ds = format(d, "yyyy-MM-dd");
      try {
        const booking = await customFetch<BookGroupResponse>(`/api/search/groups/${facilityId}/${sport}/book`, {
          method: "POST",
          body: JSON.stringify({ date: ds, startTime: selectedSlotRange.startTime, endTime: selectedSlotRange.endTime, customerName, customerEmail }),
          responseType: "json",
        });
        const total = Number(booking.totalPrice ?? 0);
        if (total === 0) {
          await fetch(`${API}/payments/confirm-free`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ bookingId: booking.id }) });
        }
        booked++;
      } catch { /* skip conflicts */ }
    }
    setRecurringPending(false);
    if (booked === 0) {
      toast({ title: "Nepavyko sukurti rezervacijų", description: "Pasirinkti laikai gali būti užimti.", variant: "destructive" });
    } else {
      toast({ title: `${booked} rezervacij${booked === 1 ? "a" : booked < 10 ? "os" : "ų"} sukurta!` });
      setSelectedStart(null); setSelectedEnd(null); setRecurringEnabled(false);
    }
  }

  function handleReserve() {
    if (!selectedSlotRange) return;
    if (!isSignedIn || !user) { openSignIn(); return; }
    const { name, email } = getCallerInfo();
    if (splitEnabled) { doSplitBook(name, email); return; }
    if (recurringEnabled) { doRecurring(name, email); return; }
    doBook(name, email);
  }

  function handleGuestSubmit() {
    if (!guestName.trim() || !guestEmail.trim()) return;
    doBook(guestName.trim(), guestEmail.trim());
  }

  const stripDates = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));

  return (
    <div className="flex flex-col h-full">

      {/* ── Date strip ── */}
      <div className="shrink-0 border-b">
        <div ref={dateStripRef} className="flex overflow-x-auto scrollbar-hide">
          {stripDates.map((d, i) => {
            const dStr = format(d, "yyyy-MM-dd");
            const isSelected = isSameDay(d, date);
            const label = i === 0 ? "Šiandien" : i === 1 ? "Rytoj" : format(d, "EEE", { locale: ltLocale });
            return (
              <button
                key={dStr}
                data-selected={isSelected}
                onClick={() => setDate(d)}
                className={`shrink-0 flex flex-col items-center py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                  isSelected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="capitalize">{label}</span>
                <span className={`text-sm font-bold mt-0.5 ${isSelected ? "text-primary" : "text-foreground"}`}>{format(d, "d")}</span>
              </button>
            );
          })}
          {/* Calendar popover for dates beyond strip */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="shrink-0 flex flex-col items-center justify-center py-3 px-3 text-xs font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors">
                <CalendarDays className="h-4 w-4" />
                <span className="mt-0.5">Daugiau</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto" align="end">
              <DateCalendar selected={date} onSelect={d => { setDate(d); setCalendarOpen(false); }} minDate={today} onClose={() => setCalendarOpen(false)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Slot grid ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Kraunama…</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <CalendarDays className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nėra laikų šią dieną</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map((slot, idx) => {
              const end = selectedEnd ?? selectedStart;
              const rs = selectedStart !== null && end !== null ? Math.min(selectedStart, end) : -1;
              const re = selectedStart !== null && end !== null ? Math.max(selectedStart, end) : -1;
              const inRange = idx >= rs && idx <= re;
              const nowStr = new Date().toTimeString().slice(0, 5);
              const isPast = isSameDay(date, today) && slot.startTime <= nowStr;
              return (
                <button
                  key={slot.startTime}
                  onClick={() => !isPast && handleSlotClick(idx)}
                  disabled={isPast}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all
                    ${isPast ? "opacity-30 cursor-not-allowed"
                      : !slot.isAvailable ? "bg-muted/60 text-muted-foreground/50 cursor-pointer hover:bg-muted"
                      : inRange ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background border border-border hover:border-primary/60 hover:bg-primary/5 text-foreground"
                    }`}
                >
                  <span>{slot.startTime}</span>
                  <span className={`text-[10px] mt-0.5 ${inRange ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {slot.isAvailable ? (slot.price % 1 === 0 ? slot.price.toFixed(0) : slot.price.toFixed(2)) + "€" : "Užimta"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Court selector */}
        {courts.length > 1 && (
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Aikštelė (Neprivaloma)</Label>
            <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Man nesvarbu (geriausia laisva)</SelectItem>
                {courts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.surface ? ` · ${c.surface}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Split payment toggle */}
        {selectedSlotRange && !isLastMinute && isSignedIn && (
          <div className="mt-4 rounded-xl border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Padalinti kainą</p>
                <p className="text-xs text-muted-foreground">Kiekvienas moka savo dalį</p>
              </div>
              <Switch checked={splitEnabled} onCheckedChange={v => { setSplitEnabled(v); if (v) setRecurringEnabled(false); }} />
            </div>
            {splitEnabled && (
              <div className="space-y-2 pt-1 border-t">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Žaidėjų skaičius</Label>
                  <Select value={String(splitCount)} onValueChange={v => setSplitCount(Number(v))}>
                    <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{[2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Mačo tipas</Label>
                  <Select value={splitMatchType} onValueChange={v => setSplitMatchType(v as "casual" | "competitive")}>
                    <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Draugiškas</SelectItem>
                      <SelectItem value="competitive">Reitinginis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kiekvienas mokės <span className="font-semibold text-foreground">{((selectedSlotRange.totalPrice / splitCount) % 1 === 0 ? (selectedSlotRange.totalPrice / splitCount).toFixed(0) : (selectedSlotRange.totalPrice / splitCount).toFixed(2))} €</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recurring toggle */}
        {selectedSlotRange && !splitEnabled && isSignedIn && (
          <div className="mt-3 rounded-xl border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Kartoti kas savaitę</p>
                <p className="text-xs text-muted-foreground">Automatiškai rezervuoti {recurringWeeks} sav.</p>
              </div>
              <Switch checked={recurringEnabled} onCheckedChange={v => { setRecurringEnabled(v); if (v) setSplitEnabled(false); }} />
            </div>
            {recurringEnabled && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t">
                <Label className="text-xs text-muted-foreground">Savaitių skaičius</Label>
                <Select value={String(recurringWeeks)} onValueChange={v => setRecurringWeeks(Number(v))}>
                  <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[2,4,6,8,12].map(n => <SelectItem key={n} value={String(n)}>{n} sav.</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Summary + CTA ── */}
      <div className="shrink-0 border-t p-3 space-y-2">
        {selectedSlotRange ? (
          <>
            <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{format(date, "EEE, MMM d", { locale: ltLocale })}</span>
                {isLastMinute && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Last minute</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedSlotRange.startTime}–{selectedSlotRange.endTime} · {selectedSlotRange.durationLabel}</span>
                <span className="font-bold text-foreground">
                  {selectedSlotRange.totalPrice % 1 === 0 ? selectedSlotRange.totalPrice.toFixed(0) : selectedSlotRange.totalPrice.toFixed(2)} €
                </span>
              </div>
              {splitEnabled && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{splitCount} žaidėjai · po {((selectedSlotRange.totalPrice / splitCount) % 1 === 0 ? (selectedSlotRange.totalPrice / splitCount).toFixed(0) : (selectedSlotRange.totalPrice / splitCount).toFixed(2))} €</p>
              )}
              {recurringEnabled && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3" />{recurringWeeks} sav. · {(selectedSlotRange.totalPrice * recurringWeeks % 1 === 0 ? (selectedSlotRange.totalPrice * recurringWeeks).toFixed(0) : (selectedSlotRange.totalPrice * recurringWeeks).toFixed(2))} € iš viso</p>
              )}
            </div>

            {showGuestForm ? (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Vardas</Label>
                  <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Jonas Jonaitis" className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">El. paštas</Label>
                  <Input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="jonas@email.com" type="email" className="h-8 text-sm mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowGuestForm(false)}>Atšaukti</Button>
                  <Button size="sm" className="flex-1" disabled={!guestName.trim() || !guestEmail.trim() || isBooking} onClick={handleGuestSubmit}>
                    {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rezervuoti"}
                  </Button>
                </div>
                <button className="w-full text-xs text-muted-foreground hover:text-foreground text-center" onClick={() => { setShowGuestForm(false); openSignIn(); }}>
                  Prisijungti vietoj to
                </button>
              </div>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() => { if (!isSignedIn) { setShowGuestForm(true); return; } handleReserve(); }}
                disabled={isBooking || splitPending || recurringPending}
              >
                {(isBooking || splitPending || recurringPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {splitEnabled ? `Rezervuoti ir pakviesti (${splitCount} žaid.)` : recurringEnabled ? `Rezervuoti ${recurringWeeks} kartų` : "Rezervuoti"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-1">Pasirinkite laiką aukščiau</p>
        )}
      </div>

      {/* Waitlist modal */}
      {waitlistSlot && (
        <WaitlistModal
          open={waitlistOpen}
          onOpenChange={setWaitlistOpen}
          courtId={waitlistSlot.courtId}
          date={dateStr}
          startTime={waitlistSlot.startTime}
          endTime={waitlistSlot.endTime}
          prefillEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
          prefillName={user?.fullName ?? ""}
        />
      )}
    </div>
  );
}
