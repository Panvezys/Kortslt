import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Settings } from "lucide-react";
import { Redirect } from "wouter";

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
      </div>
    </Layout>
  );
}
