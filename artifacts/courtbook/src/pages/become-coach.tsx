import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useRole } from "@/lib/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Trophy, Loader2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_OPTIONS = [
  { key: "tennis", label: "Tenisas" },
  { key: "basketball", label: "Krepšinis" },
  { key: "padel", label: "Padelis" },
  { key: "football", label: "Futbolas" },
  { key: "badminton", label: "Badmintonas" },
  { key: "squash", label: "Skvoše" },
  { key: "table_tennis", label: "Stalo tenisas" },
  { key: "golf", label: "Golfas" },
  { key: "volleyball", label: "Tinklinis" },
  { key: "swimming", label: "Plaukimas" },
];

type Step = 1 | 2 | 3;

interface FormData {
  name: string;
  email: string;
  phone: string;
  bio: string;
  sports: string[];
  experience: string;
  certifications: string;
  pricePerHour: string;
  availabilityDescription: string;
}

export default function BecomeCoachPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { role, isPending, isCoach } = useRole();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: user?.fullName ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    phone: "",
    bio: "",
    sports: [],
    experience: "",
    certifications: "",
    pricePerHour: "",
    availabilityDescription: "",
  });

  const set = (field: keyof FormData, value: string | string[]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const toggleSport = (key: string) =>
    set("sports", form.sports.includes(key)
      ? form.sports.filter(s => s !== key)
      : [...form.sports, key]);

  const emailError = validateEmail(form.email);
  const phoneError = validatePhone(form.phone, { required: false });
  const canNext1 =
    form.name.trim().length > 1 &&
    form.bio.trim().length > 20 &&
    !emailError &&
    !phoneError;
  const canNext2 = form.sports.length > 0;
  const canSubmit = form.pricePerHour.trim().length > 0 && !emailError && !phoneError;

  async function submit() {
    if (emailError) {
      toast({ title: "Klaida", description: emailError, variant: "destructive" });
      return;
    }
    if (phoneError) {
      toast({ title: "Klaida", description: phoneError, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/me/request-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pendingRole: "coach",
          requestData: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            bio: form.bio,
            sports: form.sports,
            experience: form.experience,
            certifications: form.certifications,
            pricePerHour: form.pricePerHour ? parseFloat(form.pricePerHour) : null,
            availabilityDescription: form.availabilityDescription,
          },
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Klaida");
      }
      await qc.invalidateQueries({ queryKey: ["me-role"] });
      setDone(true);
    } catch (e: any) {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
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
            Jūsų trenerio registracijos prašymas išsiųstas administratoriui. Paprastai atsakymą gausite per 24 val.
          </p>
          <Button onClick={() => setLocation("/")} className="w-full">
            Grįžti į pagrindinį puslapį
          </Button>
        </div>
      </div>
    );
  }

  if (isPending || isCoach) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {isCoach ? "Jūs jau esate treneris!" : "Prašymas jau pateiktas"}
          </h2>
          <p className="text-muted-foreground text-sm mb-5">
            {isCoach
              ? "Valdykite savo profilį trenerio skydelyje."
              : "Jūsų trenerio prašymas šiuo metu peržiūrimas. Palaukite administratoriaus patvirtinimo."}
          </p>
          <Button onClick={() => setLocation(isCoach ? "/coach/me" : "/")} className="w-full">
            {isCoach ? "Trenerio skydelis" : "Grįžti į pagrindinį"}
          </Button>
        </div>
      </div>
    );
  }

  const STEPS = ["Apie jus", "Sportas", "Kainodara"];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Back */}
        <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Atgal
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
            <Trophy className="w-3.5 h-3.5" />
            Trenerio registracija
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Tapkite treneriu korts.lt</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Užpildykite formą — administratorius peržiūrės per 24 val.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  active ? "bg-primary text-primary-foreground" :
                  done ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 w-6 transition-colors ${done ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: About */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Vardas ir pavardė *</label>
              <Input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Jonas Jonaitis"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">El. paštas *</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="jonas@example.lt"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Telefono numeris</label>
              <Input
                type="tel"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                placeholder="+370 600 00000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Apie jus *
                <span className="text-muted-foreground font-normal ml-1 text-xs">(min. 20 simbolių)</span>
              </label>
              <Textarea
                value={form.bio}
                onChange={e => set("bio", e.target.value)}
                placeholder="Esu sertifikuotas teniso treneris su 10 metų patirtimi. Dirbu tiek su pradedančiaisiais, tiek su pažengusiais žaidėjais..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">{form.bio.length} / 500 simbolių</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Patirtis (metai)</label>
              <Input
                type="number"
                min="0"
                max="50"
                value={form.experience}
                onChange={e => set("experience", e.target.value)}
                placeholder="pvz.: 5"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Sertifikatai / kvalifikacija</label>
              <Input
                value={form.certifications}
                onChange={e => set("certifications", e.target.value)}
                placeholder="pvz.: LTF A lygio treneris, UEFA C licencija"
              />
            </div>
            <Button
              className="w-full"
              disabled={!canNext1}
              onClick={() => setStep(2)}
            >
              Toliau
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        )}

        {/* Step 2: Sports */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground block mb-3">
                Kurį sportą treniruojate? *
                <span className="text-muted-foreground font-normal ml-1 text-xs">(pasirinkite bent vieną)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SPORT_OPTIONS.map(s => {
                  const sel = form.sports.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSport(s.key)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        sel
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-foreground hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      {sel && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Atgal
              </Button>
              <Button className="flex-1" disabled={!canNext2} onClick={() => setStep(3)}>
                Toliau
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Valandinis įkainis (€) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  step="0.5"
                  className="pl-8"
                  value={form.pricePerHour}
                  onChange={e => set("pricePerHour", e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Prieinamumas / darbo laikas
              </label>
              <Textarea
                value={form.availabilityDescription}
                onChange={e => set("availabilityDescription", e.target.value)}
                placeholder="pvz.: Pirmadieniais–penktadieniais 9:00–18:00, savaitgaliais pagal susitarimą"
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Santrauka</p>
              <p className="text-sm"><span className="text-muted-foreground">Vardas:</span> <span className="font-medium">{form.name}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Sportas:</span> <span className="font-medium">{form.sports.join(", ")}</span></p>
              {form.pricePerHour && <p className="text-sm"><span className="text-muted-foreground">Kaina:</span> <span className="font-medium">€{form.pricePerHour}/val.</span></p>}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Atgal
              </Button>
              <Button
                className="flex-1"
                disabled={!canSubmit || submitting}
                onClick={submit}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                )}
                Pateikti prašymą
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
