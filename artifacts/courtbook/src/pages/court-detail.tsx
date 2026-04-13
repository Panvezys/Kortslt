import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useCreateCheckoutSession, useListCourtReviews } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star, Clock, Euro } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format as formatDate } from "date-fns";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Vardas per trumpas"),
  customerEmail: z.string().email("Neteisingas el. paštas"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const DURATION_OPTIONS = [
  { label: "30 min", slots: 1 },
  { label: "1 val", slots: 2 },
  { label: "1.5 val", slots: 3 },
  { label: "2 val", slots: 4 },
  { label: "2.5 val", slots: 5 },
  { label: "3 val", slots: 6 },
];

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
  const [duration, setDuration] = useState(2); // number of 30-min slots

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

  const createBooking = useCreateBooking();
  const createCheckout = useCreateCheckoutSession();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { customerName: "", customerEmail: "" },
  });

  const slots = availability?.slots ?? [];

  // Selected slot range
  const selectedSlotRange = useMemo(() => {
    if (selectedStart === null || !slots.length) return null;
    const range = slots.slice(selectedStart, selectedStart + duration);
    if (range.length < duration) return null;
    const canBook = range.every(s => s.isAvailable);
    if (!canBook) return null;
    return {
      startTime: range[0].startTime,
      endTime: range[range.length - 1].endTime,
      totalPrice: range.reduce((sum, s) => sum + s.price, 0),
      slotCount: range.length,
    };
  }, [selectedStart, duration, slots]);

  // Check if a start index is valid (all slots in range are available)
  const isRangeValid = (startIdx: number) => {
    const range = slots.slice(startIdx, startIdx + duration);
    return range.length === duration && range.every(s => s.isAvailable);
  };

  const onSubmit = async (data: BookingFormValues) => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        data: {
          courtId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          date: dateStr,
          startTime: selectedSlotRange.startTime,
          endTime: selectedSlotRange.endTime,
        }
      });

      const checkout = await createCheckout.mutateAsync({
        data: {
          bookingId: booking.id,
          successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/payment-cancel`,
        }
      });

      window.location.href = checkout.url;
    } catch {
      toast({
        title: "Rezervacija nepavyko",
        description: "Bandykite dar kartą.",
        variant: "destructive",
      });
    }
  };

  const isPending = createBooking.isPending || createCheckout.isPending;

  const avgRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

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

            {court.amenities && court.amenities.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Patogumai</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {court.amenities.map((amenity, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            <div className="sticky top-24 bg-card border rounded-2xl p-6 shadow-xl space-y-5">

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
                      if (d) { setDate(d); setSelectedStart(null); }
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    className="rounded-md"
                  />
                </div>
              </div>

              {/* Step 2: Duration */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  <Clock className="w-4 h-4" /> Trukmė
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.slots}
                      type="button"
                      onClick={() => { setDuration(opt.slots); setSelectedStart(null); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        duration === opt.slots
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Time slot */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                  Pasirinkite laiką
                </p>

                {/* Legend */}
                <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Pasirinkta</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground/20 inline-block" /> Užimta</span>
                </div>

                {availabilityLoading ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {slots.map((slot, idx) => {
                      const isInSelectedRange =
                        selectedStart !== null &&
                        idx >= selectedStart &&
                        idx < selectedStart + duration;
                      const isStart = selectedStart === idx;
                      const valid = isRangeValid(idx);

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => {
                            if (!valid) return;
                            setSelectedStart(idx);
                          }}
                          className={`relative rounded-lg border px-1 py-2 text-xs font-medium transition-all focus:outline-none ${
                            !slot.isAvailable
                              ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                              : isInSelectedRange
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : valid
                                  ? "bg-background text-foreground border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                                  : "bg-background text-muted-foreground border-border/50 cursor-pointer"
                          }`}
                        >
                          <div className="text-center leading-tight">
                            <div className={isStart && isInSelectedRange ? "font-bold" : ""}>{slot.startTime}</div>
                            <div className={`mt-0.5 flex items-center justify-center gap-0.5 ${isInSelectedRange ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
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

              {/* Booking summary */}
              {selectedSlotRange && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-sm">Rezervacijos suvestinė</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Laikas</span>
                    <span className="font-medium">{selectedSlotRange.startTime} – {selectedSlotRange.endTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trukmė</span>
                    <span className="font-medium">{selectedSlotRange.slotCount * 30} min</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold">
                    <span>Iš viso</span>
                    <span className="text-primary">{selectedSlotRange.totalPrice.toFixed(2)}€</span>
                  </div>
                </div>
              )}

              {/* Customer details */}
              {selectedSlotRange && (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                      Jūsų duomenys
                    </p>

                    <FormField control={form.control} name="customerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Vardas Pavardė</FormLabel>
                        <FormControl><Input placeholder="Jonas Jonaitis" className="h-9" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="customerEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">El. paštas</FormLabel>
                        <FormControl><Input type="email" placeholder="jonas@example.com" className="h-9" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={isPending}>
                      {isPending ? "Apdorojama..." : `Rezervuoti · ${selectedSlotRange.totalPrice.toFixed(2)}€`}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">Mokėjimas saugiai vyksta per Stripe</p>
                  </form>
                </Form>
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
