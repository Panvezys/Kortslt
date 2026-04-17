import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, FileUp, Camera, Plus, Trash2, CheckCircle2,
  ArrowRight, ArrowLeft, Upload, Loader2, MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const SPORT_TYPES = [
  { value: "tennis", label: "🎾 Tenisas" },
  { value: "basketball", label: "🏀 Krepšinis" },
  { value: "padel", label: "🏓 Padelis" },
  { value: "football", label: "⚽ Futbolas" },
  { value: "badminton", label: "🏸 Badmintonas" },
  { value: "squash", label: "🎯 Skvošas" },
  { value: "table_tennis", label: "🏓 Stalo tenisas" },
  { value: "golf", label: "🏌️ Golfas" },
  { value: "snooker", label: "🎱 Snukeris" },
  { value: "bowling", label: "🎳 Boulingas" },
];

const SURFACE_TYPES = [
  { value: "hard", label: "Kietoji danga" },
  { value: "clay", label: "Molis" },
  { value: "grass", label: "Žolė" },
  { value: "synthetic", label: "Sintetika" },
  { value: "wood", label: "Medis" },
  { value: "rubber", label: "Guma" },
  { value: "other", label: "Kita" },
];

const AMENITIES = [
  { id: "floodlights", label: "Prožektoriai" },
  { id: "showers", label: "Dušai" },
  { id: "changing_rooms", label: "Persirengimo kambariai" },
  { id: "parking", label: "Parkavimas" },
  { id: "toilets", label: "Tualetai" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "cafe", label: "Kavinė / Baras" },
  { id: "first_aid", label: "Pirmoji pagalba" },
  { id: "heating", label: "Šildymas" },
  { id: "air_conditioning", label: "Oro kondicionierius" },
  { id: "lockers", label: "Spintelės" },
  { id: "sauna", label: "Pirtis" },
];

const EQUIPMENT = [
  { id: "rackets", label: "Raketės" },
  { id: "balls", label: "Kamuoliai" },
  { id: "nets", label: "Tinklai" },
  { id: "shoes", label: "Sportiniai bateliai" },
  { id: "towels", label: "Rankšluosčiai" },
  { id: "water", label: "Vanduo" },
  { id: "other", label: "Kita įranga" },
];

const CITIES = [
  "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys",
  "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena",
  "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas",
  "Plungė", "Palanga", "Druskininkai", "Elektrėnai", "Rokiškis",
  "Biržai", "Garliava", "Kuršėnai", "Jurbarkas",
];

interface CourtDraft {
  id: string;
  name: string;
  type: string;
  surface: string;
  pricePerHour: string;
  isIndoor: boolean;
  maxPlayers: number;
  amenities: string[];
}

const STEPS = [
  { num: 1, label: "Įmonės profilis", icon: Building2 },
  { num: 2, label: "Verifikacija", icon: FileUp },
  { num: 3, label: "Aikštelės info", icon: Camera },
  { num: 4, label: "Aikštelių kūrimas", icon: Plus },
];

export default function OwnerOnboard() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [facilityId, setFacilityId] = useState<number | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [verificationDocUrl, setVerificationDocUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [facilityName, setFacilityName] = useState("");
  const [facilityDescription, setFacilityDescription] = useState("");
  const [facilityPhotos, setFacilityPhotos] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [courts, setCourts] = useState<CourtDraft[]>([
    { id: "1", name: "", type: "tennis", surface: "hard", pricePerHour: "", isIndoor: false, maxPlayers: 4, amenities: [] },
  ]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/sign-in"); return; }

    fetch(`${API_URL}/owner/onboard/status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.completed) {
          setLocation("/owner");
          return;
        }
        if (data.facility) {
          setFacilityId(data.facility.id);
          setCompanyName(data.facility.companyName ?? "");
          setRegistrationCode(data.facility.registrationCode ?? "");
          setAddress(data.facility.address ?? "");
          setCity(data.facility.city ?? "");
          setPhone(data.facility.phone ?? "");
          setEmail(data.facility.email ?? "");
          setVerificationDocUrl(data.facility.verificationDocUrl ?? "");
          setFacilityName(data.facility.name ?? "");
          setFacilityDescription(data.facility.description ?? "");
          setFacilityPhotos(data.facility.photos ?? []);
          setSelectedEquipment(data.facility.equipment ?? []);
        }
        if (data.currentStep > 1 && data.currentStep <= 4) {
          setStep(data.currentStep);
        }
        setCheckingStatus(false);
      })
      .catch(() => setCheckingStatus(false));
  }, [isLoaded, isSignedIn, setLocation]);

  const handleStep1 = useCallback(async () => {
    if (!companyName || !registrationCode || !address || !city) {
      toast({ title: "Užpildykite visus privalomus laukus", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/owner/onboard/step1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyName, registrationCode, address, city, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFacilityId(data.id);
      setStep(2);
      toast({ title: "Įmonės profilis išsaugotas" });
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyName, registrationCode, address, city, phone, email, toast]);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("doc", file);
      const res = await fetch(`${API_URL}/upload/ownership-doc`, { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerificationDocUrl(data.path);
      toast({ title: "Dokumentas įkeltas" });
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const handleStep2 = useCallback(async () => {
    if (!verificationDocUrl || !facilityId) {
      toast({ title: "Įkelkite verifikacijos dokumentą", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/owner/onboard/step2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ facilityId, verificationDocUrl }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      setStep(3);
      toast({ title: "Dokumentas pateiktas verifikacijai" });
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [verificationDocUrl, facilityId, toast]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${API_URL}/upload/court-image`, { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFacilityPhotos(prev => [...prev, data.path]);
      toast({ title: "Nuotrauka įkelta" });
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }, [toast]);

  const handleStep3 = useCallback(async () => {
    if (!facilityName || !facilityId) {
      toast({ title: "Įveskite aikštelės pavadinimą", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/owner/onboard/step3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          facilityId,
          name: facilityName,
          description: facilityDescription,
          photos: facilityPhotos,
          equipment: selectedEquipment,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      setStep(4);
      toast({ title: "Aikštelės informacija išsaugota" });
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [facilityName, facilityDescription, facilityPhotos, selectedEquipment, facilityId, toast]);

  const handleStep4 = useCallback(async () => {
    const valid = courts.every(c => c.name && c.type && c.pricePerHour);
    if (!valid || !facilityId) {
      toast({ title: "Užpildykite visų aikštelių privalomus laukus", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/owner/onboard/step4`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          facilityId,
          courts: courts.map(c => ({
            name: c.name,
            type: c.type,
            surface: c.surface,
            pricePerHour: c.pricePerHour,
            isIndoor: c.isIndoor,
            maxPlayers: c.maxPlayers,
            amenities: c.amenities,
            address,
            city,
          })),
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      toast({ title: "Aikštelės sukurtos sėkmingai! 🎉" });
      setLocation("/owner");
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [courts, facilityId, address, city, toast, setLocation]);

  const addCourt = () => {
    setCourts(prev => [
      ...prev,
      { id: String(Date.now()), name: "", type: "tennis", surface: "hard", pricePerHour: "", isIndoor: false, maxPlayers: 4, amenities: [] },
    ]);
  };

  const removeCourt = (id: string) => {
    if (courts.length <= 1) return;
    setCourts(prev => prev.filter(c => c.id !== id));
  };

  const updateCourt = (id: string, field: string, value: any) => {
    setCourts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const toggleCourtAmenity = (courtId: string, amenityId: string) => {
    setCourts(prev => prev.map(c => {
      if (c.id !== courtId) return c;
      const has = c.amenities.includes(amenityId);
      return { ...c, amenities: has ? c.amenities.filter(a => a !== amenityId) : [...c.amenities, amenityId] };
    }));
  };

  if (!isLoaded || checkingStatus) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <Layout>
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Savininko registracija
            </h1>
            <p className="text-muted-foreground">
              Užpildykite informaciją ir pridėkite savo sporto aikštelę prie korts.lt platformos.
            </p>
          </div>

          <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  step === s.num
                    ? "bg-primary text-primary-foreground"
                    : step > s.num
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step > s.num ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <s.icon className="h-4 w-4" />
                  )}
                  <span className="whitespace-nowrap hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.num}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 mx-1 ${step > s.num ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <div className="bg-background rounded-2xl border p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Įmonės profilis</h2>
                    <p className="text-sm text-muted-foreground">Pateikite juridinę informaciją apie jūsų įmonę arba individualią veiklą.</p>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="companyName">Įmonės pavadinimas *</Label>
                        <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="UAB Sporto aikštelės" className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="regCode">Įmonės kodas *</Label>
                        <Input id="regCode" value={registrationCode} onChange={e => setRegistrationCode(e.target.value)} placeholder="123456789" className="mt-1.5" />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Adresas *</Label>
                      <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Sporto g. 15" className="mt-1.5" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">Miestas *</Label>
                        <Select value={city} onValueChange={setCity}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Pasirinkite miestą" />
                          </SelectTrigger>
                          <SelectContent>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefonas</Label>
                        <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+370 600 00000" className="mt-1.5" />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Kontaktinis el. paštas</Label>
                      <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@jusuimonė.lt" className="mt-1.5" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleStep1} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Toliau
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="bg-background rounded-2xl border p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Verifikacija</h2>
                    <p className="text-sm text-muted-foreground">
                      Įkelkite verslo licenciją, registracijos pažymėjimą arba asmens dokumentą.
                      Mūsų komanda peržiūrės dokumentą per 24 valandas.
                    </p>
                  </div>

                  <div className="border-2 border-dashed rounded-xl p-8 text-center">
                    {verificationDocUrl ? (
                      <div className="space-y-3">
                        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                        <p className="font-medium text-primary">Dokumentas įkeltas</p>
                        <p className="text-sm text-muted-foreground break-all">{verificationDocUrl.split("/").pop()}</p>
                        <label className="cursor-pointer">
                          <span className="text-sm text-primary hover:underline">Pakeisti dokumentą</span>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleDocUpload} />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium mb-1">Pasirinkite failą</p>
                        <p className="text-sm text-muted-foreground">PDF, JPG, PNG (iki 16MB)</p>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleDocUpload} />
                        {uploading && <Loader2 className="h-5 w-5 animate-spin mx-auto mt-3 text-primary" />}
                      </label>
                    )}
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">ℹ️ Priimami dokumentai:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      <li>Individualios veiklos pažymėjimas</li>
                      <li>Įmonės registracijos pažymėjimas</li>
                      <li>Verslo licencija</li>
                      <li>Asmens dokumentas (pasas arba tapatybės kortelė)</li>
                    </ul>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Atgal
                    </Button>
                    <Button onClick={handleStep2} disabled={loading || !verificationDocUrl} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Toliau
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="bg-background rounded-2xl border p-6 md:p-8 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Aikštelės informacija</h2>
                    <p className="text-sm text-muted-foreground">Aprašykite savo sporto aikštelę ir įkelkite nuotraukas.</p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="facilityName">Aikštelės pavadinimas *</Label>
                      <Input id="facilityName" value={facilityName} onChange={e => setFacilityName(e.target.value)} placeholder="pvz., SEB Arena Sporto centras" className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor="facilityDesc">Aprašymas</Label>
                      <Textarea id="facilityDesc" value={facilityDescription} onChange={e => setFacilityDescription(e.target.value)} placeholder="Trumpas aikštelės aprašymas..." rows={3} className="mt-1.5" />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Nuotraukos</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {facilityPhotos.map((photo, i) => (
                        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border">
                          <img src={`${base}/${photo}`} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setFacilityPhotos(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="cursor-pointer aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        {uploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 mb-1" />}
                        <span className="text-[10px]">Pridėti</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-3 block">Turima įranga</Label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT.map(eq => (
                        <label
                          key={eq.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-all ${
                            selectedEquipment.includes(eq.id) ? "border-primary bg-primary/5 text-primary" : "hover:border-primary/30"
                          }`}
                        >
                          <Checkbox
                            checked={selectedEquipment.includes(eq.id)}
                            onCheckedChange={() => {
                              setSelectedEquipment(prev =>
                                prev.includes(eq.id) ? prev.filter(e => e !== eq.id) : [...prev, eq.id]
                              );
                            }}
                          />
                          {eq.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Atgal
                    </Button>
                    <Button onClick={handleStep3} disabled={loading || !facilityName} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Toliau
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-background rounded-2xl border p-6 md:p-8">
                    <div className="mb-6">
                      <h2 className="text-xl font-bold mb-1">Aikštelių kūrimas</h2>
                      <p className="text-sm text-muted-foreground">
                        Pridėkite aikšteles, kurias norite siūlyti klientams. Galite pridėti kelias skirtingų sporto šakų aikšteles.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {courts.map((court, idx) => (
                        <div key={court.id} className="border rounded-xl p-5 space-y-4 relative">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm">Aikštelė #{idx + 1}</h3>
                            {courts.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeCourt(court.id)} className="text-destructive hover:text-destructive h-8">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Pašalinti
                              </Button>
                            )}
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label>Aikštelės pavadinimas *</Label>
                              <Input
                                value={court.name}
                                onChange={e => updateCourt(court.id, "name", e.target.value)}
                                placeholder="pvz., Aikštelė Nr. 1"
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label>Sporto šaka *</Label>
                              <Select value={court.type} onValueChange={v => updateCourt(court.id, "type", v)}>
                                <SelectTrigger className="mt-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SPORT_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                              <Label>Dangos tipas</Label>
                              <Select value={court.surface} onValueChange={v => updateCourt(court.id, "surface", v)}>
                                <SelectTrigger className="mt-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SURFACE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Kaina per valandą (€) *</Label>
                              <Input
                                type="number"
                                value={court.pricePerHour}
                                onChange={e => updateCourt(court.id, "pricePerHour", e.target.value)}
                                placeholder="15.00"
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label>Maks. žaidėjų sk.</Label>
                              <Input
                                type="number"
                                value={court.maxPlayers}
                                onChange={e => updateCourt(court.id, "maxPlayers", parseInt(e.target.value) || 4)}
                                className="mt-1.5"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={court.isIndoor}
                              onCheckedChange={v => updateCourt(court.id, "isIndoor", !!v)}
                            />
                            <Label className="cursor-pointer">Uždara aikštelė (indoor)</Label>
                          </div>

                          <div>
                            <Label className="mb-2 block">Patogumai</Label>
                            <div className="flex flex-wrap gap-2">
                              {AMENITIES.map(a => (
                                <label
                                  key={a.id}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                    court.amenities.includes(a.id) ? "border-primary bg-primary/5 text-primary" : "hover:border-primary/30"
                                  }`}
                                >
                                  <Checkbox
                                    checked={court.amenities.includes(a.id)}
                                    onCheckedChange={() => toggleCourtAmenity(court.id, a.id)}
                                    className="h-3.5 w-3.5"
                                  />
                                  {a.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" onClick={addCourt} className="mt-4 gap-2 w-full">
                      <Plus className="h-4 w-4" />
                      Pridėti dar vieną aikštelę
                    </Button>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                    <p>💡 <strong>Patarimas:</strong> Galėsite bet kada redaguoti aikštelių informaciją, pridėti nuotraukas ir keisti kainas iš savininko valdymo pulto.</p>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Atgal
                    </Button>
                    <Button onClick={handleStep4} disabled={loading} className="gap-2 bg-primary hover:bg-primary/90">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Užbaigti registraciją
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
