import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  CheckCircle2, Calendar, Clock, ArrowRight, Loader2, XCircle,
  Users, Copy, Check, Globe, Share2, CreditCard, UserPlus,
  ChevronDown, Download, MessageCircle, MapPin, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useSafeAuth } from "@/lib/safeAuth";
import { SignUp } from "@clerk/react";
import { openChat } from "@/components/chat-bubble";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface BookingInfo {
  id: number;
  courtId: number;
  courtName?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  customerName: string;
  customerEmail?: string;
  status: string;
  coachId?: string | null;
  coachServiceId?: number | null;
}

interface CoachLookup {
  id: number;
  name: string;
}

interface SplitConfirmInfo {
  bookingId: number;
  gameId: number | null;
  shareToken: string | null;
  pricePerSlot: number;
  totalSlots: number;
  paidSlots: number;
  totalPrice: number;
  date: string;
  startTime: string;
  endTime: string;
  sport: string | null;
  isPublic: boolean;
  courtId: number | null;
  courtName: string | null;
  courtImageUrl: string | null;
  facilityId?: number | null;
  /** The viewer's own share after their membership discount. */
  yourShareEur?: number;
}

function formatBookingDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "yyyy-MM-dd");
}

interface CalendarInfo {
  bookingId: number;
  date: string;
  startTime: string;
  endTime: string;
  courtName: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

function AddToCalendarButton({ info }: { info: CalendarInfo }) {
  const dateStr = info.date.split("T")[0].replace(/-/g, "");
  const start = `${dateStr}T${info.startTime.slice(0, 5).replace(":", "")}00`;
  const end = `${dateStr}T${info.endTime.slice(0, 5).replace(":", "")}00`;
  const courtLabel = info.courtName ?? "Kortas";
  const title = `Rezervacija – ${courtLabel}`;
  const locationParts = [info.address, info.city, "Lietuva"].filter(Boolean);
  const location = locationParts.join(", ");
  const details = [
    `📅 Rezervacija #${info.bookingId}`,
    `🏟 Aikštelė: ${courtLabel}`,
    location ? `📍 Adresas: ${location}` : null,
    info.phone ? `📞 Tel.: ${info.phone}` : null,
    `🔗 Peržiūrėti: ${window.location.origin}${BASE}/bookings/${info.bookingId}`,
  ].filter(Boolean).join("\n");
  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${start}/${end}` +
    `&ctz=Europe%2FVilnius` +
    `&details=${encodeURIComponent(details)}` +
    (location ? `&location=${encodeURIComponent(location)}` : "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Calendar className="w-4 h-4" />
          Pridėti į kalendorių
          <ChevronDown className="w-4 h-4 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => window.open(googleUrl, "_blank")}>
          <img
            src="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png"
            className="w-4 h-4 mr-2 object-contain"
            alt=""
          />
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(`${API}/bookings/${info.bookingId}/ics`, "_blank")}>
          <Download className="w-4 h-4 mr-2" />
          Apple Calendar (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShareArea({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled or API not supported
    }
  };

  const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="text-left space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dalintis</p>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate flex-1">{url}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Nukopijuota!" : "Kopijuoti"}
          </button>
        </div>
        {hasNativeShare && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={handleNativeShare}>
            <Share2 className="w-3.5 h-3.5" />
            Dalintis
          </Button>
        )}
      </div>
    </div>
  );
}

function SplitShareBox({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    try { await navigator.share({ title, url }); } catch { /* cancelled */ }
  };

  const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="bg-primary/5 border border-primary/25 rounded-xl p-4 text-left space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">Pakvieskite žaidėjus!</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pasidalinkite nuoroda — kiekvienas žaidėjas sumokės savo dalį.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate flex-1">{url}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-foreground hover:text-foreground/70 transition-colors shrink-0 font-semibold"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Nukopijuota!" : "Kopijuoti"}
          </button>
        </div>
        {hasNativeShare && (
          <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" onClick={handleNativeShare}>
            <Share2 className="w-3.5 h-3.5" />
            Dalintis
          </Button>
        )}
      </div>
    </div>
  );
}

const signUpAppearance: React.ComponentProps<typeof SignUp>["appearance"] = {
  variables: {
    colorPrimary: "#84cc16",
    colorBackground: "transparent",
    colorText: "var(--foreground)",
    colorInputBackground: "var(--muted)",
    colorInputText: "var(--foreground)",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
    fontSize: "0.875rem",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 p-0 bg-transparent w-full",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "border border-border bg-muted hover:bg-muted/70 text-foreground rounded-xl h-10 font-medium transition-colors",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
    formFieldLabel: "text-sm font-medium text-foreground text-left block",
    formFieldInput:
      "bg-muted border border-border rounded-xl h-10 text-foreground placeholder:text-muted-foreground focus:border-lime-500",
    formButtonPrimary:
      "bg-lime-500 hover:bg-lime-600 text-black font-semibold rounded-xl h-10 transition-colors",
    footer: { display: "none" },
    footerAction: { display: "none" },
    formFieldSuccessText: "text-lime-600",
    formFieldErrorText: "text-destructive text-xs",
    alertText: "text-sm",
  },
};

function ClaimProfileSection({ email }: { email: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-primary/30 rounded-xl bg-primary/5 text-left overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-primary/10 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground">Sukurkite paskyrą</p>
          <p className="text-xs text-muted-foreground truncate">
            Sutaupykite laiką kitą kartą – duomenys bus užpildyti automatiškai
          </p>
        </div>
        <span className="text-xs font-medium text-primary shrink-0">
          {expanded ? "Uždaryti" : "Registruotis"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-1 border-t border-primary/20">
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Mokėjimas sėkmingas! Sukurkite paskyrą, kad nereikėtų vesti duomenų kitą kartą
            ir galėtumėte sekti visas savo rezervacijas vienoje vietoje.
          </p>
          <SignUp
            routing="hash"
            fallbackRedirectUrl={`${BASE}/bookings`}
            initialValues={{ emailAddress: email }}
            appearance={signUpAppearance}
          />
        </div>
      )}
    </div>
  );
}

export default function BookingConfirmed() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isLoaded: authLoaded, isSignedIn } = useSafeAuth();
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("id");
  const sessionId = params.get("session_id");
  const isSplit = params.get("split") === "1";
  const isRecurring = params.get("recurring") === "1";

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [splitInfo, setSplitInfo] = useState<SplitConfirmInfo | null>(null);
  const [recurringBookings, setRecurringBookings] = useState<{
    id: number; date: string; startTime: string; endTime: string; courtName: string | null; totalPrice: number;
  }[] | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [courtOwner, setCourtOwner] = useState<{ userId: string; name: string; imageUrl?: string | null; address?: string | null; city?: string | null; phone?: string | null } | null>(null);
  const [courtGroup, setCourtGroup] = useState<{ facilityId: number; sport: string } | null>(null);
  const [coach, setCoach] = useState<CoachLookup | null>(null);

  useEffect(() => {
    try { sessionStorage.removeItem("stripeCancel_pending"); } catch { /* ignore */ }
    const confirm = async () => {
      try {
        if (isRecurring && sessionId) {
          const data = await customFetch<{ confirmed: number; bookings: { id: number; date: string; startTime: string; endTime: string; courtName: string | null; totalPrice: number }[] }>(
            `${API}/payments/confirm-recurring`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            }
          );
          setRecurringBookings(data.bookings);
        } else if (isSplit && sessionId) {
          const data = await customFetch<SplitConfirmInfo>(`${API}/payments/confirm-split`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          setSplitInfo(data);
        } else if (sessionId && !sessionId.startsWith("mock_")) {
          const data = await customFetch<any>(`${API}/payments/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          setBooking({ ...data, totalPrice: Number(data.totalPrice ?? 0) });
        } else if (bookingId) {
          const r = await fetch(`${API}/bookings/${bookingId}`);
          if (r.ok) {
            const data = await r.json();
            setBooking({ ...data, totalPrice: Number(data.totalPrice ?? 0) });
          }
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
          queryClient.invalidateQueries({ queryKey: ["court-activity"] }),
          queryClient.invalidateQueries({ queryKey: ["open-matches"] }),
          queryClient.invalidateQueries({ predicate: (q) => {
            const k = q.queryKey?.[0];
            return typeof k === "string" && k.includes("/availability");
          } }),
        ]);
        setState("success");
      } catch {
        setState("error");
      }
    };
    confirm();
  }, []);

  // Fetch court owner info once courtId is known (for "Chat with court" button)
  useEffect(() => {
    const cid = splitInfo?.courtId ?? booking?.courtId;
    if (!cid) return;
    fetch(`${API}/courts/${cid}`)
      .then(r => r.ok ? r.json() : null)
      .then((c: any) => {
        if (c?.ownerUserId) setCourtOwner({ userId: c.ownerUserId, name: c.ownerName || "Savininkas", imageUrl: c.imageUrl ?? null, address: c.address ?? null, city: c.city ?? null, phone: c.phone ?? null });
        if (c?.facilityId && c?.type) setCourtGroup({ facilityId: c.facilityId, sport: c.type });
      })
      .catch(() => {});
  }, [splitInfo?.courtId, booking?.courtId]);

  // Resolve coach profile when the booking has a coach attached so we can link
  // back to /coach/:id from the success page.
  useEffect(() => {
    const coachUserId = booking?.coachId;
    if (!coachUserId) return;
    fetch(`${API}/coaches/by-user/${encodeURIComponent(coachUserId)}`)
      .then(r => r.ok ? r.json() : null)
      .then((c: CoachLookup | null) => { if (c) setCoach(c); })
      .catch(() => {});
  }, [booking?.coachId]);

  const shareUrl = splitInfo?.shareToken
    ? `${window.location.origin}${BASE}/join/${splitInfo.shareToken}`
    : null;

  // Group page when we know the facility+sport (primary flow since the
  // /explore transition); legacy court page stays the fallback.
  const groupUrl = splitInfo?.facilityId && splitInfo?.sport
    ? `${BASE}/facility/${splitInfo.facilityId}?sport=${splitInfo.sport.replace(/-/g, "_")}`
    : courtGroup
      ? `${BASE}/facility/${courtGroup.facilityId}?sport=${courtGroup.sport.replace(/-/g, "_")}`
      : null;
  const courtPageUrl = groupUrl
    ?? (splitInfo?.courtId
      ? `${BASE}/courts/${splitInfo.courtId}`
      : booking?.courtId
        ? `${BASE}/courts/${booking.courtId}`
        : null);

  return (
    <Layout>
      <div className="container mx-auto flex items-center justify-center min-h-[70vh] px-4 py-8">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-xl space-y-6">

          {state === "loading" && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Apdorojamas mokėjimas…</h1>
                <p className="text-muted-foreground text-sm">Prašome palaukti</p>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Mokėjimas nepavyko</h1>
                <p className="text-muted-foreground text-sm">Bandykite dar kartą arba susisiekite su mumis.</p>
              </div>
              <Button onClick={() => setLocation("/explore")} className="w-full">
                Grįžti į aikštelių sąrašą
              </Button>
            </>
          )}

          {state === "success" && splitInfo && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">Žaidimas sukurtas!</h1>
                  <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">Garantuota</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Sumokėjote savo dalį (€{(splitInfo.yourShareEur ?? splitInfo.pricePerSlot).toFixed(2)}). Pakviesk žaidėjus ir padalinkite kortą.
                </p>
                {(() => {
                  const [gh, gm] = splitInfo.startTime.split(":").map(Number);
                  const deadlineMs = new Date(`${splitInfo.date.split("T")[0]}T${splitInfo.startTime}:00`).getTime() - 2 * 60 * 60 * 1000;
                  const dl = new Date(deadlineMs);
                  const dlStr = `${dl.toLocaleDateString("lt-LT")} ${dl.getHours().toString().padStart(2,"0")}:${dl.getMinutes().toString().padStart(2,"0")}`;
                  return (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
                      Visa suma turi būti surinkta iki <strong>{dlStr}</strong>. Jei ne — likusi dalis bus nuskaityta nuo jūsų kortelės.
                    </p>
                  );
                })()}
              </div>

              {/* Court info */}
              {splitInfo.courtName && (
                <div className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <button type="button" onClick={() => courtPageUrl && setLocation(courtPageUrl)} className="shrink-0">
                    {splitInfo.courtImageUrl ? (
                      <img
                        src={splitInfo.courtImageUrl.startsWith("http") ? splitInfo.courtImageUrl : `${BASE}/${splitInfo.courtImageUrl}`}
                        alt={splitInfo.courtName}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-base">🏟️</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => courtPageUrl && setLocation(courtPageUrl)}
                      className="font-semibold text-sm truncate block w-full text-left hover:text-primary transition-colors"
                    >
                      {splitInfo.courtName}
                    </button>
                    {courtOwner?.address && (() => {
                      const addr = `${courtOwner.address}${courtOwner.city ? `, ${courtOwner.city}` : ""}`;
                      return (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{addr}</span>
                        </a>
                      );
                    })()}
                  </div>
                  {isSignedIn && courtOwner && (
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                      onClick={() => openChat({
                        userId: courtOwner.userId,
                        userName: courtOwner.name,
                        ctxType: "booking",
                        ctxId: splitInfo.bookingId,
                      })}
                    >
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              {/* Date / time summary */}
              <div className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2.5 text-sm text-left">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{formatBookingDate(splitInfo.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{splitInfo.startTime} – {splitInfo.endTime}</span>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="bg-muted/30 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    Jūsų dalis (1/{splitInfo.totalSlots})
                  </span>
                  <span className="font-bold text-primary text-base">€{(splitInfo.yourShareEur ?? splitInfo.pricePerSlot).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">Visa rezervacijos kaina</span>
                  <span className="font-semibold">€{splitInfo.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Liko surinkti iš kitų</span>
                  <span className="font-semibold text-orange-500 dark:text-orange-400">
                    €{Math.max(0, splitInfo.totalPrice - splitInfo.pricePerSlot).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Player slots progress */}
              <div className="bg-muted/30 rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="w-4 h-4 text-primary" />
                    Žaidėjai
                  </span>
                  <span className="font-bold">{splitInfo.paidSlots}/{splitInfo.totalSlots} apmokėjo</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((splitInfo.paidSlots / splitInfo.totalSlots) * 100)}%` }}
                  />
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: splitInfo.totalSlots }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-7 rounded-md border flex items-center justify-center text-[10px] font-bold transition-colors ${
                        i < splitInfo.paidSlots
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-muted/60 border-border text-muted-foreground"
                      }`}
                    >
                      {i < splitInfo.paidSlots ? "✓" : `${(splitInfo.pricePerSlot).toFixed(0)}€`}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Kiekvienas žaidėjas moka <span className="font-semibold text-foreground">€{splitInfo.pricePerSlot.toFixed(2)}</span>
                </p>
              </div>

              {/* Share link — primary CTA */}
              {shareUrl && (
                <SplitShareBox
                  url={shareUrl}
                  title={`Prisijunk prie žaidimo aikštelėje ${splitInfo.courtName ?? "korts.lt"}!`}
                />
              )}

              <AddToCalendarButton
                info={{
                  bookingId: splitInfo.bookingId,
                  date: splitInfo.date,
                  startTime: splitInfo.startTime,
                  endTime: splitInfo.endTime,
                  courtName: splitInfo.courtName,
                  address: courtOwner?.address,
                  city: courtOwner?.city,
                  phone: courtOwner?.phone,
                }}
              />

              {sessionId?.startsWith("mock_") && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400 text-left">
                  🔑 <strong>Sandbox režimas:</strong> Naudotas testavimo mokėjimas. Realūs pinigai nenurašyti.
                </div>
              )}

              <div className="flex gap-3">
                {splitInfo.isPublic && (
                  <Button variant="outline" className="flex-1" onClick={() => setLocation("/matches")}>
                    <Globe className="w-4 h-4 mr-1" />
                    Atviri mačai
                  </Button>
                )}
                <Button onClick={() => setLocation("/bookings")} className="flex-1 gap-2">
                  Mano rezervacijos
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {state === "success" && recurringBookings && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Kartojamos rezervacijos patvirtintos!</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Mokėjimas gautas. {recurringBookings.length} rezervacij{recurringBookings.length === 1 ? "a" : recurringBookings.length < 10 ? "os" : "ų"} patvirtinta.
                </p>
              </div>

              <div className="w-full space-y-2 text-left">
                {recurringBookings.map((b, i) => {
                  const d = new Date(b.date);
                  const dateLabel = d.toLocaleDateString("lt-LT", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <div key={b.id} className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl px-3 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize truncate">{dateLabel}</p>
                        <p className="text-xs text-muted-foreground">{b.startTime}–{b.endTime}{b.courtName ? ` · ${b.courtName}` : ""}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    </div>
                  );
                })}
              </div>

              <div className="text-sm font-semibold text-center">
                Iš viso sumokėta: €{recurringBookings.reduce((s, b) => s + b.totalPrice, 0).toFixed(2)}
              </div>

              {sessionId?.startsWith("mock_") && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400 text-left">
                  🔑 <strong>Sandbox režimas:</strong> Naudotas testavimo mokėjimas. Realūs pinigai nenurašyti.
                </div>
              )}

              <Button onClick={() => setLocation("/bookings")} className="w-full gap-2">
                Mano rezervacijos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {state === "success" && !splitInfo && !recurringBookings && (
            <>
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </div>

              {(() => {
                const isCoachBooking = !!(booking?.coachId || booking?.coachServiceId);
                const coachName = coach?.name;
                return (
                  <div>
                    <h1 className="text-2xl font-bold mb-2">
                      {isCoachBooking
                        ? (coachName
                            ? `Sėkmingai užsisakėte pamoką su treneriu ${coachName}!`
                            : "Sėkmingai užsisakėte pamoką su treneriu!")
                        : "Rezervacija patvirtinta!"}
                    </h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {booking?.totalPrice && booking.totalPrice > 0
                        ? `Mokėjimas €${booking.totalPrice.toFixed(2)} gautas sėkmingai.`
                        : (isCoachBooking
                            ? "Jūsų pamoka sėkmingai užsakyta."
                            : "Jūsų aikštelės rezervacija sėkmingai patvirtinta.")}
                      {" "}Patvirtinimo laiškas išsiųstas jūsų el. paštu.
                    </p>
                  </div>
                );
              })()}

              {/* Court info */}
              {(booking?.courtName || booking?.courtId) && (
                <div className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <button type="button" onClick={() => courtPageUrl && setLocation(courtPageUrl)} className="shrink-0">
                    {courtOwner?.imageUrl ? (
                      <img
                        src={courtOwner.imageUrl.startsWith("http") ? courtOwner.imageUrl : `${BASE}/${courtOwner.imageUrl}`}
                        alt={booking.courtName ?? ""}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-base">🏟️</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => courtPageUrl && setLocation(courtPageUrl)}
                      className="font-semibold text-sm truncate block w-full text-left hover:text-primary transition-colors"
                    >
                      {booking.courtName ?? `Kortas #${booking.courtId}`}
                    </button>
                    {courtOwner?.address && (() => {
                      const addr = `${courtOwner.address}${courtOwner.city ? `, ${courtOwner.city}` : ""}`;
                      return (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
                          onClick={e => e.stopPropagation()}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{addr}</span>
                        </a>
                      );
                    })()}
                  </div>
                  {isSignedIn && courtOwner && booking?.id && (
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                      onClick={() => openChat({
                        userId: courtOwner.userId,
                        userName: courtOwner.name,
                        ctxType: "booking",
                        ctxId: booking.id,
                      })}
                    >
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}

              <div className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2.5 text-sm text-left">
                {booking?.date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{formatBookingDate(booking.date)}</span>
                  </div>
                )}
                {booking?.startTime && booking?.endTime && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{booking.startTime} – {booking.endTime}</span>
                  </div>
                )}
                {booking?.totalPrice != null && booking.totalPrice > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>💳</span>
                    <span>Sumokėta: €{booking.totalPrice.toFixed(2)}</span>
                  </div>
                )}
                {!booking?.date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Patikrinkite savo el. paštą dėl detalių</span>
                  </div>
                )}
              </div>

              {/* Share court page */}
              {courtPageUrl && (
                <ShareArea
                  url={`${window.location.origin}${courtPageUrl}`}
                  title={`Puiki aikštelė korts.lt – ${booking?.courtName ?? ""}`}
                />
              )}

              {booking?.id && booking.date && booking.startTime && booking.endTime && (
                <AddToCalendarButton
                  info={{
                    bookingId: booking.id,
                    date: booking.date,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    courtName: booking.courtName ?? null,
                    address: courtOwner?.address,
                    city: courtOwner?.city,
                    phone: courtOwner?.phone,
                  }}
                />
              )}

              {sessionId?.startsWith("mock_") && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-600 dark:text-yellow-400 text-left">
                  🔑 <strong>Sandbox režimas:</strong> Naudotas testavimo mokėjimas. Realūs pinigai nenurašyti.
                </div>
              )}

              {/* Claim Profile — shown to guests (not signed in) when Clerk is configured */}
              {authLoaded && !isSignedIn && !!clerkPubKey && booking?.customerEmail && (
                <ClaimProfileSection email={booking.customerEmail} />
              )}

              <div className="flex gap-3">
                <Button onClick={() => setLocation("/bookings")} className="flex-1 gap-2">
                  Mano rezervacijos
                  <ArrowRight className="w-4 h-4" />
                </Button>
                {coach?.id ? (
                  <Button variant="outline" onClick={() => setLocation(`/coach/${coach.id}`)} className="flex-1">
                    Grįžti į trenerio profilį
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setLocation("/explore")} className="flex-1">
                    Ieškoti aikštelių
                  </Button>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}
