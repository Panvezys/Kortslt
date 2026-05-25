import { useState, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, X, ExternalLink, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SportPill } from "@/components/sport-icon";
import { useToast } from "@/hooks/use-toast";
import { validateEmail, validatePhone } from "@/lib/validators";
import { useViewAsCoach, withCoachViewAs } from "@/lib/view-as-coach";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;
const PUBLIC_PROFILE_HREF = `${BASE}/coach/me`;

const SPORT_OPTIONS = [
  "tennis", "basketball", "padel", "football", "badminton",
  "squash", "table_tennis", "golf", "snooker", "bowling",
];

const MAX_QUALIFICATIONS = 20;
const MAX_QUALIFICATION_LENGTH = 200;

// Storefront profile fields — everything a player sees on the public coach
// card. Operational policies, Stripe, working hours, and blocks live in the
// other Settings tabs; per-service prices live in /coach/services.
interface ProfileResponse {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  phone?: string | null;
  sports?: string[];
  experienceYears?: number | null;
  qualifications?: string[];
  // No longer edited from the UI (working hours are structured now) but
  // legacy values are still rendered on public profile pages, so the save
  // mutation passes the existing value through to avoid wiping it.
  availabilityDescription?: string | null;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  videoUrl: string;
  bio: string;
  sports: string[];
  experienceYears: string;
  qualifications: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  photoUrl: "",
  videoUrl: "",
  bio: "",
  sports: [],
  experienceYears: "",
  qualifications: [],
};

export function CoachProfileForm() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { asCoachId } = useViewAsCoach();
  const isViewingAs = asCoachId != null;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: profile, isLoading } = useQuery<ProfileResponse | null>({
    queryKey: ["coach-me-profile", asCoachId],
    queryFn: async () => {
      const r = await fetch(withCoachViewAs(`${API}/coaches/me`), { credentials: "include" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to fetch coach profile");
      return r.json();
    },
    staleTime: 60_000,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        photoUrl: profile.photoUrl ?? "",
        videoUrl: profile.videoUrl ?? "",
        bio: profile.bio ?? "",
        sports: profile.sports ?? [],
        experienceYears: profile.experienceYears != null ? String(profile.experienceYears) : "",
        qualifications: profile.qualifications ?? [],
      });
    } else if (!isLoading && user && !isViewingAs) {
      setForm((f) => ({
        ...f,
        name: f.name || user.fullName || "",
        email: f.email || user.primaryEmailAddress?.emailAddress || "",
      }));
    }
  }, [profile, isLoading, user, isViewingAs]);

  function toggleSport(sport: string) {
    setForm((f) => ({
      ...f,
      sports: f.sports.includes(sport)
        ? f.sports.filter((s) => s !== sport)
        : [...f.sports, sport],
    }));
  }

  async function uploadPhoto(file: File) {
    if (isViewingAs) return;
    setPhotoUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${API}/coaches/me/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      const { photoUrl } = await res.json() as { photoUrl: string };
      setForm((f) => ({ ...f, photoUrl }));
      qc.invalidateQueries({ queryKey: ["coach-me-profile"] });
      qc.invalidateQueries({ queryKey: ["coach"] });
      toast({ title: "Nuotrauka įkelta" });
    } catch (e: unknown) {
      toast({ title: "Klaida", description: e instanceof Error ? e.message : "Bandykite dar kartą.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  function handlePhotoDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadPhoto(file);
  }

  const save = useMutation({
    mutationFn: async () => {
      const emailErr = validateEmail(form.email);
      if (emailErr) throw new Error(emailErr);
      const phoneErr = validatePhone(form.phone, { required: false });
      if (phoneErr) throw new Error(phoneErr);

      const r = await fetch(`${API}/coaches/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          photoUrl: form.photoUrl || null,
          videoUrl: form.videoUrl || null,
          bio: form.bio || null,
          sports: form.sports,
          availabilityDescription: profile?.availabilityDescription ?? null,
          experienceYears:
            form.experienceYears && Number.isFinite(Number(form.experienceYears))
              ? Math.max(0, Math.round(Number(form.experienceYears)))
              : null,
          qualifications: form.qualifications
            .map((q) => q.trim())
            .filter((q) => q.length > 0)
            .slice(0, MAX_QUALIFICATIONS),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Nepavyko išsaugoti");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Profilis išsaugotas" });
      qc.invalidateQueries({ queryKey: ["coach-me-profile"] });
      qc.invalidateQueries({ queryKey: ["coach"] });
      qc.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: (e: Error) => {
      toast({ title: "Klaida", description: e.message, variant: "destructive" });
    },
  });

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Vieša informacija</h2>
          <p className="text-xs text-muted-foreground">
            Tai matys mokiniai jūsų profilyje ir paieškos rezultatuose.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href={PUBLIC_PROFILE_HREF} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Žiūrėti viešą profilį
          </a>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vardas *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Vardas Pavardė"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">El. paštas *</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="vardas@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefonas</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+370 600 00000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patirtis (metais)</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.experienceYears}
                onChange={(e) => setForm((f) => ({ ...f, experienceYears: e.target.value }))}
                placeholder="5"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profilio nuotrauka</label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="w-20 h-20 rounded-full border-2 border-border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Profilio nuotrauka" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-muted-foreground/50" />
                  )}
                </div>
                {/* Drop zone */}
                <div
                  className={`flex-1 relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/60 hover:bg-muted/40"
                  } ${photoUploading ? "pointer-events-none opacity-60" : ""}`}
                  onClick={() => !isViewingAs && photoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handlePhotoDrop}
                >
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={isViewingAs || photoUploading}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-5 px-4 text-center select-none">
                    {photoUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground">Įkeliama...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">
                          Tempkite nuotrauką arba <span className="text-primary underline">pasirinkite failą</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground">JPG, PNG, WebP · maks. 10 MB</span>
                      </>
                    )}
                  </div>
                </div>
                {form.photoUrl && !isViewingAs && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, photoUrl: "" }))}
                    className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Pašalinti nuotrauką"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL</label>
              <Input
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apie mane</label>
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Papasakokite apie save, patirtį, treniravimo stilių..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sporto šakos</label>
            <div className="flex flex-wrap gap-2">
              {SPORT_OPTIONS.map((sport) => {
                const active = form.sports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className="rounded-full transition-all"
                  >
                    <SportPill sport={sport} variant={active ? "solid" : "subtle"} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kvalifikacijos</label>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Sertifikatai, licencijos, diplomai. Vienas įrašas — viena eilutė.
            </p>
            <div className="space-y-2">
              {form.qualifications.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={q}
                    maxLength={MAX_QUALIFICATION_LENGTH}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.qualifications];
                        next[idx] = e.target.value;
                        return { ...f, qualifications: next };
                      })
                    }
                    placeholder="pvz. Lietuvos padelio federacijos treneris"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        qualifications: f.qualifications.filter((_, i) => i !== idx),
                      }))
                    }
                    aria-label="Pašalinti kvalifikaciją"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={form.qualifications.length >= MAX_QUALIFICATIONS}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  qualifications: [...f.qualifications, ""],
                }))
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Pridėti kvalifikaciją
            </Button>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name || !form.email || isViewingAs}
              title={isViewingAs ? "Žiūrite kaip kitas treneris — keisti negalima" : undefined}
            >
              {save.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saugoma...</>
              ) : (
                <><Check className="w-4 h-4 mr-1.5" /> Išsaugoti</>
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
