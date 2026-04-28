// Lightweight modal that lets non-signed-in users complete checkout as a guest.
// On submit it calls `onSubmit({customerName, customerEmail, customerPhone})` which
// the caller wires to the existing handleReserve(overrideData) booking flow.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { LogIn, User, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { customerName: string; customerEmail: string; customerPhone?: string }) => Promise<void> | void;
  onSignIn: () => void;
  submitting?: boolean;
}

export function GuestCheckoutDialog({ open, onOpenChange, onSubmit, onSignIn, submitting }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Įveskite vardą";
    if (!email.trim()) e.email = "Įveskite el. paštą";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Neteisingas el. paštas";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    await onSubmit({
      customerName: name.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Rezervacija be paskyros
          </DialogTitle>
          <DialogDescription>
            Įveskite kontaktus — atsiųsime patvirtinimą el. paštu su nuoroda rezervacijai valdyti.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <Label htmlFor="guest-name">Vardas, pavardė *</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
              placeholder="Vardenis Pavardenis"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="guest-email">El. paštas *</Label>
            <Input
              id="guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="vardas@example.com"
              inputMode="email"
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Šiuo el. paštu gausite Stripe čekį ir rezervacijos valdymo nuorodą.
            </p>
          </div>
          <div>
            <Label htmlFor="guest-phone">Telefonas (neprivaloma)</Label>
            <Input
              id="guest-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+370 ..."
              inputMode="tel"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { onOpenChange(false); onSignIn(); }}
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Turiu paskyrą
            </Button>
            <Button type="submit" className="button-primary w-full sm:w-auto" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Tęsti į apmokėjimą
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
