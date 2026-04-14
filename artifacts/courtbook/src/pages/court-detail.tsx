import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useListBookings, useListCourtReviews } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star, Clock, Euro, Phone, Navigation, ExternalLink, LogIn, Lightbulb, ShowerHead, DoorOpen, Droplets, ShoppingBag, Zap, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { format as formatDate } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;


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

export default function CourtDetail() {
  const { id } = useParams();
  const courtId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);

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

  const { data: reviews } = useListCourtReviews(courtId, {
    query: { enabled: !!courtId && !isNaN(courtId) }
  });
  const { data: bookings } = useListBookings(
    { courtId },
    { query: { enabled: !!courtId && !isNaN(courtId) && !!user } }
  );

  const createBooking = useCreateBooking();
  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [, navigate] = useLocation();

  const slots = availability?.slots ?? [];

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
    return {
      startTime: range[0].startTime,
      endTime: range[range.length - 1].endTime,
      totalPrice: range.reduce((sum, s) => sum + s.price, 0),
      slotCount: range.length,
      durationLabel,
      rangeStart,
      rangeEnd,
    };
  }, [selectedStart, selectedEnd, slots]);

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

  const handleReserve = async () => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }
    if (!isSignedIn || !user) {
      openSignIn();
      return;
    }

    const customerName = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    const customerEmail = user.primaryEmailAddress?.emailAddress ?? "";

    if (!customerName || !customerEmail) {
      toast({ title: "Profilio duomenys neišsamūs", description: "Papildykite profilį ir bandykite dar kartą.", variant: "destructive" });
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        data: {
          courtId,
          customerName,
          customerEmail,
          date: dateStr,
          startTime: selectedSlotRange.startTime,
          endTime: selectedSlotRange.endTime,
        }
      });

      // Free reservation — confirm immediately and send email, no payment required
      const resp = await fetch(`${API}/payments/confirm-free`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      if (!resp.ok) throw new Error("Confirm failed");

      navigate(`/booking-confirmed?id=${booking.id}`);
    } catch {
      toast({
        title: "Rezervacija nepavyko",
        description: "Bandykite dar kartą.",
        variant: "destructive",
      });
    }
  };

  const isPending = createBooking.isPending;
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";

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
      {/* Header Image */}
      <div className="w-full h-[40vh] min-h-[300px] bg-muted relative">
        {resolveCourtImage(court.imageUrl) ? (
          <img src={resolveCourtImage(court.imageUrl)!} alt={court.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white">
            <span className="text-6xl font-bold opacity-20">{court.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>
      <div className="container mx-auto px-4 relative -mt-32 z-10 pb-24">
        <div className="grid md:grid-cols-3 gap-8">

          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <div className="flex gap-2 items-center mb-4">
                <Badge variant="default" className="bg-primary text-primary-foreground">{court.type}</Badge>
                {court.isIndoor && <Badge variant="secondary">Indoor</Badge>}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{court.name}</h1>
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

            <Separator />

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {court.amenities.map((amenity, i) => {
                    type IconType = typeof Lightbulb;
                    const icons: Record<string, IconType> = {
                      floodlights: Lightbulb,
                      showers: ShowerHead,
                      changing_rooms: DoorOpen,
                      water_station: Droplets,
                    };
                    const labels: Record<string, string> = {
                      floodlights: "Prožektoriai",
                      showers: "Dušai",
                      changing_rooms: "Persirengimo kambariai",
                      water_station: "Vandens stotis",
                    };
                    const Icon = icons[amenity] ?? CheckCircle2;
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-muted/30 text-center">
                        <Icon className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">{labels[amenity] ?? amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rentable Items */}
            {(() => {
              try {
                const items: Array<{name: string; pricePerBooking: number}> =
                  court.rentableItems ? JSON.parse(court.rentableItems) : [];
                if (!items.length) return null;
                return (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                      Nuomojama įranga
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                          <span className="font-medium text-sm">{item.name}</span>
                          <Badge variant="secondary">{item.pricePerBooking}€ / rezerv.</Badge>
                        </div>
                      ))}
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
                    Off-peak: <strong className="text-foreground">{court.pricePerHour}€/val</strong>&nbsp;·&nbsp;
                    Peak (Pir–Pen 17–22): <strong className="text-yellow-400">{court.peakPricePerHour}€/val</strong>
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
                  className="w-full h-full"
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
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Adresas</p>
                    <p className="font-semibold text-sm">{court.address}</p>
                    <p className="text-sm text-muted-foreground">{court.city}, Lietuva</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(court.name + ", " + court.address + ", " + court.city)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      Atidaryti žemėlapyje <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Phone card */}
                {court.phone && (
                  <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
                    <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Telefonas</p>
                      <a
                        href={`tel:${court.phone}`}
                        className="font-semibold text-sm hover:text-primary transition-colors"
                      >
                        {court.phone}
                      </a>
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
            </div>

            <Separator />

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Atsiliepimai</h2>
                {avgRating && (
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2">
                    <span className="text-3xl font-bold">{avgRating.toFixed(1)}</span>
                    <div>
                      <StarDisplay rating={avgRating} size="md" />
                      <p className="text-xs text-muted-foreground mt-0.5">{reviews?.length} atsiliepimai</p>
                    </div>
                  </div>
                )}
              </div>

              {!reviews || reviews.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
                  <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">Dar nėra atsiliepimų</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Rezervuokite kortą ir palikite atsiliepimą iš rezervacijų puslapio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-card border rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{review.reviewerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(new Date(review.createdAt), "yyyy MMMM d")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StarDisplay rating={review.rating} size="sm" />
                          <span className="text-sm font-bold">{review.rating}.0</span>
                        </div>
                      </div>
                      {review.reviewText && (
                        <p className="text-muted-foreground leading-relaxed">{review.reviewText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Norite palikti atsiliepimą?</span>{" "}
                Eikite į{" "}
                <a href="/bookings" className="text-primary hover:underline font-medium">Mano rezervacijos</a>{" "}
                ir šalia patvirtintos rezervacijos spustelėkite „Vertinti".
              </div>
            </div>
          </div>

          {/* Booking Widget */}
          <div className="relative">
            <div className="sticky top-24 bg-card border rounded-2xl p-6 shadow-xl space-y-5 border-t-[0.889px] border-r-[0.889px] border-b-[0.889px] border-l-[0.889px]">

              {/* Price header */}
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-3xl font-bold">{court.pricePerHour}€</span>
                  <span className="text-muted-foreground text-sm">/val</span>
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {user && (
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
                    <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Šioje kortoje dar neturite rezervacijų.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courtBookings.slice(0, 4).map((booking) => (
                        <div key={booking.id} className="rounded-xl border bg-muted/20 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{format(parseISO(String(booking.date).split("T")[0]), "yyyy-MM-dd")}</p>
                              <p className="text-xs text-muted-foreground">{booking.startTime} – {booking.endTime}</p>
                            </div>
                            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>{booking.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="block text-foreground font-medium">Suma</span>
                              {booking.totalPrice}€
                            </div>
                            <div>
                              <span className="block text-foreground font-medium">ID</span>
                              #{booking.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Step 1: Date */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Pasirinkite datą
                </p>
                <div className="border rounded-xl p-1 bg-background flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) { setDate(d); setSelectedStart(null); setSelectedEnd(null); }
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    className="rounded-md"
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
                  <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {slots.map((slot, idx) => {
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
                          onClick={() => handleSlotClick(idx)}
                          className={`relative rounded-lg border px-1 py-2.5 text-xs font-medium transition-all focus:outline-none ${
                            !slot.isAvailable
                              ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                              : isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[0.97]"
                                : isPeak
                                  ? "bg-yellow-400/10 text-foreground border-yellow-400/40 hover:border-yellow-400 cursor-pointer"
                                  : "bg-background text-foreground border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
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

              {/* Booking summary — shown inline below slot grid once something is selected */}
              {selectedSlotRange ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Laikas</span>
                    <span className="font-semibold">{selectedSlotRange.startTime} – {selectedSlotRange.endTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trukmė</span>
                    <span className="font-medium">{selectedSlotRange.durationLabel}</span>
                  </div>
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

                      <Button onClick={handleReserve} className="w-full h-12 text-base font-semibold gap-2" disabled={isPending}>
                        {isPending ? "Apdorojama..." : "Rezervuoti nemokamai"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">Patvirtinimo laiškas bus išsiųstas iš karto</p>
                    </>
                  ) : (
                    /* Not signed in */
                    (<div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <LogIn className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Prisijunkite, kad rezervuotumėte</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Jūsų rezervacijos bus saugomos paskyroje</p>
                      </div>
                      <Button onClick={() => openSignIn()} className="w-full gap-2" size="sm">
                        <LogIn className="w-4 h-4" />
                        Prisijungti
                      </Button>
                    </div>)
                  )}
                </div>
              )}

              {!selectedSlotRange && (
                <Button className="w-full h-12 text-base font-semibold opacity-50 cursor-not-allowed" disabled>
                  Pasirinkite laiką
                </Button>
              )}

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
