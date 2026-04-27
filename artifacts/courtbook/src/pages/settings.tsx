import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Bell, Settings, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface NotifSettings {
  userId: string;
  gameJoinRequest: boolean;
  gameCancelled: boolean;
  bookingCreated: boolean;
  bookingCancelled: boolean;
  courtApproved: boolean;
  messageReceived: boolean;
}

const NOTIF_OPTIONS: { key: keyof Omit<NotifSettings, "userId">; label: string; description: string }[] = [
  {
    key: "gameJoinRequest",
    label: "Žaidimo prisijungimas",
    description: "Kai žaidėjas prisijungia prie jūsų sukurto žaidimo",
  },
  {
    key: "gameCancelled",
    label: "Žaidimas atšauktas",
    description: "Kai žaidimas, prie kurio prisijungėte, yra atšauktas",
  },
  {
    key: "bookingCreated",
    label: "Nauja rezervacija",
    description: "Kai žaidėjas užrezervuoja jūsų aikštelę (savininkams / treneriams)",
  },
  {
    key: "bookingCancelled",
    label: "Rezervacija atšaukta",
    description: "Kai rezervacija jūsų aikštelėje yra atšaukta",
  },
  {
    key: "courtApproved",
    label: "Aikštelės patvirtinimas",
    description: "Kai jūsų aikštelė patvirtinta arba atmesta",
  },
  {
    key: "messageReceived",
    label: "Naujos žinutės",
    description: "Kai gausite naują privačią žinutę",
  },
];

export default function SettingsPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // 1. Wipe bookings from our database first (while session is still valid)
      await customFetch(`${API}/delete-user-data`, { method: "POST" });
      // 2. Delete the Clerk user — this also signs them out
      await user.delete();
      // 3. Send them home
      setLocation("/");
    } catch (err) {
      console.error("[delete-account] failed", err);
      toast({
        title: "Nepavyko ištrinti paskyros",
        description: "Bandykite dar kartą arba kreipkitės į pagalbą.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  const { data, isLoading } = useQuery<NotifSettings>({
    queryKey: ["notification-settings"],
    queryFn: () => customFetch<NotifSettings>(`${API}/notification-settings`),
    enabled: !!isSignedIn,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<NotifSettings>) =>
      customFetch(`${API}/notification-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-settings"] }),
  });

  if (isLoaded && !isSignedIn) return <Redirect to="/sign-in" />;

  const defaults: Omit<NotifSettings, "userId"> = {
    gameJoinRequest: true,
    gameCancelled: true,
    bookingCreated: true,
    bookingCancelled: true,
    courtApproved: true,
    messageReceived: true,
  };
  const settings = { ...defaults, ...data };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nustatymai</h1>
            <p className="text-sm text-muted-foreground">Tvarkykite savo paskyros nustatymus</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Pranešimų nustatymai</p>
              <p className="text-xs text-muted-foreground">Pasirinkite, kokius pranešimus norite gauti</p>
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {NOTIF_OPTIONS.map(opt => (
                <div key={opt.key} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                  <Switch
                    checked={settings[opt.key]}
                    onCheckedChange={(checked) => update.mutate({ [opt.key]: checked })}
                    disabled={update.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone — Delete account */}
        <div className="bg-card border border-destructive/30 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-destructive/20">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-sm text-destructive">Pavojinga zona</p>
              <p className="text-xs text-muted-foreground">Negrįžtami veiksmai jūsų paskyrai</p>
            </div>
          </div>

          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Ištrinti paskyrą</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visam laikui ištrins jūsų paskyrą ir visas rezervacijas. Šio veiksmo atšaukti negalima.
              </p>
            </div>
            <AlertDialog onOpenChange={(open) => { if (!open) setConfirmText(""); }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2 shrink-0" disabled={isDeleting}>
                  <Trash2 className="w-4 h-4" />
                  Ištrinti paskyrą
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Ar tikrai norite ištrinti paskyrą?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm">
                      <p>Šis veiksmas:</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        <li>Visam laikui ištrins jūsų paskyrą ({user?.emailAddresses[0]?.emailAddress})</li>
                        <li>Pašalins visas jūsų rezervacijas iš mūsų sistemos</li>
                        <li>Atjungs jus nuo visų prisijungtų įrenginių</li>
                      </ul>
                      <p className="text-foreground font-medium pt-1">
                        Įveskite <span className="font-mono bg-muted px-1.5 py-0.5 rounded">IŠTRINTI</span>, kad patvirtintumėte:
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="IŠTRINTI"
                        className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
                        disabled={isDeleting}
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Atšaukti</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                    disabled={isDeleting || confirmText !== "IŠTRINTI"}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Trinama...</>
                    ) : (
                      <>Taip, ištrinti paskyrą</>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
