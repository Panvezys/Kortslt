import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

export function OwnerFacilityDetailPage() {
  const { id } = useParams();
  const facilityId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [refreshingStripe, setRefreshingStripe] = useState(false);

  const { data: facility } = useQuery({
    queryKey: ["facility-detail", facilityId],
    queryFn: () => customFetch(`/api/facilities/${facilityId}`),
  });

  const stripeStatus = (facility as any)?.stripeConnectStatus ?? "not_connected";

  const handleFacilityConnectStripe = async () => {
    try {
      setRefreshingStripe(true);
      const origin = window.location.origin;
      const r = await fetch(`/api/facilities/${facilityId}/connect/onboard`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${origin}${window.location.pathname}?facility_connect_success=1`,
          refreshUrl: `${origin}${window.location.pathname}?facility_connect_refresh=1`,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Klaida");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({ title: "Stripe Connect klaida", description: err?.message, variant: "destructive" });
    } finally {
      setRefreshingStripe(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("facility_connect_success") === "1" || params.get("connect_success") === "1";
    const refresh = params.get("facility_connect_refresh") === "1" || params.get("connect_refresh") === "1";
    if (!success && !refresh) return;

    window.history.replaceState({}, "", window.location.pathname);
    if (success) {
      toast({ title: "Stripe Connect prijungtas!", description: "Dabar galite priimti mokėjimus." });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", facilityId] });
      queryClient.invalidateQueries({ queryKey: ["facility-detail", facilityId, "stripe"] });
      setTimeout(() => window.location.reload(), 300);
    } else {
      toast({ title: "Stripe Connect neužbaigtas", description: "Bandykite dar kartą." });
    }
  }, [facilityId, queryClient, toast]);

  return null;
}
