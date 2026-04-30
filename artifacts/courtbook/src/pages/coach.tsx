import { useState, useEffect, useMemo } from "react";
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
import { Phone, Mail, Euro, Clock, User, Edit2, X, Check, Video, MapPin, Building2, Send, CalendarDays, Search } from "lucide-react";
import { SportIcon, SPORT_LABELS, SportPill, getSportColor } from "@/components/sport-icon";
import { Link } from "wouter";
import { BackButton } from "@/components/back-button";
import { validateEmail, validatePhone } from "@/lib/validators";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_OPTIONS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"];
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

interface CoachFacilityGroup {
  facilityId: number | null;
  facilityName: string | null;
  city: string | null;
  address: string | null;
  courts: Array<{ id: number; name: string }>;
}

interface CoachApplication {
  invitationId: number;
  courtId: number;
  courtName: string;
  facilityId: number | null;
  facilityName: string | null;
  status: string;
  initiatedBy: string;
  message: string | null;
  createdAt: string;
}

interface FacilityOption {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
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
  const coachId = coach?.id;

  // Public facilities the coach is approved at — visible on every profile view
  const facilitiesQ = useQuery<CoachFacilityGroup[]>({
    queryKey: ["coach-facilities", coachId],
    queryFn: () => fetch(`${API}/coaches/${coachId}/facilities`).then(r => r.json()),
    enabled: !!coachId,
  });

  // Owner-only data: pending applications + facility picker
  const applicationsQ = useQuery<CoachApplication[]>({
    queryKey: ["coach", "me", "applications"],
    queryFn: () => fetch(`${API}/coaches/me/applications`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    enabled: !!isOwn && !!coachId,
  });

  const allFacilitiesQ = useQuery<FacilityOption[]>({
    queryKey: ["facilities", "public"],
    queryFn: () => fetch(`${API}/facilities/public`).then(r => r.ok ? r.json() : []),
    enabled: !!isOwn && !!coachId,
  });

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyFacilityId, setApplyFacilityId] = useState<number | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!applyFacilityId) throw new Error("Pasirinkite vietą");
      const r = await fetch(`${API}/coaches/apply-to-facility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ facilityId: applyFacilityId, message: applyMessage || undefined }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko pateikti paraiškos");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach", "me", "applications"] });
      qc.invalidateQueries({ queryKey: ["coach-facilities"] });
      toast({ title: "Paraiška pateikta" });
      setApplyOpen(false);
      setApplyFacilityId(null);
      setApplyMessage("");
      setFacilityFilter("");
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  // Facility ids the coach already has a relationship with (pending or approved) — hide from picker
  const usedFacilityIds = useMemo(() => {
    const set = new Set<number>();
    (facilitiesQ.data ?? []).forEach(f => { if (f.facilityId) set.add(f.facilityId); });
    (applicationsQ.data ?? []).forEach(a => { if (a.status === "pending" && a.facilityId) set.add(a.facilityId); });
    return set;
  }, [facilitiesQ.data, applicationsQ.data]);

  const pendingApplications = (applicationsQ.data ?? []).filter(a => a.status === "pending");
  // Group pending by facility (one row per facility, not per court)
  const pendingByFacility = useMemo(() => {
    const map = new Map<string, CoachApplication & { courtNames: string[] }>();
    for (const a of pendingApplications) {
      const key = a.facilityId != null ? `f${a.facilityId}` : `c${a.courtId}`;
      if (!map.has(key)) {
        map.set(key, { ...a, courtNames: [a.courtName] });
      } else {
        map.get(key)!.courtNames.push(a.courtName);
      }
    }
    return Array.from(map.values());
  }, [pendingApplications]);

  const filteredFacilityOptions = (allFacilitiesQ.data ?? []).filter(f => {
    if (usedFacilityIds.has(f.id)) return false;
    if (!facilityFilter.trim()) return true;
    const q = facilityFilter.toLowerCase();
    return f.name.toLowerCase().includes(q) || (f.city ?? "").toLowerCase().includes(q);
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Omit<Coach, 'pricePerHour'> & { pricePerHour?: string }>>({});

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
      const emailErr = validateEmail(data.email);
      if (emailErr) throw new Error(emailErr);
      const phoneErr = validatePhone(data.phone, { required: false });
      if (phoneErr) throw new Error(phoneErr);
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
        <BackButton to="/coaches" label="Visi treneriai" />

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
                  {displayCoach.sports.map(s => (
                    <SportPill key={s} sport={s} variant="subtle" />
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

              {/* Book Lesson — public visitors only (placeholder) */}
              {!isOwn && (
                <div className="pt-2">
                  <Button
                    onClick={() => toast({ title: "Greitai", description: "Pamokų užsakymas bus prieinamas netrukus." })}
                    className="w-full sm:w-auto"
                  >
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Užsakyti pamoką
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Public facilities list — where this coach teaches */}
        {!editing && coach && (facilitiesQ.data?.length ?? 0) > 0 && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {isOwn ? "Mano vietos" : "Treniruoja čia"}
            </h2>
            <div className="space-y-2">
              {facilitiesQ.data!.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{f.facilityName}</div>
                    {(f.city || f.address) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {[f.city, f.address].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {f.courts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {f.courts.map(c => (
                          <Link key={c.id} href={`/court/${c.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 text-[11px]">
                              {c.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mano vietos — pending applications + apply form (own profile only) */}
        {isOwn && !editing && coach && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Paraiškos vietoms
              </h2>
              {!applyOpen && (
                <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>
                  <Send className="w-4 h-4 mr-1.5" />
                  Pateikti paraišką
                </Button>
              )}
            </div>

            {/* Pending applications list */}
            {pendingByFacility.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Laukiama atsakymo</p>
                {pendingByFacility.map(p => (
                  <div key={p.invitationId} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-start gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{p.facilityName ?? p.courtNames[0]}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.courtNames.length} aikštelė(-ės) · pateikta {new Date(p.createdAt).toLocaleDateString("lt-LT")}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-700 border-amber-500/40 shrink-0">Laukia</Badge>
                  </div>
                ))}
              </div>
            )}

            {pendingByFacility.length === 0 && !applyOpen && (facilitiesQ.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Dar nesate pateikę nė vienos paraiškos. Pateikite paraišką vietai, kurioje norėtumėte treniruoti.
              </p>
            )}

            {/* Apply form */}
            {applyOpen && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nauja paraiška</p>
                  <Button size="sm" variant="ghost" onClick={() => { setApplyOpen(false); setApplyFacilityId(null); setFacilityFilter(""); setApplyMessage(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ieškoti vietos pagal pavadinimą ar miestą..."
                    value={facilityFilter}
                    onChange={e => { setFacilityFilter(e.target.value); setApplyFacilityId(null); }}
                    className="pl-9"
                  />
                </div>

                {allFacilitiesQ.isLoading ? (
                  <Skeleton className="h-32 w-full rounded-lg" />
                ) : filteredFacilityOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {facilityFilter ? "Nieko nerasta." : "Visos vietos jau įtrauktos."}
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
                    {filteredFacilityOptions.slice(0, 30).map(f => {
                      const selected = applyFacilityId === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setApplyFacilityId(f.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-start gap-2 ${
                            selected ? "bg-primary/10" : "hover:bg-muted/50"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{f.name}</div>
                            {f.city && <div className="text-xs text-muted-foreground truncate">{f.city}</div>}
                          </div>
                          {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Textarea
                  placeholder="Žinutė savininkui (neprivaloma)"
                  value={applyMessage}
                  onChange={e => setApplyMessage(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={() => applyMut.mutate()}
                  disabled={!applyFacilityId || applyMut.isPending}
                  className="w-full"
                >
                  {applyMut.isPending ? "Siunčiama..." : (
                    <><Send className="w-4 h-4 mr-1.5" /> Pateikti paraišką</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

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
                  const color = getSportColor(sport);
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
