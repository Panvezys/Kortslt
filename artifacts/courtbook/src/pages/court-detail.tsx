import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useT } from "@/lib/i18n";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useListBookings, useListCourtReviews } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star, Clock, Euro, Phone, Navigation, ExternalLink, LogIn, ShoppingBag, Zap, CalendarDays, Trophy, Mail, Heart, Share2, MessageSquare, ChevronLeft, ChevronRight, ChevronDown, Images, UserPlus, Check, X, Camera, Copy, Trash2 } from "lucide-react";
import { getAmenityMeta } from "@/lib/amenities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { format as formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { useTheme } from "@/components/theme-provider";

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
};

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

function formatCourtPrice(price: number, peakPrice?: number) {
  if (peakPrice != null && price === peakPrice) return `${price}€ / 1hr`;
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
                    <span key={s} className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      {SPORT_LABELS[s] ?? s}
                    </span>
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

export default function CourtDetail() {
  const { id } = useParams();
  const courtId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
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
    query: { enabled: !!courtId && !isNaN(courtId) }
  });
  const { data: bookings } = useListBookings(
    { courtId },
    { query: { enabled: !!courtId && !isNaN(courtId) && !!user } }
  );

  const createBooking = useCreateBooking();
  const { openSignIn, openSignUp } = useClerk();
  const [, navigate] = useLocation();

  const [copiedContact, setCopiedContact] = useState<"address" | "phone" | null>(null);
  const [equipmentOpen, setEquipmentOpen] = useState(false);

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
    if (!slots[idx]?.isAvailable) return;

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
          if (item) rentedItemsPayload.push({ name, pricePerBooking: item.pricePerBooking, quantity: qty });
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

      if (totalPrice > 0) {
        // Paid booking — go through Stripe Checkout
        const origin = window.location.origin;
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const checkoutResp = await fetch(`${API}/payments/create-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            successUrl: `${origin}${base}/booking-confirmed?id=${booking.id}`,
            cancelUrl: `${origin}${base}/courts/${courtId}?booking_cancelled=1`,
          }),
        });
        if (!checkoutResp.ok) throw new Error("Checkout session failed");
        const { url } = await checkoutResp.json();
        window.location.href = url;
      } else {
        // Free booking — confirm immediately
        const resp = await fetch(`${API}/payments/confirm-free`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id }),
        });
        if (!resp.ok) throw new Error("Confirm failed");
        navigate(`/booking-confirmed?id=${booking.id}`);
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

  const isPending = createBooking.isPending;
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const avgRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const courtBookings = useMemo(() => {
    return (bookings ?? [])
      .filter((booking) => booking.courtId === courtId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.startTime.localeCompare(a.startTime));
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
          <h1 className="text-3xl font-bold mb-4">Kortas nerastas</h1>
          <Button onClick={() => setLocation("/courts")}>Grįžti</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Photo Gallery */}
      <div className="w-full h-[45vh] min-h-[320px] bg-zinc-900 relative overflow-hidden">
        {allPhotos.length > 0 ? (
          <img
            key={activePhotoIdx}
            src={resolveCourtImage(allPhotos[activePhotoIdx]) ?? ""}
            alt={court.name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-3">
            <Images className="h-16 w-16" />
            <span className="text-5xl font-bold">{court.name.charAt(0)}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

        {/* Navigation arrows — only if multiple photos */}
        {allPhotos.length > 1 && (
          <>
            <button
              onClick={() => setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white rounded-full p-2 transition-all hover:scale-105"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActivePhotoIdx(i => (i + 1) % allPhotos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white rounded-full p-2 transition-all hover:scale-105"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Photo counter badge */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Images className="h-3 w-3" />
              {activePhotoIdx + 1} / {allPhotos.length}
            </div>

            {/* Thumbnail strip */}
            <div className="absolute bottom-6 left-4 flex gap-1.5 max-w-[55%] overflow-x-auto pb-0.5 scrollbar-hide">
              {allPhotos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === activePhotoIdx ? "border-white scale-105" : "border-white/30 hover:border-white/60"}`}
                >
                  <img src={resolveCourtImage(url) ?? ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Dot indicators (compact, below thumbnails) */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
              {allPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`rounded-full transition-all ${i === activePhotoIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="container mx-auto px-4 relative -mt-32 z-10 pb-24 md:pb-24">
        <div className="grid md:grid-cols-3 gap-8">

          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <div className="flex items-end justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex gap-2 items-center mb-4">
                    <Badge variant="default" className="bg-primary text-primary-foreground">{court.type}</Badge>
                    {court.isIndoor && <Badge variant="secondary">Indoor</Badge>}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{court.name}</h1>
                </div>
                <div className="flex items-center gap-2 shrink-0 pb-4">
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
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" />{court.address}, {court.city}</div>
                <div className="flex items-center"><Users className="w-4 h-4 mr-2" />Max {court.maxPlayers} žaidėjai</div>
                {avgRating && (
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={avgRating} size="md" />
                    <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">({reviews?.length} atsiliepimai)</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Apie kortą</h2>
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

            {/* Peak Pricing info */}
            {court.peakPricePerHour && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5">
                <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Dinamiška kainodara</p>
                  <p className="text-sm text-muted-foreground">
                    Off-peak: <strong className="text-foreground">{formatCourtPrice(court.pricePerHour)}</strong>&nbsp;·&nbsp;
                    Peak (Pir–Pen 17–22): <strong className="text-yellow-400">{formatCourtPrice(court.peakPricePerHour)}</strong>
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Location & Contact */}
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold">Vieta ir kontaktai</h2>

              {/* Map embed */}
              <div className="rounded-xl overflow-hidden border h-56 w-full relative group">
                <iframe
                  title="Korto vieta"
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
                          onClick={() => handleCopyContact("phone", court.phone)}
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

                {/* Opening hours card */}
                {court.openingHours && court.openingHours.length > 0 && (
                  <div className={`flex gap-3 p-4 bg-muted/30 rounded-xl border ${!court.phone ? "sm:col-span-2" : ""}`}>
                    <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Darbo laikas</p>
                      <div className="space-y-1">
                        {court.openingHours.map((line, i) => {
                          const [days, hours] = line.split(": ");
                          return (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{days}</span>
                              <span className="font-semibold tabular-nums">{hours}</span>
                            </div>
                          );
                        })}
                      </div>
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

          </div>

          {/* Booking Widget */}
          <div className="relative">
            <div className="md:sticky md:top-24 bg-card border rounded-2xl shadow-xl md:overflow-hidden md:max-h-[calc(100vh-7rem)] md:flex md:flex-col">
              <div className="p-6 space-y-5 md:overflow-y-auto md:flex-1 md:min-h-0">

              {/* Step 1: Date */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Pasirinkite datą
                </p>
                <div className="border rounded-xl bg-background flex justify-center py-2 pb-3">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) {
                        vibrateTap();
                        setDate(d);
                        setSelectedStart(null);
                        setSelectedEnd(null);
                        setSelectedEquipment(new Map());
                      }
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    fixedWeeks
                    showOutsideDays={false}
                    className="rounded-md [--cell-size:2rem] w-full"
                    classNames={{ root: "w-full" }}
                  />
                </div>
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
                  {court.peakPricePerHour && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-yellow-400/20 border border-yellow-400/40 inline-block" />
                      <Zap className="w-2.5 h-2.5 text-yellow-400" />
                      Peak
                    </span>
                  )}
                </div>

                {availabilityLoading ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
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

                      const isPeak = court.peakPricePerHour != null && slot.price >= court.peakPricePerHour;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => {
                            vibrateTap();
                            handleSlotClick(idx);
                          }}
                          className={`relative rounded-lg border px-1 py-2.5 text-xs font-medium transition-all focus:outline-none ${
                            !slot.isAvailable
                            ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-md scale-[0.97]"
                              : isPeak
                                ? "bg-yellow-400/10 text-foreground border-yellow-400/40 hover:border-yellow-400 hover:bg-yellow-400/20 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                                : "bg-background text-foreground border-border hover:border-primary hover:bg-primary/10 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                          }`}
                        >
                          <div className="text-center leading-tight">
                            <div className={`flex items-center justify-center gap-0.5 ${isRangeStart || isRangeEnd ? "font-bold" : ""}`}>
                              {isPeak && !isSelected && <Zap className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
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
                    <span className="text-muted-foreground">Kortas</span>
                    <span className="font-medium">{selectedSlotRange.courtPrice.toFixed(2)} €</span>
                  </div>
                  {equipmentTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Įranga</span>
                      <span className="font-medium">{equipmentTotal.toFixed(2)} €</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Iš viso</span>
                    <span className="text-primary">{selectedSlotRange.totalPrice.toFixed(2)} €</span>
                  </div>
                </div>
              ) : selectedStart !== null ? (
                <p className="text-xs text-center text-muted-foreground py-1">
                  Spustelėkite dar vieną laikotarpį, kad prailgintumėte rezervaciją, arba tą patį – kad atšauktumėte
                </p>
              ) : null}

              {/* Step 3: Reserve */}
              {selectedSlotRange && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                    Rezervuoti
                  </p>

                  {!clerkLoaded ? (
                    <Skeleton className="h-16 w-full rounded-xl" />
                  ) : isSignedIn && user ? (
                    <>
                      {/* Signed-in user card */}
                      <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt={user.fullName ?? "Profilis"} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-sm">
                              {(user.firstName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.primaryEmailAddress?.emailAddress}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                      </div>

                      <Button onClick={() => handleReserve()} className="w-full h-12 text-base font-semibold gap-2 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:hover:scale-100" disabled={isPending}>
                        {isPending ? "Apdorojama..." : "Rezervuoti"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">Patvirtinimo laiškas bus išsiųstas iš karto</p>
                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Norėdami rezervuoti, pirmiausia prisijunkite.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 gap-1.5" onClick={() => openSignIn()}>
                          <LogIn className="w-4 h-4" />
                          Prisijungti
                        </Button>
                        <Button variant="default" className="flex-1 gap-1.5" onClick={() => openSignUp()}>
                          <UserPlus className="w-4 h-4" />
                          Registruotis
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedSlotRange && (
                <Button className="w-full h-12 text-base font-semibold opacity-50 cursor-not-allowed" disabled>
                  Pasirinkite laiką
                </Button>
              )}

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
                        Šioje kortoje rezervacijų nėra.
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

              {/* Desktop sticky reserve footer */}
              {selectedSlotRange && (
                <div className="hidden md:flex items-center gap-3 border-t bg-card px-4 py-3 rounded-b-2xl shrink-0">
                  <button
                    onClick={() => { setSelectedStart(null); setSelectedEnd(null); setSelectedEquipment(new Map()); }}
                    className="w-9 h-9 rounded-xl border border-border bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors shrink-0"
                    title="Išvalyti pasirinkimą"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{selectedSlotRange.startTime} – {selectedSlotRange.endTime} · {selectedSlotRange.durationLabel}</p>
                    <p className="font-bold text-base text-primary leading-tight">{selectedSlotRange.totalPrice.toFixed(2)} €</p>
                  </div>
                  {!clerkLoaded ? (
                    <div className="h-10 w-28 rounded-xl bg-muted animate-pulse shrink-0" />
                  ) : isSignedIn ? (
                    <Button onClick={() => handleReserve()} className="h-10 px-5 font-semibold gap-2 shrink-0" disabled={isPending}>
                      {isPending ? "..." : "Rezervuoti"}
                    </Button>
                  ) : (
                    <Button onClick={() => openSignIn()} className="h-10 px-4 font-semibold gap-1.5 shrink-0">
                      <LogIn className="w-4 h-4" />
                      Prisijungti
                    </Button>
                  )}
                </div>
              )}
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
      </div>

      {/* Mobile sticky bottom reserve bar */}
      {selectedSlotRange && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t shadow-2xl px-4 py-3 safe-area-bottom">
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
              <p className="font-bold text-base text-primary leading-tight">{selectedSlotRange.totalPrice.toFixed(2)} €</p>
            </div>
            {!clerkLoaded ? (
              <div className="h-11 w-32 rounded-xl bg-muted animate-pulse" />
            ) : isSignedIn ? (
              <Button
                onClick={() => handleReserve()}
                className="h-11 px-6 font-semibold gap-2 shrink-0"
                disabled={isPending}
              >
                {isPending ? "..." : "Rezervuoti"}
              </Button>
            ) : (
              <Button
                onClick={() => openSignIn()}
                className="h-11 px-5 font-semibold gap-1.5 shrink-0"
              >
                <LogIn className="w-4 h-4" />
                Prisijungti
              </Button>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
