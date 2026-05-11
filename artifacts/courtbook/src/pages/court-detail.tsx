import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useT, useI18n } from "@/lib/i18n";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useListBookings, useListCourtReviews, getListBookingsQueryKey, getListCourtReviewsQueryKey } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { DateCalendar } from "@/components/ui/date-calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star, Clock, Euro, Phone, Navigation, ExternalLink, LogIn, ShoppingBag, Zap, CalendarDays, Trophy, Mail, Heart, Share2, MessageSquare, ChevronLeft, ChevronRight, ChevronDown, Images, UserPlus, Check, X, Camera, Copy, Trash2, Pencil, Globe, Lock, RotateCcw } from "lucide-react";
import { getAmenityMeta } from "@/lib/amenities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { format as formatDate } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useTheme } from "@/components/theme-provider";
import { openChat } from "@/components/chat-bubble";
import { GuestCheckoutDialog } from "@/components/guest-checkout-dialog";
import { BookingSummaryDialog } from "@/components/booking-summary-dialog";
import { SPORT_LABELS, SportPill } from "@/components/sport-icon";
import { WeatherWidget } from "@/components/weather-widget";
import { SurfaceSpecs } from "@/components/surface-specs";
import { RelatedCourtsCarousel } from "@/components/related-courts-carousel";
import { CancellationTimeline } from "@/components/cancellation-timeline";
import { WaitlistModal } from "@/components/waitlist-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

function vibrateTap() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) return;
  navigator.vibrate(12);
}

const EQUIPMENT_ICONS: Record<string, string> = {
  "Raketė": "🎾",
  "Teniso raketė": "🎾",
  "Kamuliukai": "⚪",
  "Kamuoliukai": "⚪",
  "Rankšluostis": "🧺",
  "Rankšluosčiai": "🧺",
  "Batai": "👟",
  "Apranga": "👕",
  "Vanduo": "💧",
  "Gėrimas": "💧",
  "Krepšys": "👜",
  "Stovas": "📦",
};

function getEquipmentIcon(name: string) {
  const key = Object.keys(EQUIPMENT_ICONS).find((item) => name.toLowerCase().includes(item.toLowerCase()));
  return key ? EQUIPMENT_ICONS[key] : "•";
}

function formatPriceLabel(price: number, unit?: string) {
  if (unit === "hour") return `${price}€ / 1hr`;
  return `${price}€ / 30 min`;
}

function formatCourtPrice(price: number) {
  return `${price}€ / 30 min`;
}


function StarDisplay({ rating, size = "md" }: { rating?: number | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };
  const cls = sizes[size];
  if (!rating) return null;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className={`${cls} fill-yellow-400 text-yellow-400`} />
      ))}
      {hasHalf && <Star key="half" className={`${cls} fill-yellow-200 text-yellow-400`} />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className={`${cls} text-muted-foreground/30`} />
      ))}
    </div>
  );
}

interface Coach {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string;
  photoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  availabilityDescription?: string;
  phone?: string;
}

function CoachesSectionForCourt({ courtId }: { courtId: number }) {
  const { data: coaches, isLoading } = useQuery<Coach[]>({
    queryKey: ["court-coaches", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/coaches`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!courtId && !isNaN(courtId),
  });

  if (isLoading) return null;
  if (!coaches || coaches.length === 0) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary" />
        Treneriai
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {coaches.map(coach => (
          <a
            key={coach.id}
            href={`/coach/${coach.id}`}
            className="flex gap-4 p-4 bg-card border rounded-2xl hover:border-primary/50 hover:shadow-md transition-all group"
          >
            {coach.photoUrl ? (
              <img src={coach.photoUrl} alt={coach.name} className="w-14 h-14 rounded-full object-cover border-2 border-muted shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-primary/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold group-hover:text-primary transition-colors truncate">{coach.name}</p>
              {coach.sports.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {coach.sports.slice(0, 3).map(s => (
                    <SportPill key={s} sport={s} variant="subtle" />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {coach.pricePerHour != null && (
                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                    <Euro className="w-3 h-3" />{coach.pricePerHour}/val
                  </span>
                )}
                {coach.availabilityDescription && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{coach.availabilityDescription}
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

interface MembershipPlan {
  id: number; name: string; description: string | null;
  pricePerYear: number; weeklySlots: number;
}

const DAYS_LT = ["Sekmadienis", "Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

function CourtMembershipSection({ courtId }: { courtId: number }) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subscribePlan, setSubscribePlan] = useState<MembershipPlan | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [open, setOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["court-memberships", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/memberships`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!courtId,
  });

  const subscribe = useMutation({
    mutationFn: () => {
      if (!subscribePlan) throw new Error("No plan selected");
      return fetch(`${API}/courts/${courtId}/memberships/${subscribePlan.id}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: Number(dayOfWeek), startTime }),
        credentials: "include",
      }).then(r => r.json());
    },
    onSuccess: () => {
      toast({ title: "Narystė aktyvuota! 🎉", description: `${subscribePlan?.name} — jūsų savaitinis slotą užregistruotas.` });
      setOpen(false); setSubscribePlan(null);
    },
    onError: (e: any) => toast({ title: "Klaida", description: e?.message ?? "Bandykite dar kartą", variant: "destructive" }),
  });

  if (isLoading || plans.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-cyan-500" />
        <h2 className="text-xl font-semibold">Narystės planai</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {plans.map(plan => (
          <div key={plan.id} className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/5 to-primary/5 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Star className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{plan.name}</div>
                {plan.description && <div className="text-xs text-muted-foreground">{plan.description}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-primary text-base">{plan.pricePerYear}€</div>
                <div className="text-xs text-muted-foreground">per metus</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {plan.weeklySlots} slotai per savaitę · 12 mėnesių narystė
            </div>
            {user ? (
              <Button size="sm" className="w-full gap-1.5" variant="outline"
                onClick={() => { setSubscribePlan(plan); setOpen(true); }}>
                <UserPlus className="w-3.5 h-3.5" /> Tapti nariu
              </Button>
            ) : (
              <Button size="sm" className="w-full" variant="outline" asChild>
                <a href="/sign-in">Prisijungti ir tapti nariu</a>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Subscribe dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pasirinkite savaitinį laiką</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Savaitės diena</Label>
              <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)}>
                {DAYS_LT.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pradžios laikas</Label>
              <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={startTime} onChange={e => setStartTime(e.target.value)}>
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            {subscribePlan && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="font-semibold">{subscribePlan.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{subscribePlan.pricePerYear}€/metai · {DAYS_LT[Number(dayOfWeek)]} {startTime}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Atšaukti</Button>
            <Button className="flex-1" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
              {subscribe.isPending ? "..." : "Patvirtinti narystę"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CourtDetail() {
  const { id } = useParams();
  const courtId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const { locale } = useI18n();

  const [date, setDate] = useState<Date>(() => {
    try {
      const stored = sessionStorage.getItem("linkGameDate");
      if (stored) {
        sessionStorage.removeItem("linkGameDate");
        const [y, m, d] = stored.split("-").map(Number);
        if (y && m && d) return new Date(y, m - 1, d);
      }
    } catch { /* ignore */ }
    return new Date();
  });
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);

  // Auto-select the slot range from sessionStorage when availability loads (link-game mode)
  const pendingLinkStart = useRef<string | null>(null);
  const pendingLinkEnd = useRef<string | null>(null);
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("linkGameStartTime");
      const e = sessionStorage.getItem("linkGameEndTime");
      if (s) { pendingLinkStart.current = s; sessionStorage.removeItem("linkGameStartTime"); }
      if (e) { pendingLinkEnd.current = e; sessionStorage.removeItem("linkGameEndTime"); }
    } catch { /* ignore */ }
  }, []);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const dateStr = format(date, "yyyy-MM-dd");

  const { data: court, isLoading: courtLoading } = useGetCourt(courtId, {
    query: {
      enabled: !!courtId && !isNaN(courtId),
      queryKey: getGetCourtQueryKey(courtId),
    }
  });

  const { data: availability, isLoading: availabilityLoading } = useGetCourtAvailability(
    courtId,
    { date: dateStr },
    {
      query: {
        enabled: !!courtId && !isNaN(courtId),
        queryKey: getGetCourtAvailabilityQueryKey(courtId, { date: dateStr }),
      }
    }
  );

  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { theme } = useTheme();
  const { data: reviews } = useListCourtReviews(courtId, {
    query: { queryKey: getListCourtReviewsQueryKey(courtId), enabled: !!courtId && !isNaN(courtId) }
  });
  const { data: bookings } = useListBookings(
    { courtId },
    { query: { queryKey: getListBookingsQueryKey({ courtId }), enabled: !!courtId && !isNaN(courtId) && !!user } }
  );

  const createBooking = useCreateBooking();
  const queryClient = useQueryClient();
  const { openSignIn, openSignUp } = useClerk();
  const [, navigate] = useLocation();

  const [copiedContact, setCopiedContact] = useState<"address" | "phone" | null>(null);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const { data: meRole } = useQuery<{ role: string }>({
    queryKey: ["me-role"],
    queryFn: async () => {
      const r = await fetch(`${API}/me/role`, { credentials: "include" });
      if (!r.ok) return { role: "user" };
      return r.json();
    },
    enabled: !!user,
  });
  const isAdmin = meRole?.role === "admin";
  const isOwner = !!user && !!court && user.id === (court as any).ownerUserId;
  const canEdit = isAdmin || isOwner;
  const [editOpen, setEditOpen] = useState(false);
  const [guestCheckoutOpen, setGuestCheckoutOpen] = useState(false);
  const [guestCheckoutSubmitting, setGuestCheckoutSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pendingGuestData, setPendingGuestData] = useState<{ customerName: string; customerEmail: string; customerPhone?: string } | null>(null);
  const linkGameId = useMemo(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("linkGameId");
      if (fromUrl) return parseInt(fromUrl, 10);
      const fromSession = sessionStorage.getItem("linkGameId");
      if (fromSession) {
        sessionStorage.removeItem("linkGameId");
        return parseInt(fromSession, 10);
      }
      return null;
    } catch { return null; }
  }, []);

  const [splitEnabled, setSplitEnabled] = useState(() => !!linkGameId);
  const [splitCount, setSplitCount] = useState(4);
  const [splitPending, setSplitPending] = useState(false);
  const [isPublicMatch, setIsPublicMatch] = useState(false);
  const [splitMatchType, setSplitMatchType] = useState<"casual" | "competitive">("casual");
  const [splitMinSkill, setSplitMinSkill] = useState(1.0);
  const [splitMaxSkill, setSplitMaxSkill] = useState(7.0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);

  useEffect(() => {
    // Check URL params (direct Stripe redirect)
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("booking_cancelled") === "1";
    const urlBookingId = fromUrl ? Number(params.get("bookingId")) : 0;

    // Fallback: check sessionStorage (handles cases where URL params are stripped by proxy)
    let sessionBookingId = 0;
    let storedToken: string | null = null;
    try {
      const raw = sessionStorage.getItem("stripeCancel_pending");
      if (raw) {
        const stored = JSON.parse(raw);
        const isRecent = (Date.now() - stored.ts) < 30 * 60 * 1000;
        if (stored.courtId === courtId && isRecent) {
          sessionBookingId = stored.bookingId;
          if (typeof stored.managementToken === "string") storedToken = stored.managementToken;
        }
      }
    } catch { /* ignore */ }

    const cancelBookingId = urlBookingId || sessionBookingId;
    if (!cancelBookingId) return;

    // Clean up signals
    if (fromUrl) window.history.replaceState(null, "", window.location.pathname);
    try { sessionStorage.removeItem("stripeCancel_pending"); } catch { /* ignore */ }

    // Immediately hide this booking from "My Reservations" before the API call returns
    try {
      const existing = JSON.parse(sessionStorage.getItem("cancelledBookingIds") ?? "[]");
      sessionStorage.setItem("cancelledBookingIds", JSON.stringify([...existing, cancelBookingId]));
    } catch { /* ignore */ }

    // Delay toast slightly to ensure Toaster is fully mounted and subscribed
    setTimeout(() => {
      toast({
        title: "Mokėjimas atšauktas",
        description: "Rezervacija nepatvirtinta ir mokestis nebuvo nuskaičiuotas. Galite rinktis kitą laiką.",
        variant: "default",
        duration: 6000,
      });
    }, 150);

    (async () => {
      try {
        const resp = await fetch(`${API}/payments/cancel-booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bookingId: cancelBookingId,
            // Guests have no Clerk session — authorize via the management token we
            // stashed in sessionStorage when starting Stripe Checkout.
            ...(storedToken ? { managementToken: storedToken } : {}),
          }),
        });
        if (resp.ok) {
          await queryClient.invalidateQueries();
          await queryClient.refetchQueries({ queryKey: [`/api/courts/${courtId}/availability`] });
          // Clean up sessionStorage once the DB is updated
          try {
            const ids: number[] = JSON.parse(sessionStorage.getItem("cancelledBookingIds") ?? "[]");
            sessionStorage.setItem("cancelledBookingIds", JSON.stringify(ids.filter(id => id !== cancelBookingId)));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error("[booking_cancelled] cancel error:", err);
      }
    })();
  }, [courtId]);

  const [selectedEquipment, setSelectedEquipment] = useState<Map<string, number>>(new Map());
  interface EquipAvailItem { name: string; pricePerSlot: number; stock: number; available: number; }
  const [equipAvailability, setEquipAvailability] = useState<EquipAvailItem[]>([]);
  const [equipAvailLoading, setEquipAvailLoading] = useState(false);

  interface CourtPhoto { id: number; url: string; caption: string | null; displayOrder: number; }
  const { data: extraPhotos = [] } = useQuery<CourtPhoto[]>({
    queryKey: ["court-photos", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/photos`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!courtId && !isNaN(courtId),
  });
  const allPhotos = useMemo(() => {
    const urls: string[] = [];
    if (court?.imageUrl) urls.push(court.imageUrl);
    for (const p of extraPhotos) urls.push(p.url);
    return urls;
  }, [court?.imageUrl, extraPhotos]);
  // Sport-appropriate hero photo to use when the owner hasn't uploaded any
  // images, so the gallery shows a relevant background instead of a generic
  // initial-letter placeholder. Routed through resolveCourtImage so it stays
  // consistent with how court list cards resolve their fallback.
  const sportFallbackPhoto = useMemo(
    () => resolveCourtImage(null, court?.type),
    [court?.type],
  );

  interface CourtActivity { lastBookedAt: string | null; todayGameCount: number; }
  const { data: activity } = useQuery<CourtActivity>({
    queryKey: ["court-activity", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/activity`);
      if (!r.ok) return { lastBookedAt: null, todayGameCount: 0 };
      return r.json();
    },
    enabled: !!courtId && !isNaN(courtId),
    staleTime: 5_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const favorited = court ? isFavorite(court.id) : false;
  const [localFavorited, setLocalFavorited] = useState(false);
  const [heartPop, setHeartPop] = useState(false);
  const [amenityPopup, setAmenityPopup] = useState<{ label: string; photoUrl: string } | null>(null);
  useEffect(() => { setLocalFavorited(favorited); }, [favorited]);

  const handleToggleFavorite = async () => {
    if (!isSignedIn) return openSignIn();
    const next = !localFavorited;
    setLocalFavorited(next);
    setHeartPop(true);
    setTimeout(() => setHeartPop(false), 300);
    await toggleFavorite(court!.id);
  };

  // Scroll to the booking widget when the URL has #reserve
  useEffect(() => {
    if (!court) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#reserve") return;
    const el = document.getElementById("reserve");
    if (!el) return;
    // Wait a tick so layout settles
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [court?.id]);

  const handleShare = async () => {
    if (!court) return;
    const url = window.location.href;
    const text = `${court.name} — korts.lt`;
    try {
      if (navigator.share) {
        await navigator.share({ title: court.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Nuoroda nukopijuota" });
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({ title: "Nuoroda nukopijuota" });
      }
    }
  };

  const handleCopyContact = async (kind: "address" | "phone", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedContact(kind);
      window.setTimeout(() => {
        setCopiedContact((current) => (current === kind ? null : current));
      }, 1200);
      toast({ title: "Nukopijuota" });
    } catch {
      toast({ title: "Nepavyko nukopijuoti", variant: "destructive" });
    }
  };

  const slots = availability?.slots ?? [];
  // True when at least one slot remains after filtering out past slots on today's date.
  // Prevents rendering an empty grid (no visible buttons, no "no slots" message) when
  // the user views today and all slots have already passed.
  const hasVisibleSlots = (() => {
    if (!slots.length) return false;
    const _now = new Date();
    const isToday =
      date.getFullYear() === _now.getFullYear() &&
      date.getMonth() === _now.getMonth() &&
      date.getDate() === _now.getDate();
    if (!isToday) return true;
    const nowStr = _now.toTimeString().slice(0, 5);
    return slots.some(s => s.startTime > nowStr);
  })();

  const availableEquipment: Array<{ name: string; pricePerSlot: number; stock: number }> = useMemo(() => {
    try {
      const raw: Array<{ name: string; pricePerSlot?: number; pricePerBooking?: number; stock?: number }> =
        court?.rentableItems ? JSON.parse(court.rentableItems) : [];
      return raw.map(r => ({ name: r.name, pricePerSlot: r.pricePerSlot ?? r.pricePerBooking ?? 0, stock: r.stock ?? 1 }));
    } catch { return []; }
  }, [court?.rentableItems]);

  // slotCount: derived from selectedStart/selectedEnd directly (no circular dep on selectedSlotRange)
  const slotCount = useMemo(() => {
    if (selectedStart === null) return 0;
    const end = selectedEnd ?? selectedStart;
    return Math.abs(end - selectedStart) + 1;
  }, [selectedStart, selectedEnd]);

  const equipmentTotal = useMemo(() => {
    let total = 0;
    selectedEquipment.forEach((qty, name) => {
      const item = availableEquipment.find(e => e.name === name);
      if (item && qty > 0) total += item.pricePerSlot * qty * Math.max(1, slotCount);
    });
    return total;
  }, [selectedEquipment, availableEquipment, slotCount]);

  // Selected slot range (selectedStart..selectedEnd inclusive)
  const selectedSlotRange = useMemo(() => {
    if (selectedStart === null || !slots.length) return null;
    const end = selectedEnd ?? selectedStart;
    const rangeStart = Math.min(selectedStart, end);
    const rangeEnd = Math.max(selectedStart, end);
    const range = slots.slice(rangeStart, rangeEnd + 1);
    if (!range.length || !range.every(s => s.isAvailable)) return null;
    const totalMinutes = range.length * 30;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const durationLabel = hours > 0
      ? mins > 0 ? `${hours} val ${mins} min` : `${hours} val`
      : `${mins} min`;
    const courtPrice = range.reduce((sum, s) => sum + s.price, 0);
    return {
      startTime: range[0].startTime,
      endTime: range[range.length - 1].endTime,
      courtPrice,
      totalPrice: courtPrice + equipmentTotal,
      slotCount: range.length,
      durationLabel,
      rangeStart,
      rangeEnd,
    };
  }, [selectedStart, selectedEnd, slots, equipmentTotal]);

  // Fetch real-time equipment availability when slot selection changes
  useEffect(() => {
    if (!selectedSlotRange || availableEquipment.length === 0) {
      setEquipAvailability([]);
      return;
    }
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setEquipAvailLoading(true);
    fetch(`${API}/courts/${courtId}/equipment-availability?date=${dateStr}&startTime=${encodeURIComponent(selectedSlotRange.startTime)}&endTime=${encodeURIComponent(selectedSlotRange.endTime)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: EquipAvailItem[]) => { setEquipAvailability(data); setEquipAvailLoading(false); })
      .catch(() => { setEquipAvailability([]); setEquipAvailLoading(false); });
  }, [selectedSlotRange?.startTime, selectedSlotRange?.endTime, courtId, date, availableEquipment.length]);

  // Handle slot click: select, extend, or deselect
  const handleSlotClick = (idx: number) => {
    if (!slots[idx]?.isAvailable) {
      const slot = slots[idx];
      if (slot) {
        const [hh, mm] = slot.startTime.split(":").map(Number);
        const endMin = hh * 60 + mm + 30;
        const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
        setWaitlistSlot({ startTime: slot.startTime, endTime });
        setWaitlistOpen(true);
      }
      return;
    }

    if (selectedStart === null) {
      setSelectedStart(idx);
      setSelectedEnd(null);
      return;
    }

    const end = selectedEnd ?? selectedStart;
    const rangeStart = Math.min(selectedStart, end);
    const rangeEnd = Math.max(selectedStart, end);

    // Clicked within selection → deselect all
    if (idx >= rangeStart && idx <= rangeEnd) {
      setSelectedStart(null);
      setSelectedEnd(null);
      return;
    }

    // Try to extend the range; check all slots in new range are available
    const newStart = idx < rangeStart ? idx : rangeStart;
    const newEnd = idx > rangeEnd ? idx : rangeEnd;
    const allAvailable = slots.slice(newStart, newEnd + 1).every(s => s.isAvailable);
    if (allAvailable) {
      setSelectedStart(newStart);
      setSelectedEnd(newEnd);
    } else {
      // Can't extend (unavailable slot in path) → start fresh
      setSelectedStart(idx);
      setSelectedEnd(null);
    }
  };

  const handleReserve = async (overrideData?: { customerName: string; customerEmail: string; customerPhone?: string }) => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }

    let customerName: string;
    let customerEmail: string;
    let customerPhone: string | undefined;

    if (overrideData) {
      customerName = overrideData.customerName;
      customerEmail = overrideData.customerEmail;
      customerPhone = overrideData.customerPhone;
    } else {
      if (!isSignedIn || !user) { openSignIn(); return; }
      const anyEmail = (user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "").trim();
      const anyName = (user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || anyEmail.split("@")[0] || "").trim();
      customerName = anyName || "Vartotojas";
      customerEmail = anyEmail || `${customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    }

    try {
      const rentedItemsPayload: Array<{ name: string; pricePerBooking: number; quantity: number }> = [];
      selectedEquipment.forEach((qty, name) => {
        if (qty > 0) {
          const item = availableEquipment.find(e => e.name === name);
          if (item) rentedItemsPayload.push({ name, pricePerBooking: item.pricePerSlot, quantity: qty });
        }
      });
      const booking = await createBooking.mutateAsync({
        data: {
          courtId,
          customerName,
          customerEmail,
          customerPhone,
          date: dateStr,
          startTime: selectedSlotRange.startTime,
          endTime: selectedSlotRange.endTime,
          rentedItems: rentedItemsPayload.length > 0 ? JSON.stringify(rentedItemsPayload) : undefined,
        }
      });

      const totalPrice = Number(booking.totalPrice ?? 0);
      const mgmtToken = booking.managementToken ?? null;
      const isGuest = !!mgmtToken;

      if (totalPrice > 0) {
        // Paid booking — go through Stripe Checkout. Guests authorize the
        // /payments/create-checkout call by passing their managementToken.
        const origin = window.location.origin;
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const successUrl = isGuest
          ? `${origin}${base}/guest/booking/${mgmtToken}?paid=1`
          : `${origin}${base}/booking-confirmed?id=${booking.id}`;
        const checkoutResp = await fetch(`${API}/payments/create-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            ...(isGuest ? { managementToken: mgmtToken } : {}),
            ...(linkGameId ? { linkGameId } : {}),
            successUrl,
            cancelUrl: `${origin}${base}/courts/${courtId}?booking_cancelled=1&bookingId=${booking.id}`,
          }),
        });
        if (!checkoutResp.ok) throw new Error("Checkout session failed");
        const { url } = await checkoutResp.json();
        sessionStorage.setItem("stripeCancel_pending", JSON.stringify({
          bookingId: booking.id,
          courtId,
          ts: Date.now(),
          // Persist guest token so /payments/cancel-booking can authorize on the
          // unauth'd Stripe-cancel return path.
          ...(isGuest ? { managementToken: mgmtToken } : {}),
        }));
        window.location.href = url;
      } else {
        // Free booking — confirm immediately
        const resp = await fetch(`${API}/payments/confirm-free`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            ...(isGuest ? { managementToken: mgmtToken } : {}),
            ...(linkGameId ? { linkGameId } : {}),
          }),
        });
        if (!resp.ok) throw new Error("Confirm failed");
        if (isGuest) {
          navigate(`/guest/booking/${mgmtToken}`);
        } else {
          navigate(`/booking-confirmed?id=${booking.id}`);
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string; code?: string; item?: string; available?: number }; status?: number } | null;
      const detail = apiErr?.data?.error ?? (err instanceof Error ? err.message : undefined);
      const isEquipmentError = apiErr?.data?.code === "EQUIPMENT_UNAVAILABLE";
      console.error("[handleReserve] booking error:", err);
      if (isEquipmentError) {
        // Refresh availability data so UI updates immediately
        if (selectedSlotRange) {
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          fetch(`${API}/courts/${courtId}/equipment-availability?date=${dateStr}&startTime=${encodeURIComponent(selectedSlotRange.startTime)}&endTime=${encodeURIComponent(selectedSlotRange.endTime)}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then((data: EquipAvailItem[]) => setEquipAvailability(data))
            .catch(() => {});
        }
      }
      toast({
        title: isEquipmentError ? "Įranga nebepasiekiama" : "Rezervacija nepavyko",
        description: detail ? `${detail}` : "Bandykite dar kartą.",
        variant: "destructive",
      });
    }
  };

  const handleSplitReserve = async () => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }
    if (!isSignedIn || !user) { openSignIn(); return; }
    const anyEmail = (user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "").trim();
    const anyName = (user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || anyEmail.split("@")[0] || "").trim();
    const customerName = anyName || "Vartotojas";
    const customerEmail = anyEmail;
    if (!customerEmail) {
      toast({ title: "El. pašto adresas nerastas", description: "Pridėkite el. paštą prie paskyros.", variant: "destructive" });
      return;
    }
    setSplitPending(true);
    try {
      const resp = await fetch(`${API}/games/checkout-split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          date: dateStr,
          startTime: selectedSlotRange.startTime,
          endTime: selectedSlotRange.endTime,
          totalSlots: splitCount,
          sport: (court as any)?.sport ?? "tennis",
          customerName,
          customerEmail,
          isPublic: isPublicMatch,
          matchType: splitMatchType,
          ...(isPublicMatch && { minSkillLevel: splitMinSkill, maxSkillLevel: splitMaxSkill }),
          ...(linkGameId ? { linkGameId } : {}),
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Nepavyko sukurti mokėjimo");
      }
      const { url, shareToken } = await resp.json();
      sessionStorage.setItem("splitShareToken", shareToken ?? "");
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bandykite dar kartą.";
      toast({ title: "Klaida", description: msg, variant: "destructive" });
    } finally {
      setSplitPending(false);
    }
  };

  const handleRecurringBookings = async () => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }
    if (!isSignedIn || !user) { openSignIn(); return; }
    const anyEmail = (user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "").trim();
    const anyName = (user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || anyEmail.split("@")[0] || "").trim();
    const customerName = anyName || "Vartotojas";
    const customerEmail = anyEmail;
    if (!customerEmail) {
      toast({ title: "El. pašto adresas nerastas", variant: "destructive" });
      return;
    }
    const recurringGroupId = crypto.randomUUID();
    let successCount = 0;
    for (let i = 0; i < recurringWeeks; i++) {
      const futureDate = new Date(date);
      futureDate.setDate(futureDate.getDate() + i * 7);
      const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
      try {
        await createBooking.mutateAsync({
          data: {
            courtId,
            customerName,
            customerEmail,
            date: futureDateStr,
            startTime: selectedSlotRange.startTime,
            endTime: selectedSlotRange.endTime,
            recurringGroupId,
          } as any,
        });
        successCount++;
      } catch {
        // Skip conflicts for individual weeks silently
      }
    }
    if (successCount > 0) {
      toast({
        title: `${successCount} rezervacij${successCount === 1 ? "a" : successCount < 10 ? "os" : "ų"} sukurta!`,
        description: Number(court?.pricePerHour ?? 0) > 0 ? "Apmokėkite kiekvieną atskirai skiltyje 'Mano rezervacijos'." : undefined,
      });
      setSelectedStart(null);
      setSelectedEnd(null);
      setRecurringEnabled(false);
    } else {
      toast({ title: "Nepavyko sukurti rezervacijų", description: "Pasirinkti laikai gali būti jau užimti.", variant: "destructive" });
    }
  };

  const isPending = createBooking.isPending;
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const avgRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const courtBookings = useMemo(() => {
    const localCancelledIds: number[] = (() => {
      try { return JSON.parse(sessionStorage.getItem("cancelledBookingIds") ?? "[]"); } catch { return []; }
    })();
    return (bookings ?? [])
      .filter((booking) =>
        booking.courtId === courtId &&
        booking.status !== "cancelled" &&
        !localCancelledIds.includes(booking.id)
      )
      .sort((a, b) => {
        const ka = `${String(a.date).slice(0, 10)} ${a.startTime}`;
        const kb = `${String(b.date).slice(0, 10)} ${b.startTime}`;
        return kb.localeCompare(ka);
      });
  }, [bookings, courtId]);


  if (courtLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-[400px] w-full rounded-xl mb-8" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!court) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Aikštelė nerasta</h1>
          <Button onClick={() => setLocation("/courts")}>Grįžti</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Full-screen Lightbox */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/97 flex flex-col"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-white/60 text-sm tabular-nums">{activePhotoIdx + 1} / {allPhotos.length}</span>
            <span className="text-white font-semibold text-sm truncate flex-1 text-center px-4">{court.name}</span>
            <button
              onClick={() => setGalleryOpen(false)}
              className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="flex-1 relative flex items-center justify-center min-h-0 px-12"
            onClick={e => e.stopPropagation()}
          >
            <img
              key={activePhotoIdx}
              src={resolveCourtImage(allPhotos[activePhotoIdx]) ?? ""}
              alt=""
              className="max-h-full max-w-full object-contain rounded-lg"
            />
            {allPhotos.length > 1 && (
              <>
                <button
                  onClick={() => setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-all hover:scale-105"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActivePhotoIdx(i => (i + 1) % allPhotos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-3 transition-all hover:scale-105"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          <div
            className="shrink-0 py-3 px-4 overflow-x-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex gap-2 w-max mx-auto">
              {allPhotos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === activePhotoIdx ? "border-white scale-105" : "border-white/20 hover:border-white/50"
                  }`}
                >
                  <img src={resolveCourtImage(url) ?? ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 pt-4 pb-24 md:pb-24">
        <div className="grid md:grid-cols-3 gap-4 items-start">

          {/* Left column: Gallery + Court Info */}
          <div className="md:col-span-2 space-y-6">

            {/* 3-photo gallery inside the container */}
            <div className="rounded-2xl overflow-hidden bg-zinc-900 relative h-[48vh] min-h-[320px]">
              {allPhotos.length === 0 ? (
                sportFallbackPhoto ? (
                  <div className="w-full h-full relative">
                    <img
                      src={sportFallbackPhoto}
                      alt={court.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-3">
                    <Images className="h-16 w-16" />
                    <span className="text-5xl font-bold">{court.name.charAt(0)}</span>
                  </div>
                )
              ) : (
                <>
                  {/* Desktop: 3-photo grid — 1 large left + 2 stacked right */}
                  <div className="hidden md:grid grid-cols-[3fr_2fr] grid-rows-2 h-full gap-0.5">
                    {/* Large primary photo */}
                    <div
                      className="row-span-2 relative cursor-pointer overflow-hidden group"
                      onClick={() => { setActivePhotoIdx(0); setGalleryOpen(true); }}
                    >
                      <img
                        src={resolveCourtImage(allPhotos[0]) ?? ""}
                        alt={court.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    {/* Photo 2 (top-right) */}
                    <div
                      className="relative cursor-pointer overflow-hidden group"
                      onClick={() => { setActivePhotoIdx(allPhotos[1] ? 1 : 0); setGalleryOpen(true); }}
                    >
                      {allPhotos[1] ? (
                        <img
                          src={resolveCourtImage(allPhotos[1]) ?? ""}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}
                    </div>
                    {/* Photo 3 (bottom-right) — "show all" overlay if more */}
                    <div
                      className="relative cursor-pointer overflow-hidden group"
                      onClick={() => { setActivePhotoIdx(allPhotos[2] ? 2 : 0); setGalleryOpen(true); }}
                    >
                      {allPhotos[2] ? (
                        <>
                          <img
                            src={resolveCourtImage(allPhotos[2]) ?? ""}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {allPhotos.length > 3 && (
                            <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white gap-1 group-hover:bg-black/65 transition-colors">
                              <Images className="w-5 h-5" />
                              <span className="font-bold text-lg">+{allPhotos.length - 3}</span>
                              <span className="text-xs text-white/80">daugiau</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}
                    </div>
                  </div>

                  {/* Mobile: single hero */}
                  <div
                    className="md:hidden w-full h-full relative cursor-pointer"
                    onClick={() => setGalleryOpen(true)}
                  >
                    <img
                      src={resolveCourtImage(allPhotos[0]) ?? ""}
                      alt={court.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  </div>

                  {/* "Show all photos" button */}
                  {allPhotos.length > 1 && (
                    <button
                      onClick={() => setGalleryOpen(true)}
                      className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm text-zinc-900 dark:text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-white/50 hover:bg-white hover:shadow-xl transition-all z-10"
                    >
                      <Images className="w-3.5 h-3.5" />
                      Visos {allPhotos.length} nuotraukos
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Court Info (below gallery in left column) */}
            <div className="space-y-8">
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0 flex-1">
                  {/* Badges */}
                  <div className="flex gap-2 items-center mb-2">
                    <Badge variant="default" className="bg-primary text-primary-foreground">{court.type}</Badge>
                    {court.isIndoor && <Badge variant="secondary">Indoor</Badge>}
                  </div>

                  {/* Review score above name */}
                  {avgRating && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-2.5 py-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-sm text-yellow-600 dark:text-yellow-400">{avgRating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({reviews?.length})</span>
                      </div>
                    </div>
                  )}

                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{court.name}</h1>

                  {/* Clickable address */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${court.address}, ${court.city}, Lietuva`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors group"
                  >
                    <MapPin className="w-4 h-4 shrink-0 group-hover:text-primary" />
                    <span className="text-sm group-hover:underline">{court.address}, {court.city}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </a>

                  <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    Max {court.maxPlayers} žaidėjai
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-1">
                  {canEdit && (court as any).facilityId && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setLocation(`/owner/facility/${(court as any).facilityId}/court/${court.id}/edit`)}
                      aria-label="Edit court"
                      title="Redaguoti aikštelę"
                      className="transition-all duration-150 hover:scale-110 hover:shadow-md hover:border-primary/60 hover:bg-primary/5 hover:text-primary active:scale-95"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleToggleFavorite}
                    aria-label={localFavorited ? "Remove from favorites" : "Add to favorites"}
                    className={`transition-all duration-150 hover:scale-110 hover:shadow-md active:scale-95 ${
                      localFavorited
                        ? "border-red-400/60 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400"
                        : "hover:border-red-300 hover:bg-red-500/5 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 transition-all duration-200 ${
                        localFavorited ? "fill-red-500 text-red-500" : ""
                      } ${heartPop ? "scale-125" : "scale-100"}`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    aria-label="Share court"
                    className="transition-all duration-150 hover:scale-110 hover:shadow-md hover:border-blue-400/60 hover:bg-blue-500/5 hover:text-blue-500 active:scale-95"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (!isSignedIn) return openSignIn();
                      setLocation("/profile?tab=messages");
                    }}
                    aria-label="Message court"
                    className="transition-all duration-150 hover:scale-110 hover:shadow-md hover:border-primary/60 hover:bg-primary/5 hover:text-primary active:scale-95"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Apie aikštelę</h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {court.description || "Aukštos kokybės sporto aikštelė, tinkama varžyboms, treniruotėms ir draugiškoms rungtynėms."}
              </p>
            </div>

            {/* Amenities */}
            {court.amenities && court.amenities.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Patogumai</h2>
                {(() => {
                  let amenityPhotosMap: Record<string, string> = {};
                  try { amenityPhotosMap = court.amenityPhotos ? JSON.parse(court.amenityPhotos) : {}; } catch {}
                  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                  return (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {court.amenities.map((amenity, i) => {
                        const { label, icon: Icon } = getAmenityMeta(amenity);
                        const photoUrl = amenityPhotosMap[amenity];
                        const hasPhoto = !!photoUrl;
                        return hasPhoto ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAmenityPopup({ label, photoUrl: `${base}/${photoUrl}` })}
                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border bg-muted/30 text-center hover:border-primary hover:bg-primary/5 transition-all group relative"
                            title={`Žiūrėti nuotrauką: ${label}`}
                          >
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium leading-tight">{label}</span>
                            <Camera className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-primary/50 group-hover:text-primary transition-colors" />
                          </button>
                        ) : (
                          <div key={i} className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border bg-muted/30 text-center">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium leading-tight">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Surface specifications */}
            <SurfaceSpecs
              surface={court.surface}
              surfaceSpeed={(court as any).surfaceSpeed}
              surfaceBounce={(court as any).surfaceBounce}
            />

            {/* Amenity photo popup */}
            {amenityPopup && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={() => setAmenityPopup(null)}
              >
                <div
                  className="relative max-w-lg w-full bg-card rounded-2xl overflow-hidden shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">{amenityPopup.label}</span>
                    <button
                      onClick={() => setAmenityPopup(null)}
                      className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <img
                    src={amenityPopup.photoUrl}
                    alt={amenityPopup.label}
                    className="w-full object-cover max-h-80"
                  />
                </div>
              </div>
            )}

            {/* Rentable Items */}
            {(() => {
              try {
                const items: Array<{name: string; pricePerSlot?: number; pricePerBooking?: number; stock?: number}> =
                  court.rentableItems ? JSON.parse(court.rentableItems) : [];
                if (!items.length) return null;
                return (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                      Nuomojama įranga
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map((item, i) => {
                        const price = item.pricePerSlot ?? item.pricePerBooking ?? 0;
                        const stock = item.stock ?? 1;
                        return (
                          <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg leading-none">{getEquipmentIcon(item.name)}</span>
                              <span className="font-medium text-sm truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{formatPriceLabel(price)}</Badge>
                              <span className="text-xs text-muted-foreground">{stock} vnt.</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Activity Indicators */}
            {activity && (() => {
              const parsed = activity.lastBookedAt ? new Date(activity.lastBookedAt) : null;
              const lastBookedValid = parsed && !isNaN(parsed.getTime()) ? parsed : null;
              const formatted = lastBookedValid
                ? lastBookedValid.toLocaleString(locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "lt-LT", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              return (
                <div className="flex flex-wrap gap-2">
                  {formatted ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-400/20 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("courts.activity.lastBooked", { when: formatted })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("courts.activity.notReservedYet")}
                    </div>
                  )}
                  {activity.todayGameCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
                      <Users className="w-3.5 h-3.5" />
                      Šiandien {activity.todayGameCount} {activity.todayGameCount === 1 ? "žaidimas" : "žaidimai"}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Membership Plans */}
            <CourtMembershipSection courtId={court.id} />


            <Separator />

            {/* Location & Contact */}
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold">Vieta ir kontaktai</h2>

              {/* Map embed */}
              <div className="rounded-xl overflow-hidden border h-56 w-full relative group">
                <iframe
                  title="Aikštelės vieta"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${court.address}, ${court.city}, Lietuva`)}&hl=lt&z=16&output=embed`}
                  className="w-full h-full transition-[filter] duration-300"
                  style={theme === "dark" ? { filter: "invert(90%) hue-rotate(180deg) saturate(0.85) brightness(0.9)" } : undefined}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${court.address}, ${court.city}, Lietuva`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 bg-white text-zinc-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-md flex items-center gap-1.5 hover:bg-primary hover:text-white transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Gauti kryptis
                </a>
              </div>

              {/* Contact info grid */}
              <div className="grid sm:grid-cols-2 gap-4">

                {/* Address card */}
                <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Adresas</p>
                    <p className="font-semibold text-sm">{court.address}</p>
                    <p className="text-sm text-muted-foreground">{court.city}, Lietuva</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(court.name + ", " + court.address + ", " + court.city)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Atidaryti žemėlapyje <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyContact("address", `${court.address}, ${court.city}, Lietuva`)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Kopijuoti adresą"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedContact === "address" ? "Nukopijuota" : "Kopijuoti"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Message owner card */}
                {isSignedIn && (court as any).ownerUserId && (court as any).ownerUserId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => openChat({
                      userId: (court as any).ownerUserId,
                      userName: (court as any).ownerName || "Savininkas",
                      ctxType: "court",
                      ctxId: court.id,
                    })}
                    className="flex gap-3 p-4 bg-muted/30 rounded-xl border hover:bg-primary/5 hover:border-primary/30 transition-colors text-left"
                  >
                    <MessageSquare className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Klausimas savininkui</p>
                      <p className="font-semibold text-sm">Parašyti žinutę</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Pokalbis apie šią aikštelę</p>
                    </div>
                  </button>
                )}

                {/* Phone card */}
                {court.phone && (
                  <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
                    <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Telefonas</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`tel:${court.phone}`}
                          className="font-semibold text-sm hover:text-primary transition-colors"
                        >
                          {court.phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyContact("phone", court.phone ?? "")}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          aria-label="Kopijuoti telefoną"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedContact === "phone" ? "Nukopijuota" : "Kopijuoti"}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Spustelėkite, kad paskambintumėte</p>
                    </div>
                  </div>
                )}


              </div>

              {/* Social media links */}
              {(court.socialFacebook || court.socialInstagram || court.socialWhatsapp || court.socialWebsite) && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-muted-foreground font-medium">Socialiniai:</span>
                  <div className="flex items-center gap-2">
                    {court.socialFacebook && (
                      <a href={court.socialFacebook} target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-[#1877f2]/10 hover:bg-[#1877f2]/20 flex items-center justify-center transition-colors group"
                        aria-label="Facebook"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#1877f2]"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.016 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.027 1.793-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.268h3.328l-.532 3.49h-2.796v8.437C19.612 23.089 24 18.097 24 12.073z"/></svg>
                      </a>
                    )}
                    {court.socialInstagram && (
                      <a href={court.socialInstagram} target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-pink-500/10 hover:bg-pink-500/20 flex items-center justify-center transition-colors"
                        aria-label="Instagram"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4">
                          <defs><radialGradient id="ig-detail" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs>
                          <path fill="url(#ig-detail)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                        </svg>
                      </a>
                    )}
                    {court.socialWhatsapp && (
                      <a href={court.socialWhatsapp} target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-[#25d366]/10 hover:bg-[#25d366]/20 flex items-center justify-center transition-colors"
                        aria-label="WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25d366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                      </a>
                    )}
                    {court.socialWebsite && (
                      <a href={court.socialWebsite} target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 border flex items-center justify-center transition-colors"
                        aria-label="Svetainė"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Coaches Section */}
            <CoachesSectionForCourt courtId={courtId} />

          </div>{/* end space-y-8 */}
          </div>{/* end md:col-span-2 */}

          {/* Booking Widget */}
          <div className="relative" id="reserve">
            <div className="md:sticky md:top-[4.25rem] bg-card border rounded-2xl shadow-xl md:overflow-hidden md:max-h-[calc(100vh-5rem)] flex flex-col">

              {/* Widget title header */}
              <div className="px-5 py-3.5 border-b bg-card shrink-0 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Rezervuoti aikštelę</h3>
                {(court as any).hasSmartLock && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-400/20 px-2 py-0.5 rounded-full shrink-0">
                    <Lock className="w-3 h-3" />
                    Smart lock
                  </span>
                )}
              </div>

              <div className="p-5 space-y-5 md:overflow-y-auto md:flex-1 md:min-h-0">

              {/* Step 1: Date */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Pasirinkite datą
                </p>
                <div className="border rounded-xl bg-background flex justify-center py-2 pb-3">
                  <DateCalendar
                    selected={date}
                    onSelect={(d) => {
                      vibrateTap();
                      setDate(d);
                      setSelectedStart(null);
                      setSelectedEnd(null);
                      setSelectedEquipment(new Map());
                    }}
                  />
                </div>
                {/* Weather forecast for selected date — outdoor courts only */}
                <WeatherWidget
                  lat={(court as any).latitude}
                  lon={(court as any).longitude}
                  date={dateStr}
                  isIndoor={court.isIndoor}
                />
              </div>

              {/* Step 2: Time slot selection */}
              <div>
                <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  Pasirinkite laiką
                </p>
                <p className="text-xs text-muted-foreground mb-2">Spustelėkite vieną ar kelis 30 min laikotarpius</p>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Pasirinkta</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground/20 inline-block" /> Užimta</span>
                </div>

                {availabilityLoading ? (
                  <div className="grid grid-cols-4 gap-1">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full rounded-md" />
                    ))}
                  </div>
                ) : hasVisibleSlots ? (
                  <div className="grid grid-cols-4 gap-1">
                    {slots.map((slot, idx) => {
                      const selectedDate = new Date(date);
                      const now = new Date();
                      const isToday =
                        selectedDate.getFullYear() === now.getFullYear() &&
                        selectedDate.getMonth() === now.getMonth() &&
                        selectedDate.getDate() === now.getDate();
                      if (isToday && slot.startTime <= now.toTimeString().slice(0, 5)) return null;
                      const rangeStart = selectedSlotRange?.rangeStart ?? null;
                      const rangeEnd = selectedSlotRange?.rangeEnd ?? null;
                      const isSelected = rangeStart !== null && rangeEnd !== null
                        ? idx >= rangeStart && idx <= rangeEnd
                        : selectedStart === idx && selectedEnd === null;
                      const isRangeStart = idx === rangeStart;
                      const isRangeEnd = idx === rangeEnd;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => {
                            vibrateTap();
                            handleSlotClick(idx);
                          }}
                          className={`relative rounded-md border px-0.5 py-1.5 text-[11px] font-medium transition-all focus:outline-none ${
                            !slot.isAvailable
                            ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md scale-[0.97]"
                              : "bg-background text-foreground border-border hover:border-primary hover:bg-primary/10 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                          }`}
                        >
                          <div className="text-center leading-tight">
                            <div className={`flex items-center justify-center gap-0.5 ${isRangeStart || isRangeEnd ? "font-bold" : ""}`}>
                              {slot.startTime}
                            </div>
                            <div className={`mt-0.5 flex items-center justify-center gap-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              <Euro className="w-2.5 h-2.5" />
                              <span>{slot.price.toFixed(0)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-muted rounded-xl text-sm text-muted-foreground flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    Šiai dienai laisvų laikų nėra.
                  </div>
                )}
              </div>

              {/* Recurring booking toggle */}
              {selectedSlotRange && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRecurringEnabled(v => !v)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${recurringEnabled ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-transparent hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className={`w-4 h-4 ${recurringEnabled ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-left">
                        <p className="text-sm font-medium">Kartotinė rezervacija</p>
                        <p className="text-xs text-muted-foreground">Rezervuoti kas savaitę</p>
                      </div>
                    </div>
                    <span className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${recurringEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurringEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                  {recurringEnabled && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-primary/5 border-primary/20 text-sm">
                      <RotateCcw className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-muted-foreground">Savaitės:</span>
                      <select
                        value={recurringWeeks}
                        onChange={e => setRecurringWeeks(Number(e.target.value))}
                        className="ml-auto font-semibold bg-background border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {[2, 3, 4, 6, 8, 12].map(n => (
                          <option key={n} value={n}>{n} sav.</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Equipment rental — shown when slots are selected and court has equipment */}
              {selectedSlotRange && availableEquipment.length > 0 && (
                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setEquipmentOpen(o => !o)}
                      className="flex-1 flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        Pridėti įrangą
                        {equipmentTotal > 0 && (
                          <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                            +{equipmentTotal.toFixed(2)} €
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        {equipAvailLoading && <span className="text-xs text-muted-foreground animate-pulse">Tikrinama...</span>}
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${equipmentOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {equipmentTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedEquipment(new Map())}
                        className="shrink-0 px-3 py-2.5 text-destructive hover:bg-destructive/10 transition-colors border-l"
                        aria-label="Pašalinti visą įrangą"
                        title="Pašalinti visą įrangą"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {equipmentOpen && (
                  <div className="px-3 pb-3 space-y-1.5 border-t pt-2.5">
                    {availableEquipment.map(item => {
                      const availInfo = equipAvailability.find(e => e.name === item.name);
                      const realAvailable = availInfo ? availInfo.available : item.stock;
                      const qty = selectedEquipment.get(item.name) ?? 0;
                      const isSelected = qty > 0;
                      const isUnavailable = realAvailable === 0;
                      const maxQty = Math.max(0, realAvailable);
                      const itemTotal = item.pricePerSlot * qty * slotCount;
                      return (
                        <div key={item.name} className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-colors ${isUnavailable ? "opacity-50 bg-muted/20 border-transparent" : isSelected ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-transparent"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              disabled={isUnavailable}
                              onClick={() => {
                                if (isUnavailable) return;
                                setSelectedEquipment(prev => {
                                  const next = new Map(prev);
                                  if (isSelected) next.delete(item.name);
                                  else next.set(item.name, 1);
                                  return next;
                                });
                              }}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isUnavailable ? "border-muted-foreground/20 cursor-not-allowed" : isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                            >
                              {isSelected && !isUnavailable && <Check className="w-3 h-3" />}
                            </button>
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{item.name}</span>
                              {isUnavailable ? (
                                <span className="text-[10px] text-destructive font-medium">Nepasiekiama</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Likę: {realAvailable} vnt.</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected && !isUnavailable && (
                              <div className="flex items-center gap-1 bg-background border rounded-md">
                                <button type="button" onClick={() => {
                                  setSelectedEquipment(prev => {
                                    const next = new Map(prev);
                                    if (qty <= 1) next.delete(item.name);
                                    else next.set(item.name, qty - 1);
                                    return next;
                                  });
                                }} className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">−</button>
                                <span className="text-xs font-medium w-4 text-center">{qty}</span>
                                <button type="button" onClick={() => {
                                  setSelectedEquipment(prev => {
                                    const next = new Map(prev);
                                    if (qty < maxQty) next.set(item.name, qty + 1);
                                    return next;
                                  });
                                }} disabled={qty >= maxQty} className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">+</button>
                              </div>
                            )}
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground whitespace-nowrap">{formatPriceLabel(item.pricePerSlot)}</div>
                              {isSelected && slotCount > 1 && <div className="text-[10px] text-primary font-medium">{itemTotal.toFixed(2)}€ iš viso</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {slotCount > 1 && (
                      <p className="text-[10px] text-muted-foreground pl-1">Kaina × kiekis × {slotCount} laikotarpiai</p>
                    )}
                  </div>
                  )}
                </div>
              )}

              {/* Split Payment toggle — only for paid bookings when signed in */}
              {selectedSlotRange && isSignedIn && selectedSlotRange.totalPrice > 0 && (
                <div className="rounded-xl border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSplitEnabled(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Skaidyti mokėjimą
                      {splitEnabled && (
                        <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                          {splitCount} žaid.
                        </span>
                      )}
                    </span>
                    <span className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${splitEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${splitEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                  {splitEnabled && (
                    <div className="px-3 pb-3 border-t pt-2.5 space-y-2 bg-muted/10">
                      <p className="text-xs text-muted-foreground">Kiekvienas žaidėjas moka savo dalį. Dalinkitės nuoroda po apmokėjimo.</p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium flex-1">Žaidėjų skaičius</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors font-bold text-lg leading-none"
                            disabled={splitCount <= 2}
                          >−</button>
                          <span className="text-base font-bold w-5 text-center">{splitCount}</span>
                          <button
                            type="button"
                            onClick={() => setSplitCount(c => Math.min(8, c + 1))}
                            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors font-bold text-lg leading-none"
                            disabled={splitCount >= 8}
                          >+</button>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="text-muted-foreground">Jūsų dalis (1/{splitCount})</span>
                        <span className="font-bold text-primary">{(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €</span>
                      </div>

                      {/* Public match sub-toggle — hidden when upgrading an existing game */}
                      {!linkGameId && (
                      <div className="border-t pt-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => setIsPublicMatch(o => !o)}
                          className="w-full flex items-center justify-between text-sm hover:opacity-80 transition-opacity"
                        >
                          <span className="font-medium flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-primary" />
                            Ieškau žaidėjų (Viešas mačas)
                          </span>
                          <span className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${isPublicMatch ? "bg-primary" : "bg-muted-foreground/30"}`}>
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${isPublicMatch ? "translate-x-4" : "translate-x-0.5"}`} />
                          </span>
                        </button>
                        {isPublicMatch && (
                          <div className="space-y-2 pl-5">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Lygio reikalavimas: {splitMinSkill.toFixed(1)} – {splitMaxSkill.toFixed(1)}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-7 shrink-0">min</span>
                                <input
                                  type="range" min="1" max="7" step="0.5"
                                  value={splitMinSkill}
                                  onChange={e => setSplitMinSkill(Math.min(parseFloat(e.target.value), splitMaxSkill - 0.5))}
                                  className="flex-1 accent-primary h-1.5"
                                />
                                <span className="text-xs font-semibold w-7 text-right shrink-0">{splitMinSkill.toFixed(1)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-7 shrink-0">max</span>
                                <input
                                  type="range" min="1" max="7" step="0.5"
                                  value={splitMaxSkill}
                                  onChange={e => setSplitMaxSkill(Math.max(parseFloat(e.target.value), splitMinSkill + 0.5))}
                                  className="flex-1 accent-primary h-1.5"
                                />
                                <span className="text-xs font-semibold w-7 text-right shrink-0">{splitMaxSkill.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setSplitMatchType("casual")}
                                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${splitMatchType === "casual" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"}`}
                              >
                                Draugiškas
                              </button>
                              <button
                                type="button"
                                onClick={() => setSplitMatchType("competitive")}
                                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${splitMatchType === "competitive" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40"}`}
                              >
                                ⚔️ Reitinginis
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Booking summary — shown inline below slot grid once something is selected */}
              {selectedSlotRange ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suvestinė</span>
                    <button
                      onClick={() => { setSelectedStart(null); setSelectedEnd(null); setSelectedEquipment(new Map()); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors rounded-lg px-2 py-1 hover:bg-destructive/10"
                      title="Išvalyti pasirinkimą"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Išvalyti
                    </button>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Laikas</span>
                    <span className="font-semibold">{selectedSlotRange.startTime} – {selectedSlotRange.endTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trukmė</span>
                    <span className="font-medium">{selectedSlotRange.durationLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aikštelė</span>
                    <span className="font-medium">{selectedSlotRange.courtPrice.toFixed(2)} €</span>
                  </div>
                  {equipmentTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Įranga</span>
                      <span className="font-medium">{equipmentTotal.toFixed(2)} €</span>
                    </div>
                  )}
                  <CancellationTimeline
                    hoursUntilStart={(() => {
                      const now = new Date();
                      const start = new Date(`${dateStr}T${selectedSlotRange.startTime}:00`);
                      return (start.getTime() - now.getTime()) / (1000 * 60 * 60);
                    })()}
                  />
                  <Separator className="my-1" />
                  {splitEnabled ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Bendra kaina</span>
                        <span className="font-medium">{selectedSlotRange.totalPrice.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between font-bold text-base">
                        <span>Jūsų dalis (1/{splitCount})</span>
                        <span className="text-primary">{(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-bold text-base">
                      <span>Iš viso</span>
                      <span className="text-primary">{selectedSlotRange.totalPrice.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
              ) : selectedStart !== null ? (
                <p className="text-xs text-center text-muted-foreground py-1">
                  Spustelėkite dar vieną laikotarpį, kad prailgintumėte rezervaciją, arba tą patį – kad atšauktumėte
                </p>
              ) : null}


              {/* Past bookings for this court */}
              {user && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Jūsų rezervacijos
                      </p>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setLocation("/bookings")}>
                        Visos
                      </Button>
                    </div>
                    {courtBookings.length === 0 ? (
                      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Šioje aikštelėje rezervacijų nėra.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {courtBookings.slice(0, 3).map((booking) => (
                          <div key={booking.id} className="rounded-xl border bg-muted/15 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{format(parseISO(String(booking.date).split("T")[0]), "yyyy-MM-dd")}</p>
                                <p className="text-xs text-muted-foreground">{booking.startTime} – {booking.endTime}</p>
                              </div>
                              <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="shrink-0">
                                {booking.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              </div>

              {/* Desktop sticky reserve footer — always visible */}
              <div className="hidden md:flex flex-col gap-2 border-t bg-card px-4 py-3 rounded-b-2xl shrink-0">
                {selectedSlotRange && (
                  <p className="text-[11px] text-muted-foreground/80 leading-snug">
                    {t("booking.policyNote")}
                  </p>
                )}
                <div className="flex items-center gap-3">
                {selectedSlotRange ? (
                  <>
                    <button
                      onClick={() => { setSelectedStart(null); setSelectedEnd(null); setSelectedEquipment(new Map()); }}
                      className="w-9 h-9 rounded-xl border border-border bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors shrink-0"
                      title="Išvalyti pasirinkimą"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{selectedSlotRange.startTime} – {selectedSlotRange.endTime} · {selectedSlotRange.durationLabel}</p>
                      <p className="font-bold text-base text-primary leading-tight">
                        {splitEnabled
                          ? `${(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €`
                          : `${selectedSlotRange.totalPrice.toFixed(2)} €`}
                      </p>
                    </div>
                    {!clerkLoaded ? (
                      <div className="h-10 w-28 rounded-xl bg-muted animate-pulse shrink-0" />
                    ) : isSignedIn ? (
                      <Button
                        onClick={() => splitEnabled ? handleSplitReserve() : recurringEnabled ? handleRecurringBookings() : setSummaryOpen(true)}
                        className="button-primary h-10 px-5 font-semibold gap-2 shrink-0"
                        disabled={isPending || splitPending}
                      >
                        {(isPending || splitPending) ? "…" : linkGameId ? "Patvirtinti ir priskirti mačui" : splitEnabled ? "Mokėti dalį" : recurringEnabled ? `${recurringWeeks}× Rezervuoti` : "Rezervuoti"}
                      </Button>
                    ) : (
                      <Button onClick={() => setGuestCheckoutOpen(true)} className="button-primary h-10 px-5 font-semibold gap-2 shrink-0" disabled={isPending}>
                        Rezervuoti
                      </Button>
                    )}
                  </>
                ) : (
              <Button className="button-primary w-full h-10 font-semibold opacity-40 cursor-not-allowed" disabled>
                    Pasirinkite laiką
                  </Button>
                )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Reviews — full width, below booking widget */}
        <div className="mt-8">
          <Separator className="mb-6" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Atsiliepimai
            </h2>
            {avgRating && (
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1.5">
                <span className="text-xl font-bold">{avgRating.toFixed(1)}</span>
                <div>
                  <StarDisplay rating={avgRating} size="sm" />
                  <p className="text-[10px] text-muted-foreground">{reviews?.length} atsiliepimai</p>
                </div>
              </div>
            )}
          </div>

          {!reviews || reviews.length === 0 ? (
            <div className="flex items-center gap-3 py-3 px-4 bg-muted/30 rounded-xl border border-dashed text-muted-foreground text-sm">
              <Star className="w-4 h-4 shrink-0 text-muted-foreground/40" />
              <span>Dar nėra atsiliepimų.</span>
              <a href="/bookings" className="text-primary hover:underline ml-auto shrink-0 text-xs">Vertinti rezervaciją</a>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{review.reviewerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(review.createdAt), "yyyy-MM-dd")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <StarDisplay rating={review.rating} size="sm" />
                      <span className="text-xs font-bold">{review.rating}.0</span>
                    </div>
                  </div>
                  {review.reviewText && (
                    <p className="text-muted-foreground text-sm leading-relaxed">{review.reviewText}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {reviews && reviews.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Norite palikti atsiliepimą? Eikite į{" "}
              <a href="/bookings" className="text-primary hover:underline">Mano rezervacijos</a>{" "}
              ir šalia patvirtintos rezervacijos spustelėkite „Vertinti".
            </p>
          )}
        </div>

        {/* Related courts carousel */}
        <RelatedCourtsCarousel currentCourtId={courtId} />

      </div>

      {/* Mobile sticky bottom reserve bar */}
      {selectedSlotRange && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t shadow-2xl px-4 py-2 safe-area-bottom space-y-1.5">
          <p className="text-[10px] text-muted-foreground/80 leading-snug">
            {t("booking.policyNote")}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedStart(null); setSelectedEnd(null); setSelectedEquipment(new Map()); }}
              className="flex-shrink-0 w-11 h-11 rounded-xl border border-border bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors"
              title="Išvalyti pasirinkimą"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{selectedSlotRange.startTime} – {selectedSlotRange.endTime} · {selectedSlotRange.durationLabel}</p>
              <p className="font-bold text-base text-primary leading-tight">
                {splitEnabled
                  ? `${(selectedSlotRange.totalPrice / splitCount).toFixed(2)} €`
                  : `${selectedSlotRange.totalPrice.toFixed(2)} €`}
              </p>
            </div>
            {!clerkLoaded ? (
              <div className="h-11 w-32 rounded-xl bg-muted animate-pulse" />
            ) : isSignedIn ? (
              <Button
                onClick={() => splitEnabled ? handleSplitReserve() : recurringEnabled ? handleRecurringBookings() : setSummaryOpen(true)}
                className="button-primary h-11 px-6 font-semibold gap-2 shrink-0"
                disabled={isPending || splitPending}
              >
                {(isPending || splitPending) ? "…" : linkGameId ? "Patvirtinti ir priskirti mačui" : splitEnabled ? "Mokėti dalį" : recurringEnabled ? `${recurringWeeks}× Rezervuoti` : "Rezervuoti"}
              </Button>
            ) : (
              <Button
                onClick={() => setGuestCheckoutOpen(true)}
                className="button-primary h-11 px-6 font-semibold gap-2 shrink-0"
                disabled={isPending}
              >
                Rezervuoti
              </Button>
            )}
          </div>
        </div>
      )}

      <GuestCheckoutDialog
        open={guestCheckoutOpen}
        onOpenChange={setGuestCheckoutOpen}
        onSignIn={() => openSignIn()}
        submitting={false}
        onSubmit={async (data) => {
          setPendingGuestData(data);
          setGuestCheckoutOpen(false);
          setSummaryOpen(true);
        }}
      />

      {selectedSlotRange && (
        <BookingSummaryDialog
          open={summaryOpen}
          onOpenChange={(open) => {
            setSummaryOpen(open);
            if (!open) setPendingGuestData(null);
          }}
          courtName={(court as any)?.name ?? `Kortas #${courtId}`}
          courtImageUrl={(court as any)?.imageUrl ?? null}
          sport={(court as any)?.sport ?? null}
          date={date}
          slotRange={selectedSlotRange}
          selectedEquipment={selectedEquipment}
          availableEquipment={availableEquipment}
          splitEnabled={splitEnabled}
          splitCount={splitCount}
          isPending={isPending || guestCheckoutSubmitting}
          onConfirm={async () => {
            setSummaryOpen(false);
            if (pendingGuestData) {
              setGuestCheckoutSubmitting(true);
              try {
                await handleReserve(pendingGuestData);
              } finally {
                setGuestCheckoutSubmitting(false);
                setPendingGuestData(null);
              }
            } else {
              handleReserve();
            }
          }}
        />
      )}

      {waitlistSlot && (
        <WaitlistModal
          open={waitlistOpen}
          onOpenChange={setWaitlistOpen}
          courtId={courtId}
          date={dateStr}
          startTime={waitlistSlot.startTime}
          endTime={waitlistSlot.endTime}
          prefillEmail={displayEmail}
          prefillName={displayName !== "Vartotojas" ? displayName : undefined}
        />
      )}
    </Layout>
  );
}
