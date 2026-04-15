import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Phone, Mail, Euro, Clock, User, Edit2, X, Check, Video } from "lucide-react";
import { SportIcon, sportColor } from "@/components/sport-icon";
import { Link } from "wouter";

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
      const url = isOwnProfileRoute ? `${API}/coaches/me` : `${API}/coaches/${coach!.id}`;
      const r = await fetch(url, {
        method: "PUT",
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
      qc.invalidateQueries({ queryKey: ["coaches"] });
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
          <Link href="/coaches">
            <Button variant="outline" className="mt-4">Grįžti į sąrašą</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const displayCoach = editing ? null : coach;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl space-y-6">

        {/* Back link */}
        <Link href="/coaches">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            ← Visi treneriai
          </Button>
        </Link>

        {/* Header card */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {displayCoach?.photoUrl ? (
                <img
                  src={displayCoach.photoUrl}
                  alt={displayCoach.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                  {displayCoach.sports.map(s => {
                    const color = sportColor[s] ?? "#84cc16";
                    return (
                      <span
                        key={s}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: color + "22", color }}
                      >
                        <SportIcon sport={s} size={11} strokeWidth={2} />
                        {SPORT_LABELS[s] ?? s}
                      </span>
                    );
                  })}
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
                <p className="text-sm text-muted-foreground leading-relaxed">{displayCoach.bio}</p>
              )}

              {displayCoach.videoUrl && (
                <a
                  href={displayCoach.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Video className="w-4 h-4" />
                  Peržiūrėti video
                </a>
              )}
            </div>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{coach ? "Redaguoti profilį" : "Sukurti trenerio profilį"}</h2>
              {coach && (
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); }}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vardas *</label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vardas Pavardė" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">El. paštas *</label>
                <Input value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vardas@example.com" type="email" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefonas</label>
                <Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+370 600 00000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kaina (€/val)</label>
                <Input
                  value={form.pricePerHour ?? ""}
                  onChange={e => setForm(f => ({ ...f, pricePerHour: e.target.value }))}
                  placeholder="30"
                  type="number" min="0"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nuotraukos URL</label>
                <Input value={form.photoUrl ?? ""} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL</label>
                <Input value={form.videoUrl ?? ""} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aprašymas</label>
                <Textarea
                  value={form.bio ?? ""}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Papasakokite apie save, patirtį, treniravimo stilių..."
                  rows={4}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Darbo laikas</label>
                <Input
                  value={form.availabilityDescription ?? ""}
                  onChange={e => setForm(f => ({ ...f, availabilityDescription: e.target.value }))}
                  placeholder="Pn–Pt 09:00–21:00, Š 10:00–18:00"
                />
              </div>
            </div>

            {/* Sport selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šakos</label>
              <div className="flex flex-wrap gap-2">
                {SPORT_OPTIONS.map(sport => {
                  const active = (form.sports ?? []).includes(sport);
                  const color = sportColor[sport] ?? "#84cc16";
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => toggleSport(sport)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all"
                      style={active
                        ? { background: color, borderColor: color, color: "#000" }
                        : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                      }
                    >
                      <SportIcon sport={sport} size={11} strokeWidth={2} />
                      {SPORT_LABELS[sport]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.name || !form.email}
                className="flex-1"
              >
                {saveMutation.isPending ? "Saugoma..." : (
                  <><Check className="w-4 h-4 mr-1.5" /> Išsaugoti</>
                )}
              </Button>
              {coach && (
                <Button variant="outline" onClick={() => setEditing(false)}>
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
