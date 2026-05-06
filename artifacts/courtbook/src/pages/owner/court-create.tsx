import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCourt, useSetCourtPricing, customFetch, getListCourtsQueryKey } from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { SPORT_LABELS } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const courtSchema = z.object({
  name: z.string().min(2, "Pavadinimas privalomas"),
  type: z.enum(["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"]),
  description: z.string().optional(),
  pricePerHour: z.coerce.number().min(0),
  maxPlayers: z.coerce.number().min(1),
  imageUrl: z.string().optional(),
  isIndoor: z.boolean().default(false),
  amenities: z.array(z.string()).default([]),
  facilityId: z.coerce.number(),
});

type CourtFormValues = z.infer<typeof courtSchema>;

interface FacilityData { id: number; name: string; ownerUserId?: string | null }

export default function CourtCreatePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams();
  const queryClient = useQueryClient();
  const createCourt = useCreateCourt();
  const setPricing = useSetCourtPricing();
  const facilityId = Number(params.id ?? 0);
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId) return;
    customFetch<FacilityData>(`${API_URL}/facilities/${facilityId}`)
      .then((data) => setFacility(data))
      .finally(() => setLoading(false));
  }, [facilityId]);

  const form = useForm<CourtFormValues>({
    resolver: zodResolver(courtSchema),
    defaultValues: {
      name: "",
      type: "tennis",
      description: "",
      pricePerHour: 20,
      maxPlayers: 4,
      imageUrl: "",
      isIndoor: false,
      amenities: [],
      facilityId,
    },
  });

  const onSubmit = async (values: CourtFormValues) => {
    try {
      const court = await createCourt.mutateAsync({ data: values as any });
      await setPricing.mutateAsync({ id: court.id, data: { defaultPrice: values.pricePerHour, entries: [] } as any });
      queryClient.invalidateQueries({
        queryKey: getListCourtsQueryKey(facility?.ownerUserId ? { ownerUserId: facility.ownerUserId } : undefined),
      });
      toast({ title: "Aikštelė sukurta" });
      navigate(`/owner/facility/${facilityId}`);
    } catch {
      toast({ title: "Nepavyko sukurti aikštelės", variant: "destructive" });
    }
  };

  if (loading || !facility) {
    return (
      <OwnerLayout facilityId={facilityId} title="Pridėti aikštelę">
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility.name} title="Pridėti aikštelę">
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Pridėti naują aikštelę</h1>
            <p className="text-sm text-muted-foreground">{facility.name}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/owner/facility/${facilityId}`)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />Grįžti
          </Button>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pavadinimas</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sportas</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Pasirinkite" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(SPORT_LABELS)
                            .filter((k) => k !== "table-tennis")
                            .map((k) => (
                              <SelectItem key={k} value={k}>{SPORT_LABELS[k]}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricePerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kaina / val. (€)</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxPlayers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maks. žaidėjai</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aprašymas</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Trumpas aikštelės aprašymas..." {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isIndoor"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Vidaus aikštelė</FormLabel>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-2 border-t">
                <Button type="button" variant="ghost" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
                  Atšaukti
                </Button>
                <Button type="submit" disabled={createCourt.isPending || setPricing.isPending}>
                  {createCourt.isPending ? "Kuriama..." : "Sukurti aikštelę"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </OwnerLayout>
  );
}
