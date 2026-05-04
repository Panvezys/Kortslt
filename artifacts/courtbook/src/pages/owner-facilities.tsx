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
import { validateEmail, validatePhone } from "@/lib/validators";
import { useI18n } from "@/lib/i18n";
import {
  Plus, Building2, MapPin, ChevronRight,
  Shield, ShieldCheck, ShieldAlert, Edit2, Trash2, FileUp, CreditCard, Loader2,
  Lock, AlertTriangle, Send, FileEdit, Hourglass, Ban,
  Phone, Mail, Globe, FileText, Clock, CheckCircle2, XCircle, Info,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

function ltPlural(n: number, singular: string, plural: string, genitive: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${singular}`;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 10 || mod100 >= 20)) return `${n} ${plural}`;
  return `${n} ${genitive}`;
}

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
  stripeOnboardingComplete?: boolean;
  adminVerified?: boolean;
  verificationNotes?: string | null;
  rejectionReason?: string | null;
  vatNumber?: string;
  websiteUrl?: string;
  photos: string[];
  equipment: string[];
  courtCount: number;
  sportTypes: string[];
  courts: FacilityCourt[];
  createdAt: string;
}

interface OwnerBizInfo {
  id: number;
  companyName: string | null;
  registrationCode: string | null;
  vatNumber: string | null;
  websiteUrl: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  hasPendingEdit: boolean;
  pendingEdit: { requestedData: string; createdAt: string } | null;
}

type StripeStatus = "active" | "pending" | "not_connected" | string;

function VerificationBadge({ status }: { status: string }) {
  if (status === "active") return (
    <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
      <ShieldCheck className="w-3 h-3" /> Aktyvus
    </Badge>
  );
  if (status === "pending_verification") return (
    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 gap-1">
      <Hourglass className="w-3 h-3" /> Laukia patvirtinimo
    </Badge>
  );
  if (status === "onboarding") return (
    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1">
      <CreditCard className="w-3 h-3" /> Stripe registracija
    </Badge>
  );
  if (status === "suspended") return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
      <Ban className="w-3 h-3" /> Sustabdytas
    </Badge>
  );
  // 'draft' or anything unknown
  return (
    <Badge className="bg-slate-100 text-slate-900 border-slate-300 gap-1">
      <FileEdit className="w-3 h-3" /> Juodraštis
    </Badge>
  );
}

// ─── Business Info Panel ───────────────────────────────────────────────────────
function BusinessInfoPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: info, isLoading, isError } = useQuery<OwnerBizInfo>({
    queryKey: ["owner-business-info"],
    queryFn: () => customFetch<OwnerBizInfo>(`${API_URL}/owner/business-info`),
    retry: false,
  });

  const [editForm, setEditForm] = useState({
    phone: "", email: "",
    companyName: "", registrationCode: "", vatNumber: "", websiteUrl: "",
    address: "", city: "", postcode: "", description: "",
  });

  useEffect(() => {
    if (info) {
      setEditForm({
        phone: info.phone ?? "",
        email: info.email ?? "",
        companyName: info.companyName ?? "",
        registrationCode: info.registrationCode ?? "",
        vatNumber: info.vatNumber ?? "",
        websiteUrl: info.websiteUrl ?? "",
        address: info.address ?? "",
        city: info.city ?? "",
        postcode: info.postcode ?? "",
        description: info.description ?? "",
      });
    }
  }, [info]);

  const handleSave = async () => {
    const phoneErr = validatePhone(editForm.phone, { required: false });
    const emailErr = validateEmail(editForm.email, { required: false });
    if (phoneErr) { toast({ title: "Klaida", description: phoneErr, variant: "destructive" }); return; }
    if (emailErr) { toast({ title: "Klaida", description: emailErr, variant: "destructive" }); return; }
    if (editForm.websiteUrl && !/^https?:\/\/.+\..+/.test(editForm.websiteUrl)) {
      toast({ title: "Klaida", description: "Įveskite teisingą URL", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (editForm.phone !== (info?.phone ?? "")) body.phone = editForm.phone;
      if (editForm.email !== (info?.email ?? "")) body.email = editForm.email;
      if (editForm.companyName !== (info?.companyName ?? "")) body.companyName = editForm.companyName;
      if (editForm.registrationCode !== (info?.registrationCode ?? "")) body.registrationCode = editForm.registrationCode;
      if (editForm.vatNumber !== (info?.vatNumber ?? "")) body.vatNumber = editForm.vatNumber;
      if (editForm.websiteUrl !== (info?.websiteUrl ?? "")) body.websiteUrl = editForm.websiteUrl;
      if (editForm.address !== (info?.address ?? "")) body.address = editForm.address;
      if (editForm.city !== (info?.city ?? "")) body.city = editForm.city;
      if (editForm.postcode !== (info?.postcode ?? "")) body.postcode = editForm.postcode;
      if (editForm.description !== (info?.description ?? "")) body.description = editForm.description;
      if (Object.keys(body).length === 0) { setEditing(false); return; }
      const result = await customFetch<{ directUpdated: string[]; reviewSubmitted: string[] }>(
        `${API_URL}/owner/business-info`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      await qc.invalidateQueries({ queryKey: ["owner-business-info"] });
      const msgs: string[] = [];
      if (result.directUpdated?.length) msgs.push(`Kontaktai atnaujinti.`);
      if (result.reviewSubmitted?.length) msgs.push(`${result.reviewSubmitted.length} laukai pateikti peržiūrai.`);
      toast({ title: "Išsaugota", description: msgs.join(" ") || "Atnaujinta." });
      setEditing(false);
    } catch (e: unknown) {
      toast({ title: "Klaida", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="bg-card border rounded-2xl p-5 space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-64" /></div>;
  if (isError || !info) return null;

  const pendingFields: string[] = (() => {
    if (!info.pendingEdit) return [];
    try { return Object.keys(JSON.parse(info.pendingEdit.requestedData)); } catch { return []; }
  })();

  const fieldLabel: Record<string, string> = {
    companyName: "Juridinis pavadinimas", registrationCode: "Įmonės kodas",
    vatNumber: "PVM kodas", websiteUrl: "Svetainė", address: "Adresas",
    city: "Miestas", postcode: "Pašto kodas", description: "Aprašymas",
  };

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Verslo informacija</p>
            <p className="text-xs text-muted-foreground">{info.companyName ?? "Nepateikta"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {info.hasPendingEdit && (
            <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/40 text-xs gap-1">
              <Clock className="w-3 h-3" /> Laukia peržiūros
            </Badge>
          )}
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60">
          {info.hasPendingEdit && (
            <div className="mx-5 mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-muted-foreground flex gap-2">
              <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-0.5">Pakeitimai laukia administratoriaus peržiūros</p>
                <p className="text-xs">Laukai: {pendingFields.map(f => fieldLabel[f] ?? f).join(", ")}</p>
              </div>
            </div>
          )}

          {!editing ? (
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {[
                  { icon: <FileText className="w-3.5 h-3.5" />, label: "Juridinis pavadinimas", value: info.companyName },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: "Įmonės kodas", value: info.registrationCode },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: "PVM kodas", value: info.vatNumber },
                  { icon: <Globe className="w-3.5 h-3.5" />, label: "Svetainė", value: info.websiteUrl },
                  { icon: <MapPin className="w-3.5 h-3.5" />, label: "Adresas", value: [info.address, info.city, info.postcode].filter(Boolean).join(", ") || null },
                  { icon: <Phone className="w-3.5 h-3.5" />, label: "Telefonas", value: info.phone },
                  { icon: <Mail className="w-3.5 h-3.5" />, label: "El. paštas", value: info.email },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2">
                    <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      {value
                        ? <p className="font-medium truncate text-foreground">{value}</p>
                        : <p className="text-muted-foreground/50 italic text-xs">Nepateikta</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <div className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2 text-xs text-muted-foreground flex gap-1.5 items-start">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Telefono ir el. pašto pakeitimai įsigalios nedelsiant. Kiti laukai bus atnaujinti po administratoriaus peržiūros.
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Redaguoti
              </Button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefonas <span className="text-green-400 font-normal">(nedelsiant)</span>
                  </label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+370..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Mail className="w-3 h-3" /> El. paštas <span className="text-green-400 font-normal">(nedelsiant)</span>
                  </label>
                  <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="info@klubas.lt" />
                </div>
              </div>

              <div className="bg-muted/20 rounded-xl border border-border/60 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Laukai su peržiūra
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Juridinis pavadinimas</label>
                    <Input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} placeholder="UAB Pavadinimas" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Įmonės kodas</label>
                    <Input value={editForm.registrationCode} onChange={e => setEditForm(f => ({ ...f, registrationCode: e.target.value }))} placeholder="302457891" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">PVM kodas</label>
                    <Input value={editForm.vatNumber} onChange={e => setEditForm(f => ({ ...f, vatNumber: e.target.value }))} placeholder="LT302457891" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1"><Globe className="w-3 h-3" /> Svetainė</label>
                    <Input value={editForm.websiteUrl} onChange={e => setEditForm(f => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://klubas.lt" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Gatvė</label>
                    <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Laisvės al. 23" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Miestas</label>
                    <Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} placeholder="Kaunas" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1"><XCircle className="w-3.5 h-3.5" /> Atšaukti</Button>
                <Button size="sm" disabled={saving} onClick={handleSave} className="gap-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Išsaugoti
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OwnerFacilities() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const { t } = useI18n();
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
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const data = e["data"];
      if (data && typeof data === "object" && typeof (data as Record<string, unknown>)["error"] === "string") {
        return (data as Record<string, unknown>)["error"] as string;
      }
      if (typeof e["message"] === "string") return e["message"];
    }
    return fallback;
  };

  const validateContactFields = (data: typeof formData): string | null => {
    const e = validateEmail(data.email, { required: false });
    if (e) return e;
    const p = validatePhone(data.phone, { required: false });
    if (p) return p;
    return null;
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

  const submitForVerificationMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch<{ verificationStatus: string }>(`${API_URL}/facilities/${id}/submit-for-verification`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["owner-facilities"] });
      if (data?.verificationStatus === "pending_verification") {
        toast({
          title: "Pateikta patvirtinimui",
          description: "Administratorius peržiūrės jūsų objektą per kelias darbo dienas.",
        });
      } else if (data?.verificationStatus === "onboarding") {
        toast({
          title: "Užbaikite Stripe Connect",
          description: "Duomenys įrašyti, bet dar reikia užbaigti Stripe registraciją.",
        });
      } else {
        toast({ title: "Statusas atnaujintas" });
      }
    },
    onError: (err) => {
      const detail = extractApiError(err, "Patikrinkite, ar užpildėte visus privalomus duomenis.");
      toast({
        title: "Negalima pateikti patvirtinimui",
        description: detail,
        variant: "destructive",
      });
    },
  });

  const handleSubmitForVerification = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    submitForVerificationMutation.mutate(id);
  };

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
    const contactErr = validateContactFields(formData);
    if (contactErr) {
      toast({ title: "Klaida", description: contactErr, variant: "destructive" });
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

  const handleDelete = (facility: FacilityWithCourts, e: React.MouseEvent) => {
    e.stopPropagation();
    const courtCount = facility.courtCount ?? 0;
    const warning = courtCount > 0
      ? `Ar tikrai norite ištrinti objektą „${facility.name}"?\n\nKartu bus negrįžtamai ištrinta:\n• ${courtCount} aikštelė(-s)\n• visos kainos, blokavimai ir nuotraukos\n• istorija (rezervacijos, atsiliepimai, žaidimai, turnyrai)\n\nVeiksmas negrįžtamas.`
      : `Ar tikrai norite ištrinti objektą „${facility.name}"? Veiksmas negrįžtamas.`;
    if (confirm(warning)) {
      deleteMutation.mutate(facility.id);
    }
  };

  const getFacilityImage = (f: FacilityWithCourts): string | null => {
    if (f.photos && f.photos.length > 0) return f.photos[0];
    const courtWithImage = (f.courts ?? []).find(c => c.imageUrl);
    return courtWithImage?.imageUrl || null;
  };

  const totalCourts = facilities?.reduce((sum, f) => sum + f.courtCount, 0) ?? 0;
  const ownerStripeStatus: StripeStatus = stripeStatusData?.status ?? "not_connected";
  const stripeActive = ownerStripeStatus === "active";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <BusinessInfoPanel />
        </div>

        {!stripeActive && (
          <div className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="font-semibold text-amber-950">
                {t("owner.stripeBanner.title")}
              </p>
            </div>
            <Button
              onClick={async () => {
                const r = await customFetch<{ url: string }>(`${API_URL}/stripe/connect`, { method: "POST" });
                window.open(r.url, "_blank", "noopener,noreferrer");
              }}
              className="gap-2 bg-amber-700 text-white hover:bg-amber-800 shadow-sm"
            >
              <CreditCard className="w-4 h-4" /> {t("owner.stripeBanner.cta")}
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
          <div className="flex items-center gap-2 flex-wrap">
            {stripeActive && (
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
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Naujas objektas
            </Button>
          </div>
        </div>

        {!isLoading && facilities && facilities.length > 0 && (
          <p className="mb-6 text-sm text-muted-foreground">
            {ltPlural(facilities.length, "objektas", "objektai", "objektų")} · {ltPlural(totalCourts, "aikštelė", "aikštelės", "aikštelių")}
          </p>
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
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6 border border-border">
              <Building2 className="w-10 h-10 text-muted-foreground" />
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
                  role="link"
                  tabIndex={0}
                  aria-label={`Atidaryti objektą ${facility.name}`}
                  onClick={() => navigate(`/owner/facility/${facility.id}`)}
                  onKeyDown={(e) => {
                    if (e.currentTarget !== e.target) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/owner/facility/${facility.id}`);
                    }
                  }}
                  className="group bg-card border rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="relative h-32 bg-muted overflow-hidden">
                    {image ? (
                      <img
                        src={image.startsWith("http") ? image : `${BASE_URL}/${image}`}
                        alt={facility.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Building2 className="w-16 h-16 text-muted-foreground/60" />
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
                      <button
                        onClick={(e) => handleDelete(facility, e)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg bg-black/50 text-red-400 hover:bg-black/70 transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Ištrinti"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

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
                        <span className="font-semibold text-sm text-foreground">
                          {ltPlural(facility.courtCount, "aikštelė", "aikštelės", "aikštelių")}
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

                    {(facility.verificationStatus === "draft" || facility.verificationStatus === "onboarding") && facility.verificationNotes && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Administratoriaus pastaba
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{facility.verificationNotes}</p>
                      </div>
                    )}

                    {(facility.verificationStatus === "draft" || facility.verificationStatus === "onboarding") && (
                      <div className="mt-3">
                        <Button
                          variant={stripeActive ? "default" : "secondary"}
                          size="sm"
                          className="w-full gap-2"
                          onClick={(e) => handleSubmitForVerification(facility.id, e)}
                          disabled={submitForVerificationMutation.isPending || !stripeActive}
                          title={!stripeActive ? "Prijunkite Stripe sąskaitą norėdami pateikti" : undefined}
                        >
                          {submitForVerificationMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Pateikti patvirtinimui
                        </Button>
                        {!stripeActive && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Prijunkite Stripe sąskaitą norėdami pateikti patvirtinimui.
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
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
