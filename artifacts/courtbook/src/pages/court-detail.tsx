import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useCreateCheckoutSession } from "@workspace/api-client-react";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const bookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Invalid email address"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

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
      toast({
        title: "Please select a time slot",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Create booking
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

      // 2. Create checkout session
      const checkout = await createCheckout.mutateAsync({
        data: {
          bookingId: booking.id,
          successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/payment-cancel`,
        }
      });

      // 3. Redirect to Stripe
      window.location.href = checkout.url;

    } catch (error) {
      toast({
        title: "Booking failed",
        description: "There was an error creating your booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isPending = createBooking.isPending || createCheckout.isPending;

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
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-2xl font-semibold mb-4">About this court</h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {court.description || "A premium court available for booking. Perfect for matches, practice, or friendly games with friends."}
              </p>
            </div>

            {court.amenities && court.amenities.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Amenities</h2>
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
          </div>

          {/* Booking Widget */}
          <div className="relative">
            <div className="sticky top-24 bg-card border rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-baseline mb-6">
                <div>
                  <span className="text-3xl font-bold">${court.pricePerHour}</span>
                  <span className="text-muted-foreground">/hour</span>
                </div>
              </div>

              <Separator className="mb-6" />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <div>
                    <Label className="text-base mb-3 block">1. Select Date</Label>
                    <div className="border rounded-xl p-2 bg-background flex justify-center">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                          if (d) {
                            setDate(d);
                            setSelectedSlot(null); // Reset slot on date change
                          }
                        }}
                        disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                        className="rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-base mb-3 block">2. Select Time</Label>
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
                        No available slots for this date.
                      </div>
                    )}
                  </div>

                  {selectedSlot && (
                    <div className="space-y-4 pt-4 border-t">
                      <Label className="text-base block">3. Your Details</Label>
                      
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
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
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
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
                    {isPending ? "Processing..." : "Book & Pay"}
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    You won't be charged yet. You will be redirected to Stripe securely.
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
