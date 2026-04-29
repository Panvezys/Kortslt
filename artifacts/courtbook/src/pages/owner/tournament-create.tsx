import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/lib/useRole";
import { Loader2, Trophy, Building2, AlertCircle, CheckCircle2 } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

const SPORTS: Array<{ value: string; label: string }> = [
  { value: "tennis", label: "Tenisas" },
  { value: "basketball", label: "Krepšinis" },
  { value: "padel", label: "Padelis" },
  { value: "football", label: "Futbolas" },
  { value: "badminton", label: "Badmintonas" },
  { value: "squash", label: "Skvošas" },
  { value: "table_tennis", label: "Stalo tenisas" },
  { value: "golf", label: "Golfas" },
  { value: "snooker", label: "Snukeris" },
  { value: "bowling", label: "Boulingas" },
];

interface OwnerCourt {
  id: number;
  name: string;
  type: string;
}
interface OwnerFacility {
  id: number;
  name: string;
  city: string | null;
  verificationStatus: string;
  courts: OwnerCourt[];
}

interface PublicFacility {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
}
interface PublicCourt {
  id: number;
  name: string;
  type: string;
  facilityId: number | null;
}

export default function TournamentCreatePage() {
  const { getToken } = useAuth();
  const { isOwner } = useRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  // Owner = pick from own facilities (auto-approved). Coach (or no facilities) = pick from any verified facility (needs approval).
  const ownerFacilitiesQ = useQuery<OwnerFacility[]>({
    queryKey: ["owner-facilities-for-tournament"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/facilities`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Nepavyko gauti aikštynų");
      return r.json();
    },
    enabled: isOwner,
  });

  const useFallbackFacilities = !isOwner || (ownerFacilitiesQ.data && ownerFacilitiesQ.data.length === 0);

  const publicFacilitiesQ = useQuery<PublicFacility[]>({
    queryKey: ["public-facilities-for-tournament"],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/facilities/public`);
      if (!r.ok) throw new Error("Nepavyko gauti aikštynų");
      return r.json();
    },
    enabled: !!useFallbackFacilities,
  });

  const [facilityId, setFacilityId] = useState<number | null>(null);

  const facilityCourtsQ = useQuery<PublicCourt[]>({
    queryKey: ["facility-courts", facilityId],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/courts`);
      if (!r.ok) throw new Error("Nepavyko gauti aikštelių");
      const all: PublicCourt[] = await r.json();
      return all.filter(c => c.facilityId === facilityId);
    },
    enabled: !!facilityId && useFallbackFacilities,
  });

  const facilities = useFallbackFacilities
    ? (publicFacilitiesQ.data ?? []).map(f => ({ id: f.id, name: f.name, city: f.city, verified: true, courts: [] as OwnerCourt[] }))
    : (ownerFacilitiesQ.data ?? []).map(f => ({
        id: f.id, name: f.name, city: f.city,
        verified: f.verificationStatus === "verified",
        courts: f.courts,
      }));

  const selectedFacility = facilities.find(f => f.id === facilityId);
  const availableCourts: OwnerCourt[] = useFallbackFacilities
    ? (facilityCourtsQ.data ?? []).map(c => ({ id: c.id, name: c.name, type: c.type }))
    : (selectedFacility?.courts ?? []);

  const [name, setName] = useState("");
  const [sport, setSport] = useState<string>("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<string>("8");
  const [entryFee, setEntryFee] = useState<string>("");
  const [prizeInfo, setPrizeInfo] = useState("");
  const [courtIds, setCourtIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<string>("single_elimination");

  // Filter courts to those matching the chosen sport (if any)
  const filteredCourts = useMemo(() => {
    if (!sport) return availableCourts;
    return availableCourts.filter(c => c.type === sport);
  }, [availableCourts, sport]);

  const toggleCourt = (id: number) => {
    setCourtIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isAutoApproved = !!isOwner && !useFallbackFacilities;

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_URL}/tournaments/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          facilityId,
          courtIds,
          name: name.trim(),
          description: description.trim() || undefined,
          sport,
          startDate,
          endDate,
          registrationDeadline: registrationDeadline || undefined,
          maxParticipants: Number(maxParticipants),
          entryFee: entryFee ? Number(entryFee) : undefined,
          prizeInfo: prizeInfo.trim() || undefined,
          format,
          message: message.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko sukurti turnyro");
      }
      return r.json() as Promise<{ id: number; approvalStatus: string }>;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["owner-tournament-requests"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      if (created.approvalStatus === "approved") {
        toast({ title: "Turnyras sukurtas", description: "Registracija atidaryta — pasidalinkite nuoroda." });
      } else {
        toast({
          title: "Užklausa išsiųsta",
          description: "Aikštyno savininkas peržiūrės jūsų prašymą.",
        });
      }
      // Always land on the tournament page itself — organizers can view their own
      // pending tournaments (the API permits it), so this works for both owners and coaches.
      setLocation(`/tournaments/${created.id}`);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) { toast({ title: "Pasirinkite aikštyną", variant: "destructive" }); return; }
    if (courtIds.length === 0) { toast({ title: "Pažymėkite bent vieną aikštelę", variant: "destructive" }); return; }
    if (!name.trim()) { toast({ title: "Įveskite turnyro pavadinimą", variant: "destructive" }); return; }
    if (!sport) { toast({ title: "Pasirinkite sporto šaką", variant: "destructive" }); return; }
    if (!startDate || !endDate) { toast({ title: "Nurodykite datas", variant: "destructive" }); return; }
    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: "Pabaigos data turi būti vėlesnė už pradžios", variant: "destructive" }); return;
    }
    if (registrationDeadline && new Date(registrationDeadline) > new Date(startDate)) {
      toast({ title: "Registracijos terminas turi būti iki turnyro pradžios", variant: "destructive" }); return;
    }
    const max = Number(maxParticipants);
    if (!Number.isFinite(max) || max < 2 || max > 64) {
      toast({ title: "Dalyvių skaičius turi būti 2–64", variant: "destructive" }); return;
    }
    createMutation.mutate();
  };

  const facilitiesLoading = isOwner ? ownerFacilitiesQ.isLoading : publicFacilitiesQ.isLoading;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        <BackButton to="/owner/tournaments" label="Atgal į turnyrus" />

        <div className="mt-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Naujas turnyras</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isAutoApproved
              ? "Jūs esate aikštyno savininkas — turnyras bus patvirtintas iš karto, o pasirinktos aikštelės užblokuotos."
              : "Jūsų užklausa bus išsiųsta aikštyno savininkui. Patvirtinus, registracija atsidarys automatiškai."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Facility */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">1. Aikštynas ir aikštelės</h2>
            </div>

            {facilitiesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : facilities.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Nėra prieinamų aikštynų. {isOwner
                    ? <>Pirma sukurkite aikštyną <a href={`${BASE_URL}/owner`} className="underline">savo valdyme</a>.</>
                    : "Kreipkitės į administratorių."}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="facility">Aikštynas</Label>
                  <Select value={facilityId ? String(facilityId) : ""} onValueChange={v => { setFacilityId(Number(v)); setCourtIds([]); }}>
                    <SelectTrigger id="facility" className="mt-1.5">
                      <SelectValue placeholder="Pasirinkite aikštyną" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}{f.city ? ` — ${f.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {facilityId && (
                  <div>
                    <Label className="block mb-1.5">Aikštelės {sport && <span className="text-muted-foreground font-normal">(filtruota pagal {SPORTS.find(s => s.value === sport)?.label})</span>}</Label>
                    {facilityCourtsQ.isLoading && useFallbackFacilities ? (
                      <Skeleton className="h-10 w-full" />
                    ) : filteredCourts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {sport ? "Šis aikštynas neturi aikštelių pasirinktai sporto šakai." : "Šis aikštynas neturi aikštelių."}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredCourts.map(c => {
                          const checked = courtIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleCourt(c.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                                checked
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-background hover:border-primary/40"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                              }`}>
                                {checked && <CheckCircle2 className="w-3 h-3" />}
                              </span>
                              <span className="truncate">{c.name}</span>
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">{c.type}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Basics */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">2. Pagrindinė informacija</h2>

            <div>
              <Label htmlFor="name">Turnyro pavadinimas</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="pvz. Vilnius Open 2026" className="mt-1.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sport">Sporto šaka</Label>
                <Select value={sport} onValueChange={v => { setSport(v); setCourtIds([]); }}>
                  <SelectTrigger id="sport" className="mt-1.5">
                    <SelectValue placeholder="Pasirinkite" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxParticipants">Maksimalus dalyvių skaičius</Label>
                <Select value={maxParticipants} onValueChange={setMaxParticipants}>
                  <SelectTrigger id="maxParticipants" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 12, 16, 24, 32, 48, 64].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="format">Formatas</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Viengubas pašalinimas (klasikinis tinklelis)</SelectItem>
                  <SelectItem value="round_robin">Grupės — kiekvienas su kiekvienu (4 dalyvių grupėse)</SelectItem>
                  <SelectItem value="hybrid">Mišrus — grupės + atkrintamosios (top 2 iš grupės)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                {format === "single_elimination" && "Klasikinis bracket. Pralaimėjęs iškrenta. Greičiausias formatas."}
                {format === "round_robin" && "Visi grupėje žaidžia tarpusavyje. Garantuoja kelis mačus kiekvienam dalyviui."}
                {format === "hybrid" && "Grupių etapas + tiesioginės atkrintamosios. Geriausia patirtis didesniems turnyrams."}
              </p>
            </div>

            <div>
              <Label htmlFor="description">Aprašymas (neprivaloma)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Trumpas turnyro aprašymas, taisyklės, kontaktai..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </section>

          {/* Dates */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">3. Datos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Pradžia</Label>
                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="endDate">Pabaiga</Label>
                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="regDeadline">Registracijos terminas (neprivaloma)</Label>
                <Input id="regDeadline" type="date" value={registrationDeadline} onChange={e => setRegistrationDeadline(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </section>

          {/* Fee + prize */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">4. Mokestis ir prizai (neprivaloma)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="entryFee">Dalyvio mokestis (€)</Label>
                <Input id="entryFee" type="number" min="0" step="0.01" value={entryFee} onChange={e => setEntryFee(e.target.value)} placeholder="0 = nemokama" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="prizeInfo">Prizinis fondas / apdovanojimai</Label>
                <Input id="prizeInfo" value={prizeInfo} onChange={e => setPrizeInfo(e.target.value)} placeholder="pvz. €500 prizinis fondas" className="mt-1.5" />
              </div>
            </div>
          </section>

          {/* Optional message to facility owner */}
          {!isAutoApproved && (
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold">5. Žinutė aikštyno savininkui (neprivaloma)</h2>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Papildoma informacija savininkui..."
                className="min-h-[70px]"
              />
            </section>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setLocation("/owner/tournaments")} disabled={createMutation.isPending}>
              Atšaukti
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAutoApproved ? "Sukurti turnyrą" : "Siųsti užklausą"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
