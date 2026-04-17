import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useRole } from "@/lib/useRole";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Trophy, Building2, CheckCircle2, Clock, ArrowRight, User, Star,
} from "lucide-react";

export default function WelcomePage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { role, status, pendingRole, isLoading, isAdmin, isOwner, isCoach, isPending } = useRole();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoading && (isAdmin || isOwner || isCoach)) {
      setLocation("/");
    }
  }, [isLoading, isAdmin, isOwner, isCoach]);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "Sveiki";

  const ROLE_LABELS: Record<string, string> = {
    player: "Žaidėjas",
    coach: "Treneris",
    owner: "Aikštelės savininkas",
    admin: "Administratorius",
  };

  const PENDING_ROLE_LABEL: Record<string, string> = {
    coach: "Trenerio",
    owner: "Savininko",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3">
            Sveiki, {firstName}!
          </h1>
          <p className="text-muted-foreground text-base max-w-sm mx-auto">
            Prisijungėte prie korts.lt — Lietuvos sporto aikštelių rezervavimo platformos.
          </p>
        </div>

        {/* Current role badge */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Jūsų dabartinis vaidmuo</p>
            <p className="font-bold text-foreground">{ROLE_LABELS[role ?? "player"] ?? role}</p>
          </div>
          {isPending && pendingRole && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
              <Clock className="w-3.5 h-3.5" />
              {PENDING_ROLE_LABEL[pendingRole]} prašymas laukia patvirtinimo
            </span>
          )}
        </div>

        {isPending ? (
          /* Pending state */
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 text-center mb-8">
            <Clock className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
            <h2 className="font-bold text-lg text-foreground mb-2">Prašymas pateiktas</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Jūsų <strong className="text-foreground">{PENDING_ROLE_LABEL[pendingRole ?? ""] ?? pendingRole}</strong> vaidmens prašymas perduotas administratoriui. Paprastai atsakymą gausite per 24 val.
            </p>
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => setLocation("/")}
            >
              Grįžti į pagrindinį puslapį
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-foreground mb-4">Pasirinkite savo vaidmenį</h2>

            <div className="space-y-4 mb-8">
              {/* Coach card */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                    <Trophy className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground mb-1">Tapti treneriu</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sukurkite trenerio profilį, nurodykite sporto šakas, kainodarą ir prieinamumą. Klientai galės rasti ir užsiregistruoti pas jus.
                    </p>
                    <ul className="space-y-1.5 mb-4">
                      {[
                        "Asmeninis trenerio profilis",
                        "Nustatykite kainodarą ir laiką",
                        "Valdykite savo sportus ir aprašymą",
                      ].map(t => (
                        <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => setLocation("/become-coach")}
                    >
                      Tapti treneriu
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Owner card */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground mb-1">Tapti aikštelės savininku</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Pridėkite savo sporto aikšteles, nustatykite darbo laiką, priimkite rezervacijas ir valdykite savo objektus vienoje vietoje.
                    </p>
                    <ul className="space-y-1.5 mb-4">
                      {[
                        "Neribotai aikštelių ir kortų",
                        "Automatinis rezervavimas",
                        "Mokėjimų valdymas per Stripe",
                      ].map(t => (
                        <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => setLocation("/become-owner")}
                    >
                      Tapti savininku
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Skip */}
            <div className="text-center">
              <button
                onClick={() => setLocation("/")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Tęsti kaip žaidėją — galėsiu pasirinkti vaidmenį vėliau
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
