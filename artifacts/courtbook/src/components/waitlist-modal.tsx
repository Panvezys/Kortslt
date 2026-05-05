import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BellRing, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  prefillEmail?: string;
  prefillName?: string;
}

export function WaitlistModal({
  open,
  onOpenChange,
  courtId,
  date,
  startTime,
  endTime,
  prefillEmail = "",
  prefillName = "",
}: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState(prefillEmail);
  const [name, setName] = useState(prefillName);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/waitlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ courtId, date, startTime, endTime, email: email.trim(), name: name.trim() || undefined }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Nepavyko");
      }
      setDone(true);
      toast({ title: "Įtraukta į eilę!", description: "Kai laikas atsilaisvins, informuosime el. paštu." });
    } catch (err) {
      toast({ title: "Klaida", description: err instanceof Error ? err.message : "Bandykite dar kartą.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            Laukiančiųjų eilė
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <BellRing className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold">Sėkmingai įtraukta!</p>
            <p className="text-sm text-muted-foreground">
              Pranešime el. paštu {email}, kai šis laikas atsilaisvins.
            </p>
            <Button className="w-full" onClick={handleClose}>Uždaryti</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                {date} · {startTime} – {endTime} · Laikas užimtas
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Jei kas nors atšauks šį laiką, gausite el. laišką.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="wl-name">Vardas (neprivaloma)</Label>
              <Input
                id="wl-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jūsų vardas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-email">El. paštas *</Label>
              <Input
                id="wl-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jusu@elpastas.lt"
              />
            </div>
            <Button type="submit" className="w-full button-primary" disabled={submitting || !email.trim()}>
              {submitting ? "Registruojama..." : "Pridėti į eilę"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
