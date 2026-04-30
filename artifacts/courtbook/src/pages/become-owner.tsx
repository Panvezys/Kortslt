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
  ArrowLeft, ArrowRight, CheckCircle2, Building2, Loader2,
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

  const [form, setForm] = useState({
    name: user?.fullName ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    phone: "",
    companyName: "",
    city: "",
    description: "",
  });

  const set = (field: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const emailError = validateEmail(form.email);
  const phoneError = validatePhone(form.phone, { required: false });
  const canSubmit =
    form.name.trim().length > 1 &&
    form.city.trim().length > 1 &&
    !emailError &&
    !phoneError;

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
          pendingRole: "owner",
          requestData: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            companyName: form.companyName,
            city: form.city,
            description: form.description,
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
            Jūsų savininko registracijos prašymas išsiųstas administratoriui. Patvirtinus galėsite pridėti savo aikšteles. Paprastai atsakymą gausite per 24 val.
          </p>
          <Button onClick={() => setLocation("/")} className="w-full">
            Grįžti į pagrindinį puslapį
          </Button>
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
          <p className="text-muted-foreground text-sm mb-5">Jūsų prašymas šiuo metu peržiūrimas. Palaukite administratoriaus patvirtinimo.</p>
          <Button variant="outline" onClick={() => setLocation("/")} className="w-full">Grįžti į pagrindinį</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
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
          <p className="text-muted-foreground text-sm mt-1.5">Užpildykite formą — po patvirtinimo galėsite pridėti savo aikšteles ir priimti rezervacijas.</p>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-foreground block mb-1.5">Vardas ir pavardė *</label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Jonas Jonaitis" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">El. paštas</label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jonas@example.lt" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Telefonas</label>
              <Input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+370 600 00000" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Įmonės pavadinimas</label>
              <Input value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="UAB Sporto Centras" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Miestas *</label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Vilnius" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-foreground block mb-1.5">Aprašymas</label>
              <Textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Trumpai apibūdinkite savo sporto objektą: tipas, plotas, esamos aikštelės..."
                rows={4}
              />
            </div>
          </div>

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
