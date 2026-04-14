import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  Phone, Mail, Euro, Clock, Video, User, Edit2, Check, X, Trophy,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_OPTIONS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];
const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

interface Coach {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string;
  photoUrl?: string;
  videoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  availabilityDescription?: string;
  phone?: string;
}

async function fetchCoach(id: string): Promise<Coach> {
  const r = await fetch(`${API}/coaches/${id}`);
  if (!r.ok) throw new Error("Coach not found");
  return r.json();
}

async function fetchMyCoach(): Promise<Coach | null> {
  const r = await fetch(`${API}/coaches/me`, { credentials: "include" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Failed to fetch coach profile");
  return r.json();
}

export default function CoachPage() {
  const { id } = useParams<{ id?: string }>();
  const { user, isSignedIn } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isOwnProfileRoute = !id || id === "me";

  const { data: coach, isLoading } = useQuery<Coach | null>({
    queryKey: isOwnProfileRoute ? ["coach", "me"] : ["coach", id],
    queryFn: isOwnProfileRoute ? fetchMyCoach : () => fetchCoach(id!),
    enabled: isOwnProfileRoute ? !!isSignedIn : true,
    retry: false,
  });

  const isOwn = isOwnProfileRoute || (coach?.userId && user?.id === coach.userId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Coach & { pricePerHour?: string }>>({});

  useEffect(() => {
    if (coach) {
      setForm({
        name: coach.name,
        email: coach.email,
        bio: coach.bio ?? "",
        photoUrl: coach.photoUrl ?? "",
        videoUrl: coach.videoUrl ?? "",
        pricePerHour: coach.pricePerHour != null ? String(coach.pricePerHour) : "",
        sports: coach.sports ?? [],
        availabilityDescription: coach.availabilityDescription ?? "",
        phone: coach.phone ?? "",
      });
    } else if (isOwnProfileRoute && user && !coach) {
      setForm({
        name: user.fullName ?? "",
        email: user.primaryEmailAddress?.emailAddress ?? "",
        sports: [],
      });
      setEditing(true);
    }
  }, [coach, isOwnProfileRoute, user]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const method = isOwnProfileRoute ? "PUT" : "PUT";
      const url = isOwnProfileRoute ? `${API}/coaches/me` : `${API}/coaches/${coach!.id}`;
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          pricePerHour: data.pricePerHour ? parseFloat(data.pricePerHour as string) : undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach"] });
      toast({ title: "Profilis išsaugotas" });
      setEditing(false);
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  const toggleSport = (sport: string) => {
    setForm(f => ({
      ...f,
      sports: (f.sports ?? []).includes(sport)
        ? (f.sports ?? []).filter(s => s !== sport)
        : [...(f.sports ?? []), sport],
    }));
  };

  if (isOwnProfileRoute && !isSignedIn) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          Prisijunkite, kad matytumėte trenerio profilį.
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-2xl space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!coach && !isOwnProfileRoute) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">Treneris nerastas</h1>
        </div>
      </Layout>
    );
  }

  const displayCoach = editing ? null : coach;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl space-y-6">

        {/* Header card */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {displayCoach?.photoUrl ? (
                <img
                  src={displayCoach.photoUrl}
                  alt={displayCoach.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary/60" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{displayCoach?.name ?? (isOwnProfileRoute ? "Trenerio profilis" : "")}</h1>
                {displayCoach?.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    {displayCoach.email}
                  </p>
                )}
                {displayCoach?.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {displayCoach.phone}
                  </p>
                )}
              </div>
            </div>
            {isOwn && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4 mr-1.5" />
                Redaguoti
              </Button>
            )}
          </div>

          {displayCoach && (
            <div className="mt-5 space-y-4">
              {displayCoach.sports.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {displayCoach.sports.map(s => (
                    <Badge key={s} variant="secondary" className="flex items-center gap-1.5">
                      <Trophy className="w-3 h-3" />
                      {SPORT_LABELS[s] ?? s}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                {displayCoach.pricePerHour != null && (
                  <div className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Euro className="w-4 h-4 text-primary" />
                    {displayCoach.pricePerHour}€ / val
                  </div>
                )}
                {displayCoach.availabilityDescription && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {displayCoach.availabilityDescription}
                  </div>
                )}
              </div>

              {displayCoach.bio && (
                <p className="text-muted-foreground leading-relaxed">{displayCoach.bio}</p>
              )}
            </div>
          )}

          {!displayCoach && isOwnProfileRoute && !editing && (
            <div className="mt-6 text-center py-8 border border-dashed rounded-xl">
              <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">Dar neturite trenerio profilio</p>
              <Button className="mt-4" onClick={() => setEditing(true)}>Sukurti profilį</Button>
            </div>
          )}
        </div>

        {/* Video */}
        {!editing && displayCoach?.videoUrl && (
          <div className="bg-card border rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Vaizdo įrašas
            </h2>
            <div className="rounded-xl overflow-hidden aspect-video">
              <iframe
                src={displayCoach.videoUrl.replace("watch?v=", "embed/")}
                className="w-full h-full"
                allowFullScreen
                title="Coach video"
              />
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold">{coach ? "Redaguoti profilį" : "Sukurti trenerio profilį"}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vardas *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vardas Pavardė" />
              </div>
              <div className="space-y-2">
                <Label>El. paštas *</Label>
                <Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vardas@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefonas</Label>
                <Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+370 600 00000" />
              </div>
              <div className="space-y-2">
                <Label>Kaina (€ / val)</Label>
                <Input type="number" min={0} step={0.5} value={form.pricePerHour ?? ""} onChange={e => setForm(f => ({ ...f, pricePerHour: e.target.value }))} placeholder="25" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Apie mane</Label>
              <Textarea rows={3} value={form.bio ?? ""} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Trumpas aprašymas, patirtis, pasiekimai..." />
            </div>

            <div className="space-y-2">
              <Label>Darbo laikas / Prieinamumas</Label>
              <Input value={form.availabilityDescription ?? ""} onChange={e => setForm(f => ({ ...f, availabilityDescription: e.target.value }))} placeholder="Pir–Pen 9–19" />
            </div>

            <div className="space-y-2">
              <Label>Nuotraukos URL</Label>
              <Input value={form.photoUrl ?? ""} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>YouTube vaizdo įrašo URL</Label>
              <Input value={form.videoUrl ?? ""} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
            </div>

            <div className="space-y-2">
              <Label>Sporto šakos</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SPORT_OPTIONS.map(sport => {
                  const selected = (form.sports ?? []).includes(sport);
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => toggleSport(sport)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 border-border hover:border-primary"
                      }`}
                    >
                      {SPORT_LABELS[sport]}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.name || !form.email}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                {saveMutation.isPending ? "Saugoma..." : "Išsaugoti"}
              </Button>
              {coach && (
                <Button variant="outline" onClick={() => setEditing(false)} className="gap-2">
                  <X className="w-4 h-4" />
                  Atšaukti
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
