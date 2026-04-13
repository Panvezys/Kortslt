import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useCreateCheckoutSession, useListCourtReviews } from "@workspace/api-client-react";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format as formatDate } from "date-fns";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Invalid email address"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

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

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
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
  const [selectedSlot, setSelectedSlot] = useState<{ startTime: string; endTime: string } | null>(null);

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
    defaultValues: {
      customerName: "",
      customerEmail: "",
    },
  });

  const onSubmit = async (data: BookingFormValues) => {
    if (!selectedSlot) {
      toast({ title: "Please select a time slot", variant: "destructive" });
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        data: {
          courtId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          date: dateStr,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
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
        title: "Booking failed",
        description: "There was an error creating your booking. Please try again.",
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
          <h1 className="text-3xl font-bold mb-4">Court not found</h1>
          <Button onClick={() => setLocation("/courts")}>Back to Courts</Button>
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
                <div className="flex items-center"><Users className="w-4 h-4 mr-2" />Max {court.maxPlayers} players</div>
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
                {court.description || "A premium court available for booking. Perfect for matches, practice, or friendly games with friends."}
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

            {/* Reviews Section */}
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
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Užsirezervuokite kortą ir palikite atsiliepimą iš rezervacijų puslapio.
                  </p>
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
            <div className="sticky top-24 bg-card border rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-baseline mb-6">
                <div>
                  <span className="text-3xl font-bold">{court.pricePerHour}€</span>
                  <span className="text-muted-foreground">/val</span>
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <Separator className="mb-6" />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                  <div>
                    <Label className="text-base mb-3 block">1. Pasirinkite datą</Label>
                    <div className="border rounded-xl p-2 bg-background flex justify-center">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                          if (d) {
                            setDate(d);
                            setSelectedSlot(null);
                          }
                        }}
                        disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                        className="rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base mb-3 block">2. Pasirinkite laiką</Label>
                    {availabilityLoading ? (
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                      </div>
                    ) : availability?.slots && availability.slots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {availability.slots.map((slot, i) => {
                          const isSelected = selectedSlot?.startTime === slot.startTime;
                          return (
                            <Button
                              key={i}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              className={!slot.isAvailable ? "opacity-30 cursor-not-allowed" : ""}
                              disabled={!slot.isAvailable}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {slot.startTime}
                            </Button>
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

                  {selectedSlot && (
                    <div className="space-y-4 pt-4 border-t">
                      <Label className="text-base block">3. Jūsų duomenys</Label>

                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vardas Pavardė</FormLabel>
                            <FormControl>
                              <Input placeholder="Jonas Jonaitis" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>El. paštas</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="jonas@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full text-lg h-14 mt-4"
                    disabled={!selectedSlot || isPending}
                  >
                    {isPending ? "Apdorojama..." : "Rezervuoti ir mokėti"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Mokėjimas saugiai vyksta per Stripe.
                  </p>
                </form>
              </Form>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
