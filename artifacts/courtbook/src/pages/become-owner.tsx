import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useRole } from "@/lib/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { LocationPicker, type LocationPickerResult } from "@/components/location-picker";
import {
  ArrowLeft, CheckCircle2, Building2, Loader2, Globe, Phone, Mail,
  FileText, MapPin, AlertTriangle,
} from "lucide-react";
import { validateEmail, validatePhone } from "@/lib/validators";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export default function BecomeOwnerPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { isPending, isOwner } = useRole();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [mapKey] = useState(() => Math.random());

  const [form, setForm] = useState({
    companyName: "",
    registrationCode: "",
    address: "",
    city: "",
    postcode: "",
    latitude: 0,
    longitude: 0,
    phone: user?.phoneNumbers?.[0]?.phoneNumber ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    vatNumber: "",
    websiteUrl: "",
    description: "",
  });

  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const emailError = form.email ? validateEmail(form.email) : "El. paštas yra privalomas";
  const phoneError = validatePhone(form.phone, { required: false });
  const websiteError =
    form.websiteUrl && !/^https?:\/\/.+\..+/.test(form.websiteUrl)
      ? "Įveskite teisingą URL (pvz. https://klubas.lt)"
      : null;

  const canSubmit =
    form.companyName.trim().length >= 2 &&
    form.registrationCode.trim().length >= 2 &&
    form.address.trim().length >= 2 &&
    form.city.trim().length >= 2 &&
    !emailError &&
    !phoneError &&
    !websiteError;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/me/request-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pendingRole: "owner",
          requestData: {
            companyName: form.companyName,
            registrationCode: form.registrationCode,
            address: form.address,
            city: form.city,
            postcode: form.postcode,
            latitude: form.latitude || undefined,
            longitude: form.longitude || undefined,
            phone: form.phone,
            email: form.email,
            vatNumber: form.vatNumber || undefined,
            websiteUrl: form.websiteUrl || undefined,
            description: form.description,
          },
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Klaida");
      }
      await qc.invalidateQueries({ queryKey: ["me-role"] });
      setDone(true);
    } catch (e: unknown) {
      toast({ title: "Klaida", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3">Prašymas pateiktas!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Jūsų savininko registracijos prašymas išsiųstas administratoriui. Patvirtinus galėsite pridėti savo aikšteles. Galite sekti prašymo būseną savo profilyje.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setLocation("/profile")} className="w-full">
              Sekti prašymo būseną
            </Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="w-full">
              Grįžti į pagrindinį
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Jūs jau esate savininkas!</h2>
          <p className="text-muted-foreground text-sm mb-5">Eikite į savininko skydelį valdyti savo aikštelių.</p>
          <Button onClick={() => setLocation("/owner")} className="w-full">Savininko skydelis</Button>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Prašymas jau pateiktas</h2>
          <p className="text-muted-foreground text-sm mb-5">Jūsų prašymas šiuo metu peržiūrimas. Galite sekti prašymo būseną savo profilyje.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setLocation("/profile")} className="w-full">Žiūrėti prašymo būseną</Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="w-full">Grįžti į pagrindinį</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Atgal
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
            <Building2 className="w-3.5 h-3.5" />
            Savininko registracija
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Tapkite aikštelės savininku</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Užpildykite formą — po patvirtinimo galėsite pridėti savo aikšteles ir priimti rezervacijas.
          </p>
        </div>

        <div className="space-y-8">

          {/* Required — Company Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Juridinė informacija</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Juridinis pavadinimas *</Label>
                <Input
                  value={form.companyName}
                  onChange={e => set("companyName", e.target.value)}
                  placeholder="pvz. Kaunas Tennis UAB"
                />
                <p className="text-xs text-muted-foreground">Pavadinimas registruotas valstybėje. Reikalingas sąskaitų išrašymui.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Įmonės kodas *</Label>
                <Input
                  value={form.registrationCode}
                  onChange={e => set("registrationCode", e.target.value)}
                  placeholder="pvz. 302457891"
                />
                <p className="text-xs text-muted-foreground">Oficialus juridinio asmens kodas.</p>
              </div>

              <div className="space-y-1.5">
                <Label>PVM kodas <span className="text-muted-foreground font-normal">(neprivaloma)</span></Label>
                <Input
                  value={form.vatNumber}
                  onChange={e => set("vatNumber", e.target.value)}
                  placeholder="pvz. LT302457891"
                />
                <p className="text-xs text-muted-foreground">Nereikalinga mažiems klubams be PVM registracijos.</p>
              </div>
            </div>
          </section>

          {/* Required — Address */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fizinis adresas *</h2>
            </div>

            <LocationPicker
              key={mapKey}
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(result: LocationPickerResult) => {
                setForm(prev => ({
                  ...prev,
                  latitude: result.lat,
                  longitude: result.lng,
                  ...(result.address ? { address: result.address } : {}),
                  ...(result.city ? { city: result.city } : {}),
                  ...(result.postcode != null ? { postcode: result.postcode } : {}),
                }));
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Gatvė ir namo numeris *</Label>
                <Input
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  placeholder="pvz. Laisvės al. 23"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pašto kodas</Label>
                <Input
                  value={form.postcode}
                  onChange={e => set("postcode", e.target.value)}
                  placeholder="LT-XXXXX"
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Miestas *</Label>
                <Input
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  placeholder="Kaunas"
                />
              </div>
            </div>
          </section>

          {/* Required — Contact */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Phone className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Viešieji kontaktai</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Telefono numeris *
                </Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="+370 600 00000"
                />
                {phoneError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{phoneError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Žaidėjai skambina į registratūrą.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> El. paštas *
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="info@klubas.lt"
                />
                {emailError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{emailError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Klientų aptarnavimo adresas.</p>
              </div>
            </div>
          </section>

          {/* Optional — Online presence + Description */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Globe className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Papildoma informacija <span className="text-muted-foreground/60 normal-case font-normal">(rekomenduojama)</span>
              </h2>
            </div>

            <div className="space-y-1.5">
              <Label>Svetainė arba socialiniai tinklai</Label>
              <Input
                value={form.websiteUrl}
                onChange={e => set("websiteUrl", e.target.value)}
                placeholder="https://klubas.lt arba https://facebook.com/klubas"
              />
              {websiteError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{websiteError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Padeda patvirtinti jūsų tapatybę.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Aprašymas</Label>
              <Textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Trumpai apibūdinkite savo sporto objektą: tipas, patalpos (dušai, parkavimas, kavinė)..."
                rows={4}
              />
            </div>
          </section>

          <div className="bg-muted/40 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Kas nutiks po patvirtinimo?</p>
            <ul className="space-y-1">
              {[
                "Gausite el. laišką su patvirtinimu",
                "Galėsite prisijungti prie savininko skydelio",
                "Pradėsite aikštelių kūrimo procesą",
                "Norėdami gauti mokėjimus, reikės sukonfigūruoti Stripe",
              ].map(t => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <Button className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Pateikti prašymą
          </Button>
        </div>
      </div>
    </div>
  );
}
