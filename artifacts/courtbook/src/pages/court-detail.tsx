import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { resolveCourtImage } from "@/lib/imageUrl";
import { useGetCourt, useGetCourtAvailability, useCreateBooking, useListBookings, useListCourtReviews } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Users, CheckCircle2, AlertCircle, Star, Clock, Euro, Phone, Navigation, ExternalLink, LogIn, Lightbulb, ShowerHead, DoorOpen, Droplets, ShoppingBag, Zap, CalendarDays, Trophy, Mail, Heart, Share2, MessageSquare, Send, ChevronLeft, ChevronRight, Images, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getGetCourtQueryKey, getGetCourtAvailabilityQueryKey } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { format as formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useFavoritesContext } from "@/lib/FavoritesContext";
import { Textarea } from "@/components/ui/textarea";

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvoše",
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;


function StarDisplay({ rating, size = "md" }: { rating?: number | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };
  const cls = sizes[size];
  if (!rating) return null;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className={`${cls} fill-yellow-400 text-yellow-400`} />
      ))}
      {hasHalf && <Star key="half" className={`${cls} fill-yellow-200 text-yellow-400`} />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className={`${cls} text-muted-foreground/30`} />
      ))}
    </div>
  );
}

interface Coach {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio?: string;
  photoUrl?: string;
  pricePerHour?: number;
  sports: string[];
  availabilityDescription?: string;
  phone?: string;
}

function CoachesSectionForCourt({ courtId }: { courtId: number }) {
  const { data: coaches, isLoading } = useQuery<Coach[]>({
    queryKey: ["court-coaches", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/coaches`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!courtId && !isNaN(courtId),
  });

  if (isLoading) return null;
  if (!coaches || coaches.length === 0) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary" />
        Treneriai
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {coaches.map(coach => (
          <a
            key={coach.id}
            href={`/coach/${coach.id}`}
            className="flex gap-4 p-4 bg-card border rounded-2xl hover:border-primary/50 hover:shadow-md transition-all group"
          >
            {coach.photoUrl ? (
              <img src={coach.photoUrl} alt={coach.name} className="w-14 h-14 rounded-full object-cover border-2 border-muted shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-primary/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold group-hover:text-primary transition-colors truncate">{coach.name}</p>
              {coach.sports.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {coach.sports.slice(0, 3).map(s => (
                    <span key={s} className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      {SPORT_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {coach.pricePerHour != null && (
                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                    <Euro className="w-3 h-3" />{coach.pricePerHour}/val
                  </span>
                )}
                {coach.availabilityDescription && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{coach.availabilityDescription}
                  </span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function CourtDetail() {
  const { id } = useParams();
  const courtId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<Array<{ id: number; senderUserId: string; senderName: string; body: string; createdAt: string }>>([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  const dateStr = format(date, "yyyy-MM-dd");

  const { data: court, isLoading: courtLoading } = useGetCourt(courtId, {
    query: {
      enabled: !!courtId && !isNaN(courtId),
      queryKey: getGetCourtQueryKey(courtId),
    }
  });

  const { data: availability, isLoading: availabilityLoading } = useGetCourtAvailability(
    courtId,
    { date: dateStr },
    {
      query: {
        enabled: !!courtId && !isNaN(courtId),
        queryKey: getGetCourtAvailabilityQueryKey(courtId, { date: dateStr }),
      }
    }
  );

  const { user, isSignedIn, isLoaded: clerkLoaded } = useUser();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { data: reviews } = useListCourtReviews(courtId, {
    query: { enabled: !!courtId && !isNaN(courtId) }
  });
  const { data: bookings } = useListBookings(
    { courtId },
    { query: { enabled: !!courtId && !isNaN(courtId) && !!user } }
  );

  const createBooking = useCreateBooking();
  const { openSignIn, openSignUp } = useClerk();
  const [, navigate] = useLocation();

  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  interface CourtPhoto { id: number; url: string; caption: string | null; displayOrder: number; }
  const { data: extraPhotos = [] } = useQuery<CourtPhoto[]>({
    queryKey: ["court-photos", courtId],
    queryFn: async () => {
      const r = await fetch(`${API}/courts/${courtId}/photos`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!courtId && !isNaN(courtId),
  });
  const allPhotos = useMemo(() => {
    const urls: string[] = [];
    if (court?.imageUrl) urls.push(court.imageUrl);
    for (const p of extraPhotos) urls.push(p.url);
    return urls;
  }, [court?.imageUrl, extraPhotos]);
  const favorited = court ? isFavorite(court.id) : false;

  const handleShare = async () => {
    if (!court) return;
    const url = window.location.href;
    const text = `${court.name} — korts.lt`;
    try {
      if (navigator.share) {
        await navigator.share({ title: court.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Nuoroda nukopijuota" });
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({ title: "Nuoroda nukopijuota" });
      }
    }
  };

  const slots = availability?.slots ?? [];

  // Selected slot range (selectedStart..selectedEnd inclusive)
  const selectedSlotRange = useMemo(() => {
    if (selectedStart === null || !slots.length) return null;
    const end = selectedEnd ?? selectedStart;
    const rangeStart = Math.min(selectedStart, end);
    const rangeEnd = Math.max(selectedStart, end);
    const range = slots.slice(rangeStart, rangeEnd + 1);
    if (!range.length || !range.every(s => s.isAvailable)) return null;
    const totalMinutes = range.length * 30;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const durationLabel = hours > 0
      ? mins > 0 ? `${hours} val ${mins} min` : `${hours} val`
      : `${mins} min`;
    return {
      startTime: range[0].startTime,
      endTime: range[range.length - 1].endTime,
      totalPrice: range.reduce((sum, s) => sum + s.price, 0),
      slotCount: range.length,
      durationLabel,
      rangeStart,
      rangeEnd,
    };
  }, [selectedStart, selectedEnd, slots]);

  // Handle slot click: select, extend, or deselect
  const handleSlotClick = (idx: number) => {
    if (!slots[idx]?.isAvailable) return;

    if (selectedStart === null) {
      setSelectedStart(idx);
      setSelectedEnd(null);
      return;
    }

    const end = selectedEnd ?? selectedStart;
    const rangeStart = Math.min(selectedStart, end);
    const rangeEnd = Math.max(selectedStart, end);

    // Clicked within selection → deselect all
    if (idx >= rangeStart && idx <= rangeEnd) {
      setSelectedStart(null);
      setSelectedEnd(null);
      return;
    }

    // Try to extend the range; check all slots in new range are available
    const newStart = idx < rangeStart ? idx : rangeStart;
    const newEnd = idx > rangeEnd ? idx : rangeEnd;
    const allAvailable = slots.slice(newStart, newEnd + 1).every(s => s.isAvailable);
    if (allAvailable) {
      setSelectedStart(newStart);
      setSelectedEnd(newEnd);
    } else {
      // Can't extend (unavailable slot in path) → start fresh
      setSelectedStart(idx);
      setSelectedEnd(null);
    }
  };

  const handleReserve = async (overrideData?: { customerName: string; customerEmail: string; customerPhone?: string }) => {
    if (!selectedSlotRange) {
      toast({ title: "Pasirinkite laiką", variant: "destructive" });
      return;
    }

    let customerName: string;
    let customerEmail: string;
    let customerPhone: string | undefined;

    if (overrideData) {
      customerName = overrideData.customerName;
      customerEmail = overrideData.customerEmail;
      customerPhone = overrideData.customerPhone;
    } else {
      if (!isSignedIn || !user) { openSignIn(); return; }
      customerName = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
      customerEmail = user.primaryEmailAddress?.emailAddress ?? "";
    }

    if (!customerName || !customerEmail) {
      toast({ title: "Profilio duomenys neišsamūs", description: "Papildykite profilį ir bandykite dar kartą.", variant: "destructive" });
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        data: {
          courtId,
          customerName,
          customerEmail,
          customerPhone,
          date: dateStr,
          startTime: selectedSlotRange.startTime,
          endTime: selectedSlotRange.endTime,
        }
      });

      const resp = await fetch(`${API}/payments/confirm-free`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      if (!resp.ok) throw new Error("Confirm failed");

      navigate(`/booking-confirmed?id=${booking.id}`);
    } catch {
      toast({
        title: "Rezervacija nepavyko",
        description: "Bandykite dar kartą.",
        variant: "destructive",
      });
    }
  };

  const handleGuestReserve = async () => {
    const firstName = guestFirstName.trim();
    const lastName = guestLastName.trim();
    const email = guestEmail.trim();
    const phone = guestPhone.trim();

    if (!firstName || !lastName) {
      toast({ title: "Įveskite vardą ir pavardę", variant: "destructive" }); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Įveskite teisingą el. paštą", variant: "destructive" }); return;
    }
    if (!phone || phone.length < 6) {
      toast({ title: "Įveskite telefono numerį", variant: "destructive" }); return;
    }

    await handleReserve({ customerName: `${firstName} ${lastName}`, customerEmail: email, customerPhone: phone });
  };

  const isPending = createBooking.isPending;
  const displayName = user?.fullName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Vartotojas";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const avgRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const courtBookings = useMemo(() => {
    return (bookings ?? [])
      .filter((booking) => booking.courtId === courtId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.startTime.localeCompare(a.startTime));
  }, [bookings, courtId]);

  const openChat = () => {
    if (!isSignedIn) { openSignIn(); return; }
    setChatOpen(true);
    setTimeout(() => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  useEffect(() => {
    if (!chatOpen || !user || !courtId) return;
    setChatLoading(true);
    fetch(`${API}/courts/${courtId}/messages?userId=${encodeURIComponent(user.id)}`)
      .then(r => r.json())
      .then(data => { setChatMsgs(Array.isArray(data) ? data : []); setChatLoading(false); })
      .catch(() => setChatLoading(false));
  }, [chatOpen, courtId, user]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const handleChatSend = async () => {
    if (!user || !chatText.trim() || chatSending) return;
    setChatSending(true);
    try {
      const r = await fetch(`${API}/courts/${courtId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderUserId: user.id, senderName: displayName, senderEmail: displayEmail, body: chatText }),
      });
      const msg = await r.json();
      setChatMsgs(prev => [...prev, msg]);
      setChatText("");
    } finally {
      setChatSending(false);
    }
  };

  if (courtLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-[400px] w-full rounded-xl mb-8" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!court) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">Kortas nerastas</h1>
          <Button onClick={() => setLocation("/courts")}>Grįžti</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Photo Gallery */}
      <div className="w-full h-[45vh] min-h-[320px] bg-zinc-900 relative overflow-hidden">
        {allPhotos.length > 0 ? (
          <img
            key={activePhotoIdx}
            src={resolveCourtImage(allPhotos[activePhotoIdx]) ?? ""}
            alt={court.name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-3">
            <Images className="h-16 w-16" />
            <span className="text-5xl font-bold">{court.name.charAt(0)}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

        {/* Navigation arrows — only if multiple photos */}
        {allPhotos.length > 1 && (
          <>
            <button
              onClick={() => setActivePhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white rounded-full p-2 transition-all hover:scale-105"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActivePhotoIdx(i => (i + 1) % allPhotos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 backdrop-blur-sm text-white rounded-full p-2 transition-all hover:scale-105"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Photo counter badge */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Images className="h-3 w-3" />
              {activePhotoIdx + 1} / {allPhotos.length}
            </div>

            {/* Thumbnail strip */}
            <div className="absolute bottom-6 left-4 flex gap-1.5 max-w-[55%] overflow-x-auto pb-0.5 scrollbar-hide">
              {allPhotos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === activePhotoIdx ? "border-white scale-105" : "border-white/30 hover:border-white/60"}`}
                >
                  <img src={resolveCourtImage(url) ?? ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Dot indicators (compact, below thumbnails) */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
              {allPhotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`rounded-full transition-all ${i === activePhotoIdx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="container mx-auto px-4 relative -mt-32 z-10 pb-24">
        <div className="grid md:grid-cols-3 gap-8">

          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex gap-2 items-center mb-4">
                    <Badge variant="default" className="bg-primary text-primary-foreground">{court.type}</Badge>
                    {court.isIndoor && <Badge variant="secondary">Indoor</Badge>}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{court.name}</h1>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      if (!isSignedIn) return openSignIn();
                      await toggleFavorite(court.id);
                    }}
                    aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare} aria-label="Share court">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={openChat} aria-label="Message court">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" />{court.address}, {court.city}</div>
                <div className="flex items-center"><Users className="w-4 h-4 mr-2" />Max {court.maxPlayers} žaidėjai</div>
                {avgRating && (
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={avgRating} size="md" />
                    <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">({reviews?.length} atsiliepimai)</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Inline Chat */}
            <div ref={chatSectionRef}>
              {!chatOpen ? (
                <Button variant="outline" className="w-full gap-2" onClick={openChat}>
                  <MessageSquare className="w-4 h-4" />
                  Rašyti žinutę kortui
                </Button>
              ) : (
                <div className="rounded-2xl border bg-card overflow-hidden flex flex-col" style={{ height: 400 }}>
                  <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30 shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold text-sm">{court.name}</p>
                      <p className="text-xs text-muted-foreground">Pokalbis su kortu</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                    {chatLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                            <Skeleton className="h-9 w-40 rounded-2xl" />
                          </div>
                        ))}
                      </div>
                    ) : chatMsgs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-1">
                        <MessageSquare className="w-8 h-8 opacity-20" />
                        <p>Parašykite pirmą žinutę!</p>
                      </div>
                    ) : (
                      chatMsgs.map(msg => {
                        const isMine = msg.senderUserId === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                              {!isMine && <span className="text-[11px] text-muted-foreground px-1">{msg.senderName}</span>}
                              <div className={`px-3.5 py-2 rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                                {msg.body}
                              </div>
                              <span className="text-[10px] text-muted-foreground px-1">
                                {format(parseISO(msg.createdAt), "HH:mm · dd MMM")}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  <div className="border-t px-3 py-2.5 flex gap-2 items-end shrink-0 bg-card">
                    <Textarea
                      placeholder="Rašykite žinutę..."
                      className="resize-none min-h-[36px] max-h-[100px] text-sm"
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                      rows={1}
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleChatSend} disabled={chatSending || !chatText.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Apie kortą</h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {court.description || "Aukštos kokybės sporto aikštelė, tinkama varžyboms, treniruotėms ir draugiškoms rungtynėms."}
              </p>
            </div>

            {/* Amenities */}
            {court.amenities && court.amenities.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Patogumai</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {court.amenities.map((amenity, i) => {
                    type IconType = typeof Lightbulb;
                    const icons: Record<string, IconType> = {
                      floodlights: Lightbulb,
                      showers: ShowerHead,
                      changing_rooms: DoorOpen,
                      water_station: Droplets,
                    };
                    const labels: Record<string, string> = {
                      floodlights: "Prožektoriai",
                      showers: "Dušai",
                      changing_rooms: "Persirengimo kambariai",
                      water_station: "Vandens stotis",
                    };
                    const Icon = icons[amenity] ?? CheckCircle2;
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-muted/30 text-center">
                        <Icon className="w-6 h-6 text-primary" />
                        <span className="text-sm font-medium">{labels[amenity] ?? amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rentable Items */}
            {(() => {
              try {
                const items: Array<{name: string; pricePerBooking: number}> =
                  court.rentableItems ? JSON.parse(court.rentableItems) : [];
                if (!items.length) return null;
                return (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                      Nuomojama įranga
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                          <span className="font-medium text-sm">{item.name}</span>
                          <Badge variant="secondary">{item.pricePerBooking}€ / rezerv.</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Peak Pricing info */}
            {court.peakPricePerHour && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5">
                <Zap className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Dinamiška kainodara</p>
                  <p className="text-sm text-muted-foreground">
                    Off-peak: <strong className="text-foreground">{court.pricePerHour}€/val</strong>&nbsp;·&nbsp;
                    Peak (Pir–Pen 17–22): <strong className="text-yellow-400">{court.peakPricePerHour}€/val</strong>
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Location & Contact */}
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold">Vieta ir kontaktai</h2>

              {/* Map embed */}
              <div className="rounded-xl overflow-hidden border h-56 w-full relative group">
                <iframe
                  title="Korto vieta"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${court.address}, ${court.city}, Lietuva`)}&hl=lt&z=16&output=embed`}
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${court.address}, ${court.city}, Lietuva`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 bg-white text-zinc-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-md flex items-center gap-1.5 hover:bg-primary hover:text-white transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Gauti kryptis
                </a>
              </div>

              {/* Contact info grid */}
              <div className="grid sm:grid-cols-2 gap-4">

                {/* Address card */}
                <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Adresas</p>
                    <p className="font-semibold text-sm">{court.address}</p>
                    <p className="text-sm text-muted-foreground">{court.city}, Lietuva</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(court.name + ", " + court.address + ", " + court.city)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      Atidaryti žemėlapyje <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Phone card */}
                {court.phone && (
                  <div className="flex gap-3 p-4 bg-muted/30 rounded-xl border">
                    <Phone className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Telefonas</p>
                      <a
                        href={`tel:${court.phone}`}
                        className="font-semibold text-sm hover:text-primary transition-colors"
                      >
                        {court.phone}
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">Spustelėkite, kad paskambintumėte</p>
                    </div>
                  </div>
                )}

                {/* Opening hours card */}
                {court.openingHours && court.openingHours.length > 0 && (
                  <div className={`flex gap-3 p-4 bg-muted/30 rounded-xl border ${!court.phone ? "sm:col-span-2" : ""}`}>
                    <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Darbo laikas</p>
                      <div className="space-y-1">
                        {court.openingHours.map((line, i) => {
                          const [days, hours] = line.split(": ");
                          return (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{days}</span>
                              <span className="font-semibold tabular-nums">{hours}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <Separator />

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Atsiliepimai</h2>
                {avgRating && (
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2">
                    <span className="text-3xl font-bold">{avgRating.toFixed(1)}</span>
                    <div>
                      <StarDisplay rating={avgRating} size="md" />
                      <p className="text-xs text-muted-foreground mt-0.5">{reviews?.length} atsiliepimai</p>
                    </div>
                  </div>
                )}
              </div>

              {!reviews || reviews.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
                  <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">Dar nėra atsiliepimų</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Rezervuokite kortą ir palikite atsiliepimą iš rezervacijų puslapio.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-card border rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{review.reviewerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(new Date(review.createdAt), "yyyy MMMM d")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StarDisplay rating={review.rating} size="sm" />
                          <span className="text-sm font-bold">{review.rating}.0</span>
                        </div>
                      </div>
                      {review.reviewText && (
                        <p className="text-muted-foreground leading-relaxed">{review.reviewText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Norite palikti atsiliepimą?</span>{" "}
                Eikite į{" "}
                <a href="/bookings" className="text-primary hover:underline font-medium">Mano rezervacijos</a>{" "}
                ir šalia patvirtintos rezervacijos spustelėkite „Vertinti".
              </div>
            </div>

            <Separator />

            {/* Coaches Section */}
            <CoachesSectionForCourt courtId={courtId} />

          </div>

          {/* Booking Widget */}
          <div className="relative">
            <div className="sticky top-24 bg-card border rounded-2xl p-6 shadow-xl space-y-5 border-t-[0.889px] border-r-[0.889px] border-b-[0.889px] border-l-[0.889px]">

              {/* Price header */}
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-3xl font-bold">{court.pricePerHour}€</span>
                  <span className="text-muted-foreground text-sm">/val</span>
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-sm">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {user && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Jūsų rezervacijos
                    </p>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setLocation("/bookings")}>
                      Visos
                    </Button>
                  </div>
                  {courtBookings.length === 0 ? (
                    <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      Šioje kortoje rezervacijų nėra.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {courtBookings.slice(0, 3).map((booking) => (
                        <div key={booking.id} className="rounded-xl border bg-muted/15 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{format(parseISO(String(booking.date).split("T")[0]), "yyyy-MM-dd")}</p>
                              <p className="text-xs text-muted-foreground">{booking.startTime} – {booking.endTime}</p>
                            </div>
                            <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className="shrink-0">
                              {booking.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Step 1: Date */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  Pasirinkite datą
                </p>
                <div className="border rounded-xl p-1 bg-background flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) { setDate(d); setSelectedStart(null); setSelectedEnd(null); }
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                    className="rounded-md"
                  />
                </div>
              </div>

              {/* Step 2: Time slot selection */}
              <div>
                <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  Pasirinkite laiką
                </p>
                <p className="text-xs text-muted-foreground mb-2">Spustelėkite vieną ar kelis 30 min laikotarpius</p>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Pasirinkta</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted-foreground/20 inline-block" /> Užimta</span>
                  {court.peakPricePerHour && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-yellow-400/20 border border-yellow-400/40 inline-block" />
                      <Zap className="w-2.5 h-2.5 text-yellow-400" />
                      Peak
                    </span>
                  )}
                </div>

                {availabilityLoading ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {slots.map((slot, idx) => {
                      const rangeStart = selectedSlotRange?.rangeStart ?? null;
                      const rangeEnd = selectedSlotRange?.rangeEnd ?? null;
                      const isSelected = rangeStart !== null && rangeEnd !== null
                        ? idx >= rangeStart && idx <= rangeEnd
                        : selectedStart === idx && selectedEnd === null;
                      const isRangeStart = idx === rangeStart;
                      const isRangeEnd = idx === rangeEnd;

                      const isPeak = court.peakPricePerHour != null && slot.price >= court.peakPricePerHour;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => handleSlotClick(idx)}
                          className={`relative rounded-lg border px-1 py-2.5 text-xs font-medium transition-all focus:outline-none ${
                            !slot.isAvailable
                              ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                              : isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[0.97]"
                                : isPeak
                                  ? "bg-yellow-400/10 text-foreground border-yellow-400/40 hover:border-yellow-400 cursor-pointer"
                                  : "bg-background text-foreground border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                          }`}
                        >
                          <div className="text-center leading-tight">
                            <div className={`flex items-center justify-center gap-0.5 ${isRangeStart || isRangeEnd ? "font-bold" : ""}`}>
                              {isPeak && !isSelected && <Zap className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
                              {slot.startTime}
                            </div>
                            <div className={`mt-0.5 flex items-center justify-center gap-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              <Euro className="w-2.5 h-2.5" />
                              <span>{slot.price.toFixed(0)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-muted rounded-xl text-sm text-muted-foreground flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    Šiai dienai laisvų laikų nėra.
                  </div>
                )}
              </div>

              {/* Booking summary — shown inline below slot grid once something is selected */}
              {selectedSlotRange ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Laikas</span>
                    <span className="font-semibold">{selectedSlotRange.startTime} – {selectedSlotRange.endTime}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Trukmė</span>
                    <span className="font-medium">{selectedSlotRange.durationLabel}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Iš viso</span>
                    <span className="text-primary">{selectedSlotRange.totalPrice.toFixed(2)} €</span>
                  </div>
                </div>
              ) : selectedStart !== null ? (
                <p className="text-xs text-center text-muted-foreground py-1">
                  Spustelėkite dar vieną laikotarpį, kad prailgintumėte rezervaciją, arba tą patį – kad atšauktumėte
                </p>
              ) : null}

              {/* Step 3: Reserve */}
              {selectedSlotRange && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                    Rezervuoti
                  </p>

                  {!clerkLoaded ? (
                    <Skeleton className="h-16 w-full rounded-xl" />
                  ) : isSignedIn && user ? (
                    <>
                      {/* Signed-in user card */}
                      <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt={user.fullName ?? "Profilis"} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-sm">
                              {(user.firstName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.primaryEmailAddress?.emailAddress}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                      </div>

                      <Button onClick={handleReserve} className="w-full h-12 text-base font-semibold gap-2" disabled={isPending}>
                        {isPending ? "Apdorojama..." : "Rezervuoti"}
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">Patvirtinimo laiškas bus išsiųstas iš karto</p>
                    </>
                  ) : (
                    /* Not signed in — guest booking form */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="guestFirstName" className="text-xs text-muted-foreground">Vardas *</Label>
                          <Input
                            id="guestFirstName"
                            placeholder="Vardas"
                            value={guestFirstName}
                            onChange={e => setGuestFirstName(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="guestLastName" className="text-xs text-muted-foreground">Pavardė *</Label>
                          <Input
                            id="guestLastName"
                            placeholder="Pavardė"
                            value={guestLastName}
                            onChange={e => setGuestLastName(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guestEmail" className="text-xs text-muted-foreground">El. paštas *</Label>
                        <Input
                          id="guestEmail"
                          type="email"
                          placeholder="jusu@el.pastas.lt"
                          value={guestEmail}
                          onChange={e => setGuestEmail(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guestPhone" className="text-xs text-muted-foreground">Telefono numeris *</Label>
                        <Input
                          id="guestPhone"
                          type="tel"
                          placeholder="+370 600 00000"
                          value={guestPhone}
                          onChange={e => setGuestPhone(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>

                      <Button
                        onClick={handleGuestReserve}
                        className="w-full h-12 text-base font-semibold gap-2"
                        disabled={isPending}
                      >
                        {isPending ? "Apdorojama..." : "Rezervuoti be registracijos"}
                      </Button>

                      {/* Account creation CTA */}
                      <div className="rounded-xl border border-border bg-muted/40 p-3 flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground text-center">
                          Norite sekti visas savo rezervacijas vienoje vietoje?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => openSignIn()}
                          >
                            <LogIn className="w-3 h-3" />
                            Prisijungti
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            onClick={() => openSignUp({
                              initialValues: {
                                firstName: guestFirstName || undefined,
                                lastName: guestLastName || undefined,
                                emailAddress: guestEmail || undefined,
                              }
                            })}
                          >
                            <UserPlus className="w-3 h-3" />
                            Registruotis
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedSlotRange && (
                <Button className="w-full h-12 text-base font-semibold opacity-50 cursor-not-allowed" disabled>
                  Pasirinkite laiką
                </Button>
              )}

            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
