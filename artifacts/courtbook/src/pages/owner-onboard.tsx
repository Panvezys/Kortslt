import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, FileUp, CheckCircle2,
  ArrowRight, ArrowLeft, Upload, Loader2, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const CITIES = [
  "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys",
  "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena",
  "Kėdainiai", "Telšiai", "Tauragė", "Ukmergė", "Visaginas",
  "Plungė", "Palanga", "Druskininkai", "Elektrėnai", "Rokiškis",
  "Biržai", "Garliava", "Kuršėnai", "Jurbarkas",
];

const STEPS = [
  { num: 1, label: "Įmonės profilis", icon: Building2 },
  { num: 2, label: "Verifikacija", icon: FileUp },
];

export default function OwnerOnboard() {
  const { isLoaded, isSignedIn } = useUser();
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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/sign-in"); return; }

    fetch(`${API_URL}/owner/onboard/status`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.completed) { setLocation("/owner"); return; }
        if (data.facility) {
          setFacilityId(data.facility.id);
          setCompanyName(data.facility.companyName ?? "");
          setRegistrationCode(data.facility.registrationCode ?? "");
          setAddress(data.facility.address ?? "");
          setCity(data.facility.city ?? "");
          setPhone(data.facility.phone ?? "");
          setEmail(data.facility.email ?? "");
          setVerificationDocUrl(data.facility.verificationDocUrl ?? "");
        }
        if (data.currentStep === 2) setStep(2);
        setCheckingStatus(false);
      })
      .catch(() => setCheckingStatus(false));
  }, [isLoaded, isSignedIn, setLocation]);

  const clearError = (name: string) =>
    setFieldErrors(prev => ({ ...prev, [name]: "" }));

  const handleStep1 = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!companyName.trim()) errors.companyName = "Privalomas laukas";
    if (!registrationCode.trim()) errors.registrationCode = "Privalomas laukas";
    if (!address.trim()) errors.address = "Privalomas laukas";
    if (!city) errors.city = "Pasirinkite miestą";
    if (!phone.trim()) errors.phone = "Privalomas laukas";
    if (!email.trim()) errors.email = "Privalomas laukas";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Neteisingas el. pašto formatas";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
    if (!facilityId) {
      toast({ title: "Klaida: objektas nerastas", variant: "destructive" });
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
      toast({ title: "Paraiška pateikta! Peržiūrėsime per 24 val." });
      setLocation("/owner");
    } catch (err: any) {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [verificationDocUrl, facilityId, toast, setLocation]);

  if (!isLoaded || checkingStatus) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  function FieldError({ name }: { name: string }) {
    if (!fieldErrors[name]) return null;
    return <p className="text-xs text-destructive mt-1">{fieldErrors[name]}</p>;
  }

  function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
    const hasError = !!fieldErrors[htmlFor];
    return (
      <Label htmlFor={htmlFor} className={hasError ? "text-destructive" : ""}>
        {children}
        <span className="text-destructive ml-0.5">*</span>
      </Label>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-3xl">

          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                Savininko registracija
              </h1>
              <p className="text-muted-foreground">
                Užpildykite informaciją ir pateikite paraišką aikštelės pridėjimui į korts.lt platformą.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/list-your-court")}
              className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground mt-1"
              title="Uždaryti"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 mb-8">
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
                  <div className={`w-8 h-0.5 mx-1 ${step > s.num ? "bg-primary" : "bg-border"}`} />
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

                  <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                    <span className="text-destructive font-bold text-base leading-none">*</span>
                    Pažymėti laukai yra privalomi
                  </div>

                  <div className="grid gap-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <RequiredLabel htmlFor="companyName">Įmonės pavadinimas</RequiredLabel>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={e => { setCompanyName(e.target.value); clearError("companyName"); }}
                          placeholder="UAB Sporto aikštelės"
                          className={`mt-1.5 ${fieldErrors.companyName ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        />
                        <FieldError name="companyName" />
                      </div>
                      <div>
                        <RequiredLabel htmlFor="regCode">Įmonės kodas</RequiredLabel>
                        <Input
                          id="regCode"
                          value={registrationCode}
                          onChange={e => { setRegistrationCode(e.target.value); clearError("registrationCode"); }}
                          placeholder="123456789"
                          className={`mt-1.5 ${fieldErrors.registrationCode ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        />
                        <FieldError name="registrationCode" />
                      </div>
                    </div>

                    <div>
                      <RequiredLabel htmlFor="address">Adresas</RequiredLabel>
                      <Input
                        id="address"
                        value={address}
                        onChange={e => { setAddress(e.target.value); clearError("address"); }}
                        placeholder="Sporto g. 15"
                        className={`mt-1.5 ${fieldErrors.address ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      />
                      <FieldError name="address" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <RequiredLabel htmlFor="city">Miestas</RequiredLabel>
                        <Select value={city} onValueChange={v => { setCity(v); clearError("city"); }}>
                          <SelectTrigger className={`mt-1.5 ${fieldErrors.city ? "border-destructive" : ""}`}>
                            <SelectValue placeholder="Pasirinkite miestą" />
                          </SelectTrigger>
                          <SelectContent>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError name="city" />
                      </div>
                      <div>
                        <RequiredLabel htmlFor="phone">Telefonas</RequiredLabel>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={e => { setPhone(e.target.value); clearError("phone"); }}
                          placeholder="+370 600 00000"
                          className={`mt-1.5 ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                        />
                        <FieldError name="phone" />
                      </div>
                    </div>

                    <div>
                      <RequiredLabel htmlFor="email">Kontaktinis el. paštas</RequiredLabel>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearError("email"); }}
                        placeholder="info@jusuimone.lt"
                        className={`mt-1.5 ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                      />
                      <FieldError name="email" />
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
                    <p className="mt-2 text-xs opacity-70">Dokumentą galite įkelti vėliau — jis reikalingas aikštelių patvirtinimui.</p>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                      <ArrowLeft className="h-4 w-4" />
                      Atgal
                    </Button>
                    <Button onClick={handleStep2} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Pateikti paraišką
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
