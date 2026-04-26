import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { LocationPicker, type LocationPickerResult } from "@/components/location-picker";
import { CourtIcon } from "@/components/sport-icon";
import {
  Plus, Building2, MapPin, ChevronRight,
  Shield, ShieldCheck, ShieldAlert, Edit2, Trash2, FileUp, CreditCard, Loader2,
  LayoutDashboard, Lock, AlertTriangle,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORT_EMOJIS: Record<string, string> = {
  tennis: "🎾", basketball: "🏀", padel: "🏓", football: "⚽",
  badminton: "🏸", squash: "🎯", table_tennis: "🏓", golf: "⛳",
  snooker: "🎱", bowling: "🎳",
};
const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

interface FacilityCourt {
  id: number;
  name: string;
  type: string;
  status: string;
  pricePerHour: string;
  city: string;
  address: string;
  imageUrl: string | null;
  isIndoor: boolean;
  rating: number | null;
}

interface FacilityWithCourts {
  id: number;
  name: string;
  description?: string;
  companyName?: string;
  registrationCode?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  postcode?: string;
  phone?: string;
  email?: string;
  verificationStatus: string;
  verificationDocUrl?: string;
  ownershipDocUrl?: string;
  stripeConnectStatus?: string;
  stripeConnectAccountId?: string;
  photos: string[];
  equipment: string[];
  courtCount: number;
  sportTypes: string[];
  courts: FacilityCourt[];
  createdAt: string;
}

type StripeStatus = "active" | "pending" | "not_connected" | string;

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") return (
    <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
      <ShieldCheck className="w-3 h-3" /> Patvirtinta
    </Badge>
  );
  if (status === "pending") return (
    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 gap-1">
      <Shield className="w-3 h-3" /> Laukiama
    </Badge>
  );
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
      <ShieldAlert className="w-3 h-3" /> Nepatvirtinta
    </Badge>
  );
}

export default function OwnerFacilities() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<FacilityWithCourts | null>(null);
  const [formTab, setFormTab] = useState<"pagrindai" | "vieta" | "imone" | "kontaktai" | "dokumentas">("pagrindai");
  const [mapKey, setMapKey] = useState(0);
  const [ownershipDocUploading, setOwnershipDocUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", address: "", city: "", phone: "", email: "",
    companyName: "", registrationCode: "", latitude: 0, longitude: 0,
    postcode: "", ownershipDocUrl: "",
  });

  const { data: facilities, isLoading } = useQuery<FacilityWithCourts[]>({
    queryKey: ["owner-facilities"],
    queryFn: () => customFetch<FacilityWithCourts[]>(`${API_URL}/facilities`),
    enabled: !!user?.id,
  });

  const { data: stripeStatusData } = useQuery<{ status: StripeStatus; accountId: string | null }>({
    queryKey: ["stripe-connect-status"],
    queryFn: () => customFetch(`${API_URL}/stripe/connect/status`),
    enabled: !!user?.id,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_connect")) {
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe_connect");
      window.history.replaceState({}, "", url.toString());
    }

    const onFocus = () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  const extractApiError = (err: unknown, fallback: string): string => {
    const anyErr = err as any;
    const data = anyErr?.data;
    if (data && typeof data === "object" && typeof data.error === "string") {
      return data.error;
    }
    if (anyErr?.message) return anyErr.message;
    return fallback;
  };

  const buildPayload = (data: typeof formData) => ({
    ...data,
    email: data.email.trim() || undefined,
    phone: data.phone.trim() || undefined,
    description: data.description.trim() || undefined,
    companyName: data.companyName.trim() || undefined,
    registrationCode: data.registrationCode.trim() || undefined,
    postcode: data.postcode.trim() || undefined,
    ownershipDocUrl: data.ownershipDocUrl.trim() || undefined,
    latitude: data.latitude || undefined,
    longitude: data.longitude || undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      customFetch(`${API_URL}/facilities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(data)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      toast({ title: "Objektas sukurtas" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => toast({
      title: "Klaida kuriant objektą",
      description: extractApiError(err, "Patikrinkite užpildytus laukus"),
      variant: "destructive",
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      customFetch(`${API_URL}/facilities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(data)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      toast({ title: "Objektas atnaujintas" });
      setDialogOpen(false);
      setEditingFacility(null);
      resetForm();
    },
    onError: (err) => toast({
      title: "Klaida atnaujinant",
      description: extractApiError(err, "Patikrinkite užpildytus laukus"),
      variant: "destructive",
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API_URL}/facilities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      toast({ title: "Objektas ištrintas" });
    },
    onError: (err) => toast({
      title: "Klaida trinant",
      description: extractApiError(err, "Bandykite dar kartą"),
      variant: "destructive",
    }),
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", address: "", city: "", phone: "", email: "", companyName: "", registrationCode: "", latitude: 0, longitude: 0, postcode: "", ownershipDocUrl: "" });
    setMapKey(k => k + 1);
  };

  const openCreate = () => {
    setEditingFacility(null);
    resetForm();
    setFormTab("pagrindai");
    setDialogOpen(true);
  };

  const openEdit = (f: FacilityWithCourts, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFacility(f);
    setFormTab("pagrindai");
    setFormData({
      name: f.name || "",
      description: f.description || "",
      address: f.address || "",
      city: f.city || "",
      phone: f.phone || "",
      email: f.email || "",
      companyName: f.companyName || "",
      registrationCode: f.registrationCode || "",
      latitude: f.latitude || 0,
      longitude: f.longitude || 0,
      postcode: f.postcode || "",
      ownershipDocUrl: f.ownershipDocUrl || "",
    });
    setMapKey(k => k + 1);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const name = formData.name.trim();
    const address = formData.address.trim();
    const city = formData.city.trim();
    if (name.length < 2) {
      toast({ title: "Klaida", description: "Pavadinimas turi būti bent 2 simbolių", variant: "destructive" });
      return;
    }
    if (address.length < 3) {
      toast({ title: "Klaida", description: "Adresas turi būti bent 3 simbolių", variant: "destructive" });
      return;
    }
    if (city.length < 2) {
      toast({ title: "Klaida", description: "Miestas turi būti bent 2 simbolių", variant: "destructive" });
      return;
    }
    const cleaned = { ...formData, name, address, city };
    if (editingFacility) {
      updateMutation.mutate({ id: editingFacility.id, data: cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const handleDocUpload = async (file: File) => {
    setOwnershipDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("doc", file);
      const resp = await fetch(`${BASE_URL}/api/upload/ownership-doc`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload failed");
      const { url } = await resp.json();
      setFormData(d => ({ ...d, ownershipDocUrl: url }));
      toast({ title: "Dokumentas įkeltas" });
    } catch {
      toast({ title: "Klaida įkeliant dokumentą", variant: "destructive" });
    } finally {
      setOwnershipDocUploading(false);
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Ar tikrai norite ištrinti šį objektą? Visos aikštelės liks be objekto.")) {
      deleteMutation.mutate(id);
    }
  };

  const getFacilityImage = (f: FacilityWithCourts): string | null => {
    if (f.photos && f.photos.length > 0) return f.photos[0];
    const courtWithImage = (f.courts ?? []).find(c => c.imageUrl);
    return courtWithImage?.imageUrl || null;
  };

  const totalCourts = facilities?.reduce((sum, f) => sum + f.courtCount, 0) ?? 0;
  const totalSports = [...new Set(facilities?.flatMap(f => f.sportTypes) ?? [])].length;
  const ownerStripeStatus: StripeStatus = stripeStatusData?.status ?? "not_connected";
  const stripeActive = ownerStripeStatus === "active";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {!stripeActive ? (
          <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-yellow-100">Action Required: Connect your bank account to accept payments</p>
            </div>
            <Button
              onClick={async () => {
                const r = await customFetch<{ url: string }>(`${API_URL}/stripe/connect`, { method: "POST" });
                window.open(r.url, "_blank", "noopener,noreferrer");
              }}
              className="gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
            >
              <CreditCard className="w-4 h-4" /> Connect Stripe
            </Button>
          </div>
        ) : (
          <div className="mb-6 flex justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                const r = await customFetch<{ url: string }>(`${API_URL}/stripe/connect`, { method: "POST" });
                window.open(r.url, "_blank", "noopener,noreferrer");
              }}
              className="gap-2"
            >
              <CreditCard className="w-4 h-4" /> Manage Payouts
            </Button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mano objektai</h1>
            <p className="text-muted-foreground mt-1">
              Tvarkykite savo sporto objektus ir jų aikšteles
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Naujas objektas
          </Button>
        </div>

        {!isLoading && facilities && facilities.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-1.5">
              <span className="text-sm font-bold text-primary">{facilities.length}</span>
              <span className="text-xs text-muted-foreground">Objektai</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-1.5">
              <span className="text-sm font-bold text-primary">{totalCourts}</span>
              <span className="text-xs text-muted-foreground">Aikštelės</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-1.5">
              <span className="text-sm font-bold text-primary">{totalSports}</span>
              <span className="text-xs text-muted-foreground">Sporto šakos</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border rounded-2xl overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !facilities || facilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Dar neturite objektų</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Sukurkite savo pirmąjį sporto objektą ir pradėkite pridėti aikšteles,
              nustatyti kainas ir priimti rezervacijas.
            </p>
            <Button onClick={openCreate} size="lg" className="gap-2">
              <Plus className="w-5 h-5" /> Sukurti pirmąjį objektą
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {facilities.map(facility => {
              const image = getFacilityImage(facility);
              const fCourts = facility.courts ?? [];
              const approvedCourts = fCourts.filter(c => c.status === "approved").length;
              const pendingCourts = fCourts.filter(c => c.status === "pending").length;

              return (
                <div
                  key={facility.id}
                  onClick={() => navigate(`/owner/facility/${facility.id}`)}
                  className="group bg-card border rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                >
                  <div className="relative h-32 bg-muted overflow-hidden">
                    {image ? (
                      <img
                        src={image.startsWith("http") ? image : `${BASE_URL}/${image}`}
                        alt={facility.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20">
                        <Building2 className="w-16 h-16 text-primary/30" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex flex-col gap-1">
                      <VerificationBadge status={facility.verificationStatus} />
                    </div>

                    <div className="absolute top-3 right-3 flex gap-1">
                      <button
                        onClick={(e) => openEdit(facility, e)}
                        className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
                        title="Redaguoti"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {facility.courtCount === 0 && (
                        <button
                          onClick={(e) => handleDelete(facility.id, e)}
                          className="p-1.5 rounded-lg bg-black/50 text-red-400 hover:bg-black/70 transition-colors backdrop-blur-sm"
                          title="Ištrinti"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {facility.sportTypes.length > 0 && (
                      <div className="absolute bottom-3 left-3 flex gap-1">
                        {facility.sportTypes.slice(0, 5).map(sport => (
                          <span
                            key={sport}
                            className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium"
                          >
                            {SPORT_EMOJIS[sport] || ""} {SPORT_LABELS[sport] || sport}
                          </span>
                        ))}
                        {facility.sportTypes.length > 5 && (
                          <span className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                            +{facility.sportTypes.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg leading-tight truncate group-hover:text-primary transition-colors">
                          {facility.name}
                        </h3>
                        {facility.companyName && facility.companyName !== facility.name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{facility.companyName}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>

                    {(facility.address || facility.city) && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {[facility.address, facility.city].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {facility.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{facility.description}</p>
                    )}

                    <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-sm">
                        <CourtIcon size={16} className="text-primary" />
                        <span className="font-semibold">{facility.courtCount}</span>
                        <span className="text-muted-foreground">
                          {facility.courtCount === 1 ? "aikštelė" : "aikštelės"}
                        </span>
                      </div>
                      {approvedCourts > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                          {approvedCourts} aktyvūs
                        </Badge>
                      )}
                      {pendingCourts > 0 && (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                          {pendingCourts} laukia
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => { e.stopPropagation(); navigate(`/owner/facility/${facility.id}`); }}
                      >
                        <CourtIcon size={16} />
                        Aikštelės
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => { e.stopPropagation(); navigate(`/owner/dashboard?facility=${facility.id}`); }}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Suvestinė
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div
              onClick={openCreate}
              className="group border-2 border-dashed border-border rounded-2xl min-h-[180px] flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                Pridėti objektą
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Naujas sporto centras ar klubas
              </p>
            </div>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {editingFacility ? "Redaguoti objektą" : "Naujas objektas"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none -mx-6 px-6 pb-0">
              {([
                { id: "pagrindai", label: "Pagrindai" },
                { id: "vieta",     label: "Vieta" },
                { id: "imone",     label: "Įmonė" },
                { id: "kontaktai", label: "Kontaktai" },
                { id: "dokumentas", label: "Dokumentas" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormTab(t.id)}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                    formTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >{t.label}</button>
              ))}
            </div>

            <div className="space-y-4 pt-2">
              {formTab === "pagrindai" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Objekto pavadinimas *</Label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                      placeholder="pvz. Vilniaus Teniso Klubas"
                    />
                    {!formData.name.trim() && <p className="text-xs text-destructive">Privalomas laukas</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Aprašymas</Label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                      placeholder="Trumpas objekto aprašymas..."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {formTab === "vieta" && (
                <div className="space-y-4">
                  <LocationPicker
                    key={mapKey}
                    latitude={formData.latitude || 0}
                    longitude={formData.longitude || 0}
                    onChange={(result: LocationPickerResult) => {
                      setFormData(d => ({
                        ...d,
                        latitude: result.lat,
                        longitude: result.lng,
                        ...(result.city ? { city: result.city } : {}),
                        ...(result.address ? { address: result.address } : {}),
                        ...(result.postcode != null ? { postcode: result.postcode } : {}),
                      }));
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Adresas *</Label>
                      <Input
                        value={formData.address}
                        onChange={e => setFormData(d => ({ ...d, address: e.target.value }))}
                        placeholder="Auto-užpildoma iš žemėlapio"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Miestas *</Label>
                      <Input
                        value={formData.city}
                        onChange={e => setFormData(d => ({ ...d, city: e.target.value }))}
                        placeholder="Auto-užpildoma iš žemėlapio"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Pašto kodas</Label>
                      <Input
                        value={formData.postcode}
                        onChange={e => setFormData(d => ({ ...d, postcode: e.target.value }))}
                        placeholder="LT-XXXXX"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Platuma (auto)</Label>
                      <Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" value={formData.latitude || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Ilguma (auto)</Label>
                      <Input type="number" step="any" readOnly className="bg-muted/50 text-muted-foreground text-xs" value={formData.longitude || ""} />
                    </div>
                  </div>
                </div>
              )}

              {formTab === "imone" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200">Įmonės pavadinimas ir kodas reikalingi administratoriaus patvirtinimo. Pakeitimai bus peržiūrėti prieš aktyvuojant.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-1.5">
                      Įmonės pavadinimas <Lock className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      value={formData.companyName}
                      onChange={e => setFormData(d => ({ ...d, companyName: e.target.value }))}
                      placeholder="UAB Sportas"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-1.5">
                      Įmonės kodas <Lock className="w-3 h-3 text-muted-foreground" />
                    </Label>
                    <Input
                      value={formData.registrationCode}
                      onChange={e => setFormData(d => ({ ...d, registrationCode: e.target.value }))}
                      placeholder="123456789"
                    />
                  </div>
                </div>
              )}

              {formTab === "kontaktai" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Telefonas</Label>
                    <Input
                      value={formData.phone}
                      onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))}
                      placeholder="+370..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">El. paštas</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                      placeholder="info@klubas.lt"
                    />
                  </div>
                </div>
              )}

              {formTab === "dokumentas" && (
                <div className="space-y-4">
                  <div className="rounded-xl border p-4 space-y-3">
                    <Label className="text-sm font-semibold">Nuosavybės dokumentas</Label>
                    <p className="text-xs text-muted-foreground">
                      Įkelkite dokumentą, patvirtinantį, kad esate objekto savininkas (nuotrauka arba PDF). Administratorius peržiūrės ir patvirtins objektą.
                    </p>
                    <input
                      ref={docInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleDocUpload(e.target.files[0]); }}
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => docInputRef.current?.click()}
                        disabled={ownershipDocUploading}
                        className="gap-2"
                      >
                        {ownershipDocUploading
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <FileUp className="w-4 h-4" />}
                        {ownershipDocUploading ? "Įkeliama..." : "Įkelti dokumentą"}
                      </Button>
                      {formData.ownershipDocUrl && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          ✓ Dokumentas įkeltas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingFacility(null); }} className="flex-1">
                  Atšaukti
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.name.trim() || !formData.address.trim() || !formData.city.trim() || createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Saugoma..." : editingFacility ? "Išsaugoti" : "Sukurti"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
