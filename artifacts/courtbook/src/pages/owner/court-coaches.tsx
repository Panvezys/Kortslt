import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { CoachManagementModal } from "@/pages/owner-facility-detail";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

export default function OwnerCourtCoaches() {
  const params = useParams<{ facilityId: string; courtId: string }>();
  const facilityId = Number(params.facilityId);
  const courtId = Number(params.courtId);
  const [, navigate] = useLocation();

  const { data: facility } = useQuery<{ name?: string }>({
    queryKey: ["facility-detail", String(facilityId)],
    queryFn: () => customFetch(`${API_URL}/facilities/${facilityId}`),
    enabled: !!facilityId,
  });

  const { data: court } = useQuery<{ name?: string }>({
    queryKey: ["court-detail", courtId],
    queryFn: () => customFetch(`${API_URL}/courts/${courtId}`),
    enabled: !!courtId,
  });

  return (
    <OwnerLayout facilityId={facilityId} facilityName={facility?.name} title="Treneriai">
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate(`/owner/facility/${facilityId}`)}>
          <ArrowLeft className="w-4 h-4" /> Atgal į aikšteles
        </Button>
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Aikštelės treneriai</h1>
            {court?.name && <p className="text-sm text-muted-foreground">{court.name}</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <CoachManagementModal courtId={courtId} />
        </div>
      </div>
    </OwnerLayout>
  );
}
