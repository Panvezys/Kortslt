import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useRole } from "@/lib/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Trophy, Building2, Clock, ArrowRight, User,
  CheckCircle2, Calendar, CreditCard, Users, MapPin,
  Star, Zap, MessageSquare,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLES = [
  {
    key: "player",
    title: "Žaidėjas",
    subtitle: "Žaiskite, rezervuokite, mėgaukitės",
    description:
      "Ieškokite sporto aikštelių visoje Lietuvoje, rezervuokite laiką vos keliais paspaudimais ir susiraskite žaidimo partnerius.",
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    btnClass: "bg-emerald-500 hover:bg-emerald-600 text-white",
    icon: User,
    image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80&auto=format&fit=crop",
    features: [
      { icon: Calendar, text: "Rezervuokite aikšteles vos keliais paspaudimais" },
      { icon: Users, text: "Susiraskite žaidimo partnerių per Partnerių skyrių" },
      { icon: MessageSquare, text: "Bendraukite su kitais žaidėjais tiesiogiai" },
    ],
    cta: "Pradėti kaip žaidėją",
    path: "/",
  },
  {
    key: "coach",
    title: "Treneris",
    subtitle: "Mokykite, auginkite, uždarbiauke",
    description:
      "Sukurkite trenerio profilį ir leiskite žaidėjams rasti jus. Nustatykite kainodarą, grafikus ir valdykite savo klientus.",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    btnClass: "bg-blue-500 hover:bg-blue-600 text-white",
    icon: Trophy,
    image: "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=600&q=80&auto=format&fit=crop",
    features: [
      { icon: Star, text: "Asmeninis trenerio profilis su atsiliepimais" },
      { icon: CreditCard, text: "Nustatykite kainodarą ir prieinamumą" },
      { icon: MapPin, text: "Prisijunkite prie sporto aikštelių" },
    ],
    cta: "Tapti treneriu",
    path: "/become-coach",
  },
  {
    key: "owner",
    title: "Aikštelės savininkas",
    subtitle: "Valdykite, nuomokite, uždarbiauke",
    description:
      "Pridėkite savo sporto aikšteles ar kortus, nustatykite darbo laiką ir priimkite rezervacijas automatiškai.",
    color: "from-primary/20 to-primary/5",
    border: "border-primary/30",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    btnClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1622279888185-c7b3020d6b29?w=600&q=80&auto=format&fit=crop",
    features: [
      { icon: Zap, text: "Momentinis rezervavimas be patvirtinimo" },
      { icon: CreditCard, text: "Mokėjimai per Stripe Connect" },
      { icon: Calendar, text: "Valdykite grafikus ir prieinamumą" },
    ],
    cta: "Tapti savininku",
    path: "/become-owner",
  },
];

const PENDING_ROLE_LABEL: Record<string, string> = {
  coach: "Trenerio",
  owner: "Savininko",
};

export default function WelcomePage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { role, pendingRole, isLoading, isAdmin, isOwner, isCoach, isPending } = useRole();
  const qc = useQueryClient();
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (isAdmin || isOwner || isCoach)) {
      setLocation("/");
    }
  }, [isLoading, isAdmin, isOwner, isCoach]);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "Sveiki";

  function handleSelect(roleKey: string, path: string) {
    setSelecting(roleKey);
    setLocation(path);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3">Prašymas pateiktas!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Jūsų <strong className="text-foreground">{PENDING_ROLE_LABEL[pendingRole ?? ""] ?? pendingRole}</strong> vaidmens prašymas perduotas administratoriui. Paprastai atsakymą gausite per 24 val.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Grįžti į pagrindinį puslapį
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b bg-card/50 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <span className="font-extrabold text-lg tracking-tight text-foreground">
          korts<span className="text-primary">.lt</span>
        </span>
        <button
          onClick={() => setLocation("/")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Praleisti
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-5">
            👋 Sveiki atvykę, {firstName}!
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 leading-tight">
            Kaip ketinate naudoti<br className="hidden sm:block" /> korts.lt?
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Pasirinkite savo vaidmenį — nuo to priklausys jūsų prietaisų skydelis ir galimybės platformoje.
          </p>
        </div>

        {/* Role cards grid */}
        <div className="grid sm:grid-cols-3 gap-5">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const isSelecting = selecting === r.key;
            return (
              <button
                key={r.key}
                onClick={() => handleSelect(r.key, r.path)}
                disabled={!!selecting}
                className={`group relative flex flex-col text-left bg-card border rounded-2xl overflow-hidden transition-all duration-200
                  hover:shadow-xl hover:-translate-y-1 hover:${r.border}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${isSelecting ? "ring-2 ring-primary scale-[1.01]" : "border-border"}
                  ${selecting && !isSelecting ? "opacity-50" : ""}
                `}
              >
                {/* Photo header */}
                <div className="relative h-44 w-full overflow-hidden">
                  <img
                    src={r.image}
                    alt={r.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-b ${r.color} to-card`} />
                  {/* Icon badge */}
                  <div className={`absolute top-4 left-4 w-11 h-11 ${r.iconBg} backdrop-blur-sm rounded-xl flex items-center justify-center border ${r.border}`}>
                    <Icon className={`w-5 h-5 ${r.iconColor}`} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-5">
                  <div className="mb-3">
                    <h3 className="font-bold text-lg text-foreground leading-tight">{r.title}</h3>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">{r.subtitle}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    {r.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2 mb-5">
                    {r.features.map((f) => {
                      const FIcon = f.icon;
                      return (
                        <li key={f.text} className="flex items-start gap-2">
                          <FIcon className={`w-3.5 h-3.5 ${r.iconColor} shrink-0 mt-0.5`} />
                          <span className="text-xs text-muted-foreground leading-snug">{f.text}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* CTA button */}
                  <div className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${r.btnClass}`}>
                    {isSelecting ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {r.cta}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Vaidmenį visada galėsite pakeisti vėliau savo profilio nustatymuose.
        </p>
      </div>
    </div>
  );
}
