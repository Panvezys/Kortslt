import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SportIcon } from "@/components/sport-icon";
import { MessageCircle, Gamepad2, Timer, EyeOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas", basketball: "Krepšinis", padel: "Padelis",
  football: "Futbolas", badminton: "Badmintonas", squash: "Skvošas",
  table_tennis: "Stalo tenisas", golf: "Golfas", snooker: "Snukeris", bowling: "Boulingas",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Pradedantysis",
  intermediate: "Vidutinis",
  advanced: "Pažengęs",
  pro: "Profesionalas",
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600 border-green-200 dark:border-green-900 dark:text-green-400",
  intermediate: "bg-blue-500/15 text-blue-600 border-blue-200 dark:border-blue-900 dark:text-blue-400",
  advanced: "bg-orange-500/15 text-orange-600 border-orange-200 dark:border-orange-900 dark:text-orange-400",
  pro: "bg-purple-500/15 text-purple-600 border-purple-200 dark:border-purple-900 dark:text-purple-400",
};

interface PublicProfile {
  userId: string;
  activityPublic: boolean;
  bio: string | null;
  imageUrl: string | null;
  sportProfiles: { sport: string; level: string }[];
  stats: { sport: string; gamesPlayed: number; hoursPlayed: number }[];
}

interface UserProfileCardProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userImageUrl?: string | null;
  onMessage?: () => void;
}

export function UserProfileCard({ open, onClose, userId, userName, userImageUrl, onMessage }: UserProfileCardProps) {
  const { data, isLoading } = useQuery<PublicProfile>({
    queryKey: ["public-profile", userId],
    queryFn: () => customFetch<PublicProfile>(`${API}/user-profiles/${userId}`),
    enabled: open && !!userId,
    staleTime: 60_000,
  });

  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const avatarUrl = userImageUrl ?? data?.imageUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="h-20 bg-gradient-to-r from-primary/30 via-primary/15 to-transparent" />
        <div className="px-6 pb-6 -mt-10 space-y-4">
          {/* Avatar + name */}
          <div className="flex items-end gap-4">
            <Avatar className="w-20 h-20 border-4 border-background shadow-lg shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="pb-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{userName}</h2>
            </div>
          </div>

          {/* Bio */}
          {data?.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed">{data.bio}</p>
          )}

          {/* Sport profiles */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : !data?.activityPublic ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <EyeOff className="w-4 h-4 shrink-0" />
              <span>Sporto veikla slepiama</span>
            </div>
          ) : data.sportProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sporto šakos nepridėtos</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sportai</p>
              <div className="space-y-2">
                {data.sportProfiles.map(sp => {
                  const stats = data.stats.find(s => s.sport === sp.sport);
                  return (
                    <div key={sp.sport} className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                        <SportIcon sport={sp.sport} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium">{SPORT_LABELS[sp.sport] ?? sp.sport}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${LEVEL_COLOR[sp.level] ?? ""}`}>
                            {LEVEL_LABELS[sp.level] ?? sp.level}
                          </Badge>
                        </div>
                        {stats && (stats.gamesPlayed > 0 || stats.hoursPlayed > 0) && (
                          <div className="flex items-center gap-3 mt-0.5">
                            {stats.gamesPlayed > 0 && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Gamepad2 className="w-3 h-3" />
                                {stats.gamesPlayed} žaidimai
                              </span>
                            )}
                            {stats.hoursPlayed > 0 && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {stats.hoursPlayed}h
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message button */}
          {onMessage && (
            <Button className="w-full gap-2" onClick={() => { onClose(); onMessage(); }}>
              <MessageCircle className="w-4 h-4" />
              Rašyti žinutę
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
