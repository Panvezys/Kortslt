import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { customFetch, type Court } from "@workspace/api-client-react";
import { extractApiError } from "@/lib/api-errors";
import { Link, useLocation } from "wouter";
import {
  Check, X, Eye, ShieldAlert, FileText, RefreshCw,
  Users, Building2, ShieldCheck, User, Gavel, Database,
  CreditCard, MapPin, Phone, Mail, ChevronRight, Image as ImageIcon,
  GraduationCap, Star, Clock, Trophy, Pencil, Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useRole } from "@/lib/useRole";
import { CourtEditDialog } from "@/components/court-edit-dialog";
import { SPORT_LABELS } from "@/components/sport-icon";

function safeDocUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (/^(\/)?courts\/docs\/[a-zA-Z0-9._-]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

type UserRole = "admin" | "owner" | "coach" | "player";

/** Admin-extended Court row — the /admin/courts endpoint returns the full DB row */
type AdminCourt = Court & { facilityId?: number | null; photos?: string[]; ownershipDocUrl?: string | null };

interface RoleRequest {
  userId: string;
  pendingRole: string;
  requestData?: string | null;
}

interface CoachRow {
  id: number | string;
  userId?: string;
  status: string;
  name: string;
  email: string;
  phone?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  pricePerHour?: number | null;
  sports?: string[];
  availabilityDescription?: string | null;
  rejectionReason?: string | null;
  _source?: string;
  _userId?: string;
}

interface UserRoleRow {
  userId: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  status?: string;
  pendingRole?: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  stripeAccountStatus?: string | null;
  lastSignInAt: number | null;
  clerkCreatedAt: number | null;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (status === "approved")
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Patvirtinta</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Atmesta</Badge>;
  return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Laukiama</Badge>;
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "admin")
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
        <ShieldCheck className="w-3 h-3" /> Admin
      </Badge>
    );
  if (role === "owner")
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
        <Building2 className="w-3 h-3" /> Savininkas
      </Badge>
    );
  if (role === "coach")
    return (
      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
        <GraduationCap className="w-3 h-3" /> Treneris
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground border-border gap-1">
      <User className="w-3 h-3" /> Žaidėjas
    </Badge>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useAdminCourts() {
  return useQuery<AdminCourt[]>({
    queryKey: ["admin-courts"],
    queryFn: () => customFetch<AdminCourt[]>("/api/admin/courts", { method: "GET" }),
    retry: false,
  });
}

function useApproveCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ id: number; status: string }>(`/api/admin/courts/${id}/approve`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-courts"] }),
  });
}

function useRejectCourt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      customFetch<{ id: number; status: string }>(`/api/admin/courts/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-courts"] }),
  });
}

function useAdminUsers() {
  return useQuery<UserRoleRow[]>({
    queryKey: ["admin-users"],
    queryFn: () => customFetch<UserRoleRow[]>("/api/admin/users", { method: "GET" }),
    retry: false,
  });
}

function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      customFetch<UserRoleRow>(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      customFetch<{ deleted: boolean }>(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

function useSeedCourts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ message: string; inserted: number }>("/api/admin/seed-courts", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-courts"] }),
  });
}

// ─── Courts panel ────────────────────────────────────────────────────────────

type FilterStatus = "all" | "pending" | "approved" | "rejected";

function CourtsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [reviewCourt, setReviewCourt] = useState<AdminCourt | null>(null);
  const [editCourt, setEditCourt] = useState<AdminCourt | null>(null);
  const [, navigate] = useLocation();

  const { data: courts, isLoading, isError } = useAdminCourts();
  const approveMutation = useApproveCourt();
  const rejectMutation = useRejectCourt();
  const seedMutation = useSeedCourts();

  const isPendingStatus = (s: string) => s === "pending" || s === "pending_review";

  const filtered = (courts ?? []).filter(c =>
    filterStatus === "all" ? true
    : filterStatus === "pending" ? isPendingStatus(c.status)
    : c.status === filterStatus
  ).filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.name, c.city, c.address, c.ownerName, c.ownerEmail, String(c.facilityId ?? "")]
      .some(v => v?.toLowerCase().includes(q));
  }).sort((a, b) => {
    const aValue = `${a.name ?? ""} ${a.city ?? ""}`.toLowerCase();
    const bValue = `${b.name ?? ""} ${b.city ?? ""}`.toLowerCase();
    return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  });

  const counts = {
    all: courts?.length ?? 0,
    pending: courts?.filter(c => isPendingStatus(c.status)).length ?? 0,
    approved: courts?.filter(c => c.status === "approved").length ?? 0,
    rejected: courts?.filter(c => c.status === "rejected").length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
              }`}
            >
              {s === "all" ? `Visi (${counts.all})` : s === "pending" ? `Laukiama (${counts.pending})` : s === "approved" ? `Patvirtinta (${counts.approved})` : `Atmesta (${counts.rejected})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ieškoti..." className="w-56" />
          <Button variant="outline" size="sm" onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
            {sortDirection === "asc" ? "A→Z" : "Z→A"}
          </Button>
          {counts.all === 0 && (
            <Button variant="outline" size="sm"
              onClick={async () => {
                try { const r = await seedMutation.mutateAsync(); toast({ title: r.message }); }
                catch { toast({ title: "Klaida seeding duomenų", variant: "destructive" }); }
              }}
              disabled={seedMutation.isPending}
            >
              <Database className="w-4 h-4 mr-2" />
              {seedMutation.isPending ? "Seeding..." : "Seed duomenų bazę"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-courts"] })}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
          </Button>
        </div>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {isError && <div className="py-12 text-center text-muted-foreground">Nepavyko įkelti aikštelių.</div>}

      {!isLoading && !isError && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Aikštelė</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Savininkas</th>
                <th className="text-left px-4 py-3 font-medium">Statusas</th>
                <th className="text-right px-4 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aikštelių nerasta</td></tr>
              )}
              {filtered.map(court => (
                <tr key={court.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setReviewCourt(court)}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{court.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{court.city}{court.address ? `, ${court.address}` : ""}
                    </div>
                    {court.rejectionReason && (
                      <div className="text-xs text-red-400 mt-0.5">❌ {court.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-sm">{court.ownerName}</div>
                    <div className="text-xs text-muted-foreground">{court.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={court.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          const fId = court.facilityId;
                          if (fId) {
                            navigate(`/owner/facility/${fId}?editCourt=${court.id}`);
                          } else {
                            setEditCourt(court);
                          }
                        }}>
                        <Pencil className="w-3.5 h-3.5" /> Redaguoti
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={e => { e.stopPropagation(); setReviewCourt(court); }}>
                        <Eye className="w-3.5 h-3.5" /> Peržiūrėti
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CourtEditDialog
        court={editCourt}
        open={editCourt !== null}
        onClose={() => setEditCourt(null)}
      />

      <CourtReviewDialog
        court={reviewCourt}
        open={reviewCourt !== null}
        onClose={() => setReviewCourt(null)}
        onApprove={async () => {
          if (!reviewCourt) return;
          try {
            await approveMutation.mutateAsync(reviewCourt.id);
            toast({ title: "Aikštelė patvirtinta ✓" });
            qc.invalidateQueries({ queryKey: ["admin-courts"] });
            setReviewCourt((prev: any) => prev ? { ...prev, status: "approved" } : prev);
          } catch { toast({ title: "Klaida tvirtinant", variant: "destructive" }); }
        }}
        onReject={async (reason) => {
          if (!reviewCourt) return;
          try {
            await rejectMutation.mutateAsync({ id: reviewCourt.id, reason: reason || undefined });
            toast({ title: "Aikštelė atmesta" });
            qc.invalidateQueries({ queryKey: ["admin-courts"] });
            setReviewCourt((prev: any) => prev ? { ...prev, status: "rejected", rejectionReason: reason } : prev);
          } catch { toast({ title: "Klaida atmetant", variant: "destructive" }); }
        }}
        isPendingApprove={approveMutation.isPending}
        isPendingReject={rejectMutation.isPending}
      />
    </div>
  );
}

// ─── Users panel ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Treneris" },
  { value: "owner", label: "Savininkas" },
  { value: "player", label: "Žaidėjas" },
];

function UsersPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user: currentUser } = useUser();
  const { data: users, isLoading, isError } = useAdminUsers();
  const setRoleMutation = useSetUserRole();
  const deleteMutation = useDeleteUser();
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [confirmDialog, setConfirmDialog] = useState<{
    userId: string;
    newRole: UserRole;
    currentRole: UserRole;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRoleRow | null>(null);

  const handleRoleChange = (userId: string, currentRole: UserRole, newRole: UserRole) => {
    if (newRole === currentRole) return;
    setConfirmDialog({ userId, newRole, currentRole });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog) return;
    try {
      await setRoleMutation.mutateAsync({ userId: confirmDialog.userId, role: confirmDialog.newRole });
      toast({ title: `Rolė pakeista į "${confirmDialog.newRole}"` });
      setConfirmDialog(null);
    } catch {
      toast({ title: "Klaida keičiant rolę", variant: "destructive" });
    }
  };

  const filteredUsers = (users ?? [])
    .filter(u => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [u.name, u.email, u.role, u.status].some(v => typeof v === "string" && v.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const aValue = `${a.name ?? ""} ${a.email ?? ""}`.toLowerCase();
      const bValue = `${b.name ?? ""} ${b.email ?? ""}`.toLowerCase();
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {users ? `${users.length} vartotojai su priskirta role` : ""}
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ieškoti..." className="w-56" />
          <Button variant="outline" size="sm" onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
            {sortDirection === "asc" ? "A→Z" : "Z→A"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {isError && (
        <div className="py-12 text-center text-muted-foreground">
          Nepavyko įkelti vartotojų.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Vartotojas</th>
                <th className="text-left px-4 py-3 font-medium">Rolė</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Pask. prisijungimas</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Sukurta</th>
                <th className="text-right px-4 py-3 font-medium">Keisti rolę</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Vartotojų nerasta. Vartotojai atsiranda kai pirmą kartą prisijungia prie programos.
                  </td>
                </tr>
              )}
              {filteredUsers.map(u => {
                const isSelf = u.userId === currentUser?.id;
                const displayRole = u.status === "pending_approval" && u.pendingRole ? u.role : u.role;
                const displayName = u.name || u.email || null;
                const initials = u.name
                  ? u.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                  : (u.email ? u.email.slice(0, 2).toUpperCase() : u.userId.slice(0, 2).toUpperCase());
                const fmtDateTime = (ts: number | string | null) => {
                  if (!ts) return <span className="text-muted-foreground/50">—</span>;
                  const d = new Date(typeof ts === "number" ? ts : ts);
                  return (
                    <span>
                      <span className="block">{d.toLocaleDateString("lt-LT")}</span>
                      <span className="text-muted-foreground/60">{d.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  );
                };
                return (
                  <tr key={u.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt={displayName ?? ""} className="w-full h-full object-cover" />
                            : initials}
                        </div>
                        {/* Name + email */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">
                              {displayName ?? <span className="font-mono text-xs text-muted-foreground">{u.userId.slice(0, 20)}…</span>}
                            </span>
                            {isSelf && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0">
                                Jūs
                              </Badge>
                            )}
                          </div>
                          {/* Show email as secondary line only if name was the primary */}
                          {u.name && u.email && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                              <Mail className="w-3 h-3 shrink-0" />{u.email}
                            </div>
                          )}
                          <code className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 block">
                            {u.userId.slice(0, 24)}…
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={displayRole as UserRole} />
                      {u.role === "owner" && (
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${OWNER_STRIPE_COLOR[u.stripeAccountStatus ?? "not_connected"]}`}>
                            <CreditCard className="w-2.5 h-2.5" />
                            {OWNER_STRIPE_LABEL[u.stripeAccountStatus ?? "not_connected"]}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {fmtDateTime(u.lastSignInAt)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                      {fmtDateTime(u.clerkCreatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <div className="flex justify-end">
                          <span className="text-xs text-muted-foreground italic">Negalima keisti savo rolės</span>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          {ROLE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              disabled={u.role === opt.value || setRoleMutation.isPending}
                              onClick={() => handleRoleChange(u.userId, u.role as UserRole, opt.value)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                u.role === opt.value
                                  ? opt.value === "admin"
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                    : opt.value === "owner"
                                      ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                      : "bg-muted text-muted-foreground border-border"
                                  : "bg-background border-border hover:border-primary/50 hover:text-primary"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {!isSelf && (
                        <button
                          onClick={() => setDeleteTarget(u)}
                          disabled={deleteMutation.isPending}
                          title="Ištrinti vartotoją"
                          className="p-1.5 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Ištrinti vartotoją?
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1 text-sm">
                <p className="font-medium">{deleteTarget.name || deleteTarget.email || deleteTarget.userId}</p>
                {deleteTarget.email && deleteTarget.name && (
                  <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
                )}
                <code className="text-[10px] text-muted-foreground/50 font-mono block">{deleteTarget.userId}</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Vartotojas bus <span className="text-destructive font-medium">negrįžtamai ištrintas</span> iš sistemos. Visi jo duomenys (rezervacijos, profiliai) bus pašalinti automatiškai.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                  Atšaukti
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={async () => {
                    try {
                      await deleteMutation.mutateAsync(deleteTarget.userId);
                      toast({ title: "Vartotojas ištrintas" });
                      setDeleteTarget(null);
                    } catch {
                      toast({ title: "Klaida trinant vartotoją", variant: "destructive" });
                    }
                  }}
                >
                  {deleteMutation.isPending ? "Trinama…" : "Ištrinti"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm role change dialog */}
      <Dialog open={confirmDialog !== null} onOpenChange={open => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-amber-400" /> Keisti vartotojo rolę
            </DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vartotojas</span>
                  <code className="text-xs font-mono">{confirmDialog.userId.slice(0, 20)}…</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dabartinė rolė</span>
                  <RoleBadge role={confirmDialog.currentRole} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nauja rolė</span>
                  <RoleBadge role={confirmDialog.newRole} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {confirmDialog.newRole === "admin" && "⚠️ Šis vartotojas gaus pilną administravimo prieigą."}
                {confirmDialog.newRole === "owner" && "Vartotojas galės valdyti aikšteles savininko skydelyje."}
                {confirmDialog.newRole === "player" && "Vartotojas neteks specialių teisių ir galės tik rezervuoti aikšteles."}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setConfirmDialog(null)}>Atšaukti</Button>
                <Button onClick={confirmRoleChange} disabled={setRoleMutation.isPending}>
                  {setRoleMutation.isPending ? "Keičiama..." : "Patvirtinti"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ─── Court review dialog ──────────────────────────────────────────────────────

function CourtReviewDialog({
  court,
  open,
  onClose,
  onApprove,
  onReject,
  isPendingApprove,
  isPendingReject,
}: {
  court: any;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isPendingApprove: boolean;
  isPendingReject: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!court) return null;
  const isApproved = court.status === "approved";
  const isRejected = court.status === "rejected";
  const courtDocUrl = safeDocUrl(court.ownershipDocUrl);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setShowRejectForm(false); setRejectReason(""); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {/* Hero */}
        <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden rounded-t-xl">
          {court.imageUrl ? (
            <img src={court.imageUrl} alt={court.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-14 h-14 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{court.name}</h2>
              <p className="text-white/75 text-xs flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{court.city}{court.address ? `, ${court.address}` : ""}
              </p>
            </div>
            <StatusBadge status={court.status} />
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isRejected && court.rejectionReason && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <span className="font-medium">Atmetimo priežastis:</span> {court.rejectionReason}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Sportas", value: SPORT_LABELS[court.type] ?? court.type },
              { label: "Kaina", value: `${court.pricePerHour}€/val` },
              { label: "Savininkas", value: court.ownerName },
              { label: "El. paštas", value: court.ownerEmail },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                <div className="text-sm font-medium truncate">{value}</div>
              </div>
            ))}
          </div>

          {courtDocUrl && (
            <a href={courtDocUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-primary">Peržiūrėti nuosavybės dokumentą</span>
              <ChevronRight className="w-4 h-4 text-primary ml-auto shrink-0" />
            </a>
          )}

          <Separator />

          {!showRejectForm ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {!isApproved && (
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2" onClick={onApprove} disabled={isPendingApprove}>
                  <Check className="w-4 h-4" />
                  {isPendingApprove ? "Tvirtinama..." : "Patvirtinti aikštelę"}
                </Button>
              )}
              {!isRejected && (
                <Button variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                  onClick={() => { setShowRejectForm(true); setRejectReason(""); }}>
                  <X className="w-4 h-4" /> Atmesti aikštelę
                </Button>
              )}
              {isApproved && <Button variant="ghost" size="sm" onClick={() => window.open(`/courts/${court.id}`, "_blank")} className="w-full gap-2"><Eye className="w-4 h-4" /> Peržiūrėti puslapyje</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Atmetimo priežastis <span className="text-red-400">*</span></label>
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Pvz.: Trūksta dokumentų..." rows={3} className="resize-none" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)}>Atšaukti</Button>
                <Button variant="destructive" className="flex-1" onClick={() => onReject(rejectReason)}
                  disabled={isPendingReject || !rejectReason.trim()}>
                  {isPendingReject ? "Atmetama..." : "Patvirtinti atmetimą"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Facilities panel ─────────────────────────────────────────────────────────

const VERIFICATION_LABEL: Record<string, string> = {
  draft: "Juodraštis",
  onboarding: "Stripe nebaigtas",
  pending_verification: "Laukia patvirtinimo",
  active: "Aktyvus",
  suspended: "Sustabdytas",
};

const VERIFICATION_COLOR: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  onboarding: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  pending_verification: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  active: "bg-green-500/10 text-green-400 border-green-500/30",
  suspended: "bg-red-500/10 text-red-400 border-red-500/30",
};

const OWNER_STRIPE_LABEL: Record<string, string> = {
  not_connected: "Neprijungta",
  pending: "Laukiama",
  active: "Aktyvus",
};

const OWNER_STRIPE_COLOR: Record<string, string> = {
  not_connected: "bg-muted/50 text-muted-foreground border-border",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  active: "bg-green-500/10 text-green-400 border-green-500/30",
};

function FacilityReviewDialog({
  facility,
  open,
  onClose,
  onApprove,
  onReject,
  isPendingApprove,
  isPendingReject,
}: {
  facility: any;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isPendingApprove: boolean;
  isPendingReject: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos: string[] = Array.isArray(facility?.photos) ? facility.photos : [];

  if (!facility) return null;

  const isActive = facility.verificationStatus === "active";
  const isPendingVerification = facility.verificationStatus === "pending_verification";
  const isOnboarding = facility.verificationStatus === "onboarding";
  const isDraft = facility.verificationStatus === "draft";
  const isSuspended = facility.verificationStatus === "suspended";
  const stripeReady = facility.ownerStripeStatus === "active";
  const adminNote: string | null = facility.verificationNotes ?? facility.rejectionReason ?? null;
  const facilityDocUrl = safeDocUrl(facility.ownershipDocUrl);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setShowRejectForm(false); setRejectReason(""); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header photo / hero */}
        <div className="relative h-44 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden rounded-t-xl">
          {photos.length > 0 ? (
            <>
              <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {photos.map((_: string, i: number) => (
                    <button key={i} onClick={() => setPhotoIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? "bg-white scale-125" : "bg-white/50"}`} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-16 h-16 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{facility.name}</h2>
              {(facility.city || facility.address) && (
                <p className="text-white/75 text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {[facility.address, facility.city, facility.postcode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <span className={`shrink-0 inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${VERIFICATION_COLOR[facility.verificationStatus ?? "pending"]}`}>
              {VERIFICATION_LABEL[facility.verificationStatus ?? "pending"]}
            </span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Admin note / rejection reason banner */}
          {(isDraft || isSuspended) && adminNote && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <span className="font-medium">Administratoriaus pastaba:</span> {adminNote}
            </div>
          )}

          {/* Pipeline diagnostic for the admin */}
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={stripeReady ? "text-green-500" : "text-amber-400"}>
                {stripeReady ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">Stripe Connect:</span>
              <span className="font-medium">{stripeReady ? "Užbaigta" : "Neužbaigta"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={facility.adminVerified ? "text-green-500" : "text-amber-400"}>
                {facility.adminVerified ? "✓" : "○"}
              </span>
              <span className="text-muted-foreground">Admin patvirtinimas:</span>
              <span className="font-medium">{facility.adminVerified ? "Patvirtinta" : "Nepatvirtinta"}</span>
            </div>
          </div>

          {/* Description */}
          {facility.description && (
            <p className="text-sm text-muted-foreground">{facility.description}</p>
          )}

          <Separator />

          {/* Company & legal info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Įmonės duomenys</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {facility.companyName && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Įmonės pavadinimas</div>
                  <div className="text-sm font-medium">{facility.companyName}</div>
                </div>
              )}
              {facility.registrationCode && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Įmonės kodas</div>
                  <div className="text-sm font-mono">{facility.registrationCode}</div>
                </div>
              )}
              {facility.phone && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Telefonas</div>
                    <a href={`tel:${facility.phone}`} className="text-sm hover:text-primary">{facility.phone}</a>
                  </div>
                </div>
              )}
              {facility.email && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">El. paštas</div>
                    <a href={`mailto:${facility.email}`} className="text-sm hover:text-primary break-all">{facility.email}</a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vieta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {facility.city && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Miestas</div>
                  <div className="text-sm">{facility.city}</div>
                </div>
              )}
              {facility.address && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Adresas</div>
                  <div className="text-sm">{facility.address}</div>
                </div>
              )}
              {facility.postcode && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pašto kodas</div>
                  <div className="text-sm">{facility.postcode}</div>
                </div>
              )}
              {facility.latitude && facility.longitude && (
                <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Koordinatės</div>
                  <div className="text-sm font-mono text-xs">{Number(facility.latitude).toFixed(5)}, {Number(facility.longitude).toFixed(5)}</div>
                </div>
              )}
            </div>
            {facility.latitude && facility.longitude && (
              <a
                href={`https://www.google.com/maps?q=${facility.latitude},${facility.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <MapPin className="w-3 h-3" /> Atidaryti Google Maps
              </a>
            )}
          </div>

          <Separator />

          {/* Ownership document */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Nuosavybės dokumentas</h3>
            {facilityDocUrl ? (
              <a
                href={facilityDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-3"
              >
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">Peržiūrėti dokumentą</div>
                  <div className="text-xs text-muted-foreground truncate">{facility.ownershipDocUrl.split("/").pop()}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-primary shrink-0" />
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <X className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">Dokumentas nepateiktas</p>
              </div>
            )}
          </div>

          {/* Owner Stripe status */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Savininko Stripe</span>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${OWNER_STRIPE_COLOR[facility.ownerStripeStatus ?? "not_connected"]}`}>
              {OWNER_STRIPE_LABEL[facility.ownerStripeStatus ?? "not_connected"]}
            </span>
          </div>

          <Separator />

          {/* Decision area */}
          {!showRejectForm ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {isPendingVerification && (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={onApprove}
                  disabled={isPendingApprove || !stripeReady}
                  title={!stripeReady ? "Savininkas dar neužbaigė Stripe Connect" : undefined}
                >
                  <Check className="w-4 h-4" />
                  {isPendingApprove
                    ? "Tvirtinama..."
                    : stripeReady
                      ? "Patvirtinti ir aktyvuoti"
                      : "Laukiama Stripe duomenų"}
                </Button>
              )}
              {(isPendingVerification || isActive) && (
                <Button
                  variant="outline"
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                  onClick={() => { setShowRejectForm(true); setRejectReason(""); }}
                >
                  <X className="w-4 h-4" />
                  {isActive ? "Grąžinti pataisymams" : "Prašyti pataisymų"}
                </Button>
              )}
              {(isDraft || isOnboarding || isSuspended) && (
                <p className="text-sm text-muted-foreground text-center w-full py-2">
                  {isDraft && "Savininkas dar nepateikė objekto patvirtinimui."}
                  {isOnboarding && "Savininkas dar neužbaigė Stripe Connect."}
                  {isSuspended && "Šis objektas yra sustabdytas."}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Pastaba savininkui <span className="text-red-400">*</span>
                </label>
                <Textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Pvz.: Prašome įkelti aiškesnes nuotraukas ir pridėti tikslų adresą su koordinatėmis."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)}>Atšaukti</Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReject(rejectReason)}
                  disabled={isPendingReject || !rejectReason.trim()}
                >
                  {isPendingReject ? "Siunčiama..." : "Grąžinti pataisymams"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FacilitiesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "draft" | "onboarding" | "pending_verification" | "active" | "suspended">("all");
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [reviewFacility, setReviewFacility] = useState<any | null>(null);
  const [, navigate] = useLocation();

  const { data: facilities = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["admin-facilities"],
    queryFn: () => customFetch<any[]>("/api/admin/facilities"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => customFetch<any>(`/api/admin/facilities/${id}/approve`, { method: "PUT" }),
    onSuccess: (_, id) => {
      toast({ title: "Objektas aktyvuotas ✓" });
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      setReviewFacility((prev: any) => prev?.id === id ? { ...prev, verificationStatus: "active", adminVerified: true } : prev);
    },
    onError: (err: any) => toast({
      title: "Klaida tvirtinant",
      description: extractApiError(err, "Patikrinkite, ar savininkas užbaigė Stripe Connect."),
      variant: "destructive",
    }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => customFetch<any>(`/api/admin/facilities/${id}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),
    onSuccess: (_, { id, reason }) => {
      toast({ title: "Pataisymai išsiųsti savininkui" });
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      setReviewFacility((prev: any) => prev?.id === id ? { ...prev, verificationStatus: "draft", adminVerified: false, verificationNotes: reason, rejectionReason: reason } : prev);
    },
    onError: (err: any) => toast({
      title: "Klaida siunčiant pataisymus",
      description: extractApiError(err, undefined),
      variant: "destructive",
    }),
  });

  // Suspend is the correct action for ACTIVE facilities (reject is only valid from
  // 'pending_verification'). The server enforces this with a compare-and-set guard.
  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => customFetch<any>(`/api/admin/facilities/${id}/suspend`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),
    onSuccess: (_, { id, reason }) => {
      toast({ title: "Objektas sustabdytas" });
      qc.invalidateQueries({ queryKey: ["admin-facilities"] });
      setReviewFacility((prev: any) => prev?.id === id ? { ...prev, verificationStatus: "suspended", verificationNotes: reason } : prev);
    },
    onError: (err: any) => toast({
      title: "Klaida sustabdant",
      description: extractApiError(err, undefined),
      variant: "destructive",
    }),
  });

  const filtered = (filter === "all" ? facilities : facilities.filter((f: any) => f.verificationStatus === filter))
    .filter((f: any) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [f.name, f.city, f.address, f.companyName, f.registrationCode, f.email].some(v => typeof v === "string" && v.toLowerCase().includes(q));
    })
    .sort((a: any, b: any) => {
      const aValue = `${a.name ?? ""} ${a.city ?? ""}`.toLowerCase();
      const bValue = `${b.name ?? ""} ${b.city ?? ""}`.toLowerCase();
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  const counts = {
    all: facilities.length,
    draft: facilities.filter((f: any) => f.verificationStatus === "draft").length,
    onboarding: facilities.filter((f: any) => f.verificationStatus === "onboarding").length,
    pending_verification: facilities.filter((f: any) => f.verificationStatus === "pending_verification").length,
    active: facilities.filter((f: any) => f.verificationStatus === "active").length,
    suspended: facilities.filter((f: any) => f.verificationStatus === "suspended").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(["all","pending_verification","onboarding","draft","active","suspended"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
              }`}
            >
              {s === "all" ? "Visi" : VERIFICATION_LABEL[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ieškoti..." className="w-56" />
          <Button variant="outline" size="sm" onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
            {sortDirection === "asc" ? "A→Z" : "Z→A"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-facilities"] })}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
          </Button>
        </div>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {isError && <div className="py-12 text-center text-muted-foreground">Nepavyko įkelti objektų.</div>}

      {!isLoading && !isError && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Objektas</th>
                <th className="text-left px-4 py-3 font-medium">Statusas</th>
                <th className="text-right px-4 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Objektų nerasta</td></tr>
              )}
              {filtered.map((f: any) => (
                <tr
                  key={f.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setReviewFacility(f)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{f.city}{f.address ? `, ${f.address}` : ""}
                    </div>
                    {(f.verificationNotes ?? f.rejectionReason) && (
                      <div className="text-xs text-red-400 mt-0.5">❌ {f.verificationNotes ?? f.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${VERIFICATION_COLOR[f.verificationStatus ?? "pending"]}`}>
                      {VERIFICATION_LABEL[f.verificationStatus ?? "pending"]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm" variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/owner/facility/${f.id}?editFacility=1`);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Redaguoti
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={e => { e.stopPropagation(); setReviewFacility(f); }}
                      >
                        <Eye className="w-3.5 h-3.5" /> Peržiūrėti
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FacilityReviewDialog
        facility={reviewFacility}
        open={reviewFacility !== null}
        onClose={() => setReviewFacility(null)}
        onApprove={() => reviewFacility && approveMutation.mutate(reviewFacility.id)}
        onReject={(reason) => {
          if (!reviewFacility) return;
          // Active facilities → suspend (the only valid transition out of 'active');
          // pending_verification → reject (sends back to draft with notes).
          if (reviewFacility.verificationStatus === "active") {
            suspendMutation.mutate({ id: reviewFacility.id, reason });
          } else {
            rejectMutation.mutate({ id: reviewFacility.id, reason });
          }
        }}
        isPendingApprove={approveMutation.isPending}
        isPendingReject={rejectMutation.isPending || suspendMutation.isPending}
      />
    </div>
  );
}

// ─── Coach review dialog ──────────────────────────────────────────────────────

function CoachReviewDialog({
  coach,
  open,
  onClose,
  onApprove,
  onReject,
  isPendingApprove,
  isPendingReject,
}: {
  coach: any;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isPendingApprove: boolean;
  isPendingReject: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!coach) return null;
  const isApproved = coach.status === "approved";
  const isRejected = coach.status === "rejected";

  const statusColors: Record<string, string> = {
    pending:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/10 text-green-400 border-green-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  const statusLabels: Record<string, string> = {
    pending: "Laukiama", approved: "Patvirtinta", rejected: "Atmesta",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setShowRejectForm(false); setRejectReason(""); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {/* Hero */}
        <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden rounded-t-xl">
          {coach.photoUrl ? (
            <img src={coach.photoUrl} alt={coach.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap className="w-14 h-14 text-primary/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{coach.name}</h2>
              {coach.sports?.length > 0 && (
                <p className="text-white/75 text-xs flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3" />{coach.sports.join(", ")}
                </p>
              )}
            </div>
            <span className={`shrink-0 inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[coach.status ?? "pending"]}`}>
              {statusLabels[coach.status ?? "pending"]}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isRejected && coach.rejectionReason && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <span className="font-medium">Atmetimo priežastis:</span> {coach.rejectionReason}
            </div>
          )}

          {coach.bio && <p className="text-sm text-muted-foreground">{coach.bio}</p>}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "El. paštas", value: coach.email, icon: <Mail className="w-3.5 h-3.5" /> },
              { label: "Telefonas", value: coach.phone ?? "—", icon: <Phone className="w-3.5 h-3.5" /> },
              { label: "Kaina", value: coach.pricePerHour ? `${coach.pricePerHour}€/val` : "—", icon: null },
              { label: "Sporto šakos", value: coach.sports?.join(", ") || "—", icon: null },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1">
                  {icon}{label}
                </div>
                <div className="text-sm font-medium truncate">{value}</div>
              </div>
            ))}
          </div>

          {coach.availabilityDescription && (
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prieinamumas</div>
              <p className="text-sm">{coach.availabilityDescription}</p>
            </div>
          )}

          <Separator />

          {!showRejectForm ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {!isApproved && (
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2" onClick={onApprove} disabled={isPendingApprove}>
                  <Check className="w-4 h-4" />
                  {isPendingApprove ? "Tvirtinama..." : "Patvirtinti trenerį"}
                </Button>
              )}
              {!isRejected && (
                <Button variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                  onClick={() => { setShowRejectForm(true); setRejectReason(""); }}>
                  <X className="w-4 h-4" /> Atmesti trenerį
                </Button>
              )}
              {isApproved && isRejected && (
                <p className="text-sm text-muted-foreground text-center w-full">Šio trenerio statusas jau nustatytas.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Atmetimo priežastis <span className="text-red-400">*</span></label>
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Pvz.: Pateikta informacija neatitinka reikalavimų..." rows={3} className="resize-none" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)}>Atšaukti</Button>
                <Button variant="destructive" className="flex-1" onClick={() => onReject(rejectReason)}
                  disabled={isPendingReject || !rejectReason.trim()}>
                  {isPendingReject ? "Atmetama..." : "Patvirtinti atmetimą"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coaches panel ────────────────────────────────────────────────────────────

function CoachesPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [reviewCoach, setReviewCoach] = useState<CoachRow | null>(null);

  const { data: coaches = [], isLoading, isError } = useQuery<CoachRow[]>({
    queryKey: ["admin-coaches"],
    queryFn: () => customFetch<CoachRow[]>("/api/admin/coaches"),
  });

  const { data: roleRequests = [] } = useQuery<RoleRequest[]>({
    queryKey: ["admin-role-requests"],
    queryFn: () => customFetch<RoleRequest[]>("/api/admin/role-requests"),
  });

  // Synthetic pending coaches from role-request system (not yet in coachesTable)
  const pendingRoleReqCoaches: CoachRow[] = roleRequests
    .filter(r => r.pendingRole === "coach")
    .map(r => {
      let rd: Record<string, unknown> = {};
      try { rd = r.requestData ? JSON.parse(r.requestData) : {}; } catch {}
      return {
        _source: "roleRequest",
        _userId: r.userId,
        id: `rr-${r.userId}`,
        status: "pending",
        name: typeof rd["name"] === "string" ? rd["name"] : "—",
        email: typeof rd["email"] === "string" ? rd["email"] : "—",
        phone: typeof rd["phone"] === "string" ? rd["phone"] : null,
        bio: typeof rd["bio"] === "string" ? rd["bio"] : null,
        photoUrl: typeof rd["photoUrl"] === "string" ? rd["photoUrl"] : null,
        pricePerHour: typeof rd["pricePerHour"] === "number" ? rd["pricePerHour"] : null,
        sports: Array.isArray(rd["sports"]) ? rd["sports"] as string[] : [],
        availabilityDescription: typeof rd["availabilityDescription"] === "string" ? rd["availabilityDescription"] : null,
        rejectionReason: null,
      };
    });

  // Deduplicate: if userId already has a coachesTable row, prefer that
  const coachUserIds = new Set(coaches.map(c => c.userId).filter(Boolean));
  const dedupedRoleReqs = pendingRoleReqCoaches.filter(r => !coachUserIds.has(r._userId));

  // Unified list for display
  const allCoaches = [...coaches, ...dedupedRoleReqs];

  const approveMutation = useMutation({
    mutationFn: (c: any) => {
      if (c._source === "roleRequest") {
        return customFetch<any>(`/api/admin/role-requests/${c._userId}/approve`, { method: "POST" });
      }
      return customFetch<any>(`/api/admin/coaches/${c.id}/approve`, { method: "PUT" });
    },
    onSuccess: (_, c) => {
      toast({ title: "Treneris patvirtintas ✓" });
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
      qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      setReviewCoach((prev: any) => prev?.id === c.id ? { ...prev, status: "approved" } : prev);
    },
    onError: () => toast({ title: "Klaida tvirtinant", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ coach, reason }: { coach: any; reason: string }) => {
      if (coach._source === "roleRequest") {
        return customFetch<any>(`/api/admin/role-requests/${coach._userId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      }
      return customFetch<any>(`/api/admin/coaches/${coach.id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: (_, { coach, reason }) => {
      toast({ title: "Treneris atmestas" });
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
      qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      setReviewCoach((prev: any) => prev?.id === coach.id ? { ...prev, status: "rejected", rejectionReason: reason } : prev);
    },
    onError: () => toast({ title: "Klaida atmetant", variant: "destructive" }),
  });

  const statusLabels: Record<string, string> = { pending: "Laukiama", approved: "Patvirtinta", rejected: "Atmesta" };
  const statusColors: Record<string, string> = {
    pending:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/10 text-green-400 border-green-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  const filtered = (filter === "all" ? allCoaches : allCoaches.filter((c: any) => c.status === filter))
    .filter((c: any) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [c.name, c.email, c.status, c.sports?.join(", ")].some(v => typeof v === "string" && v.toLowerCase().includes(q));
    })
    .sort((a: any, b: any) => {
      const aValue = `${a.name ?? ""} ${a.email ?? ""}`.toLowerCase();
      const bValue = `${b.name ?? ""} ${b.email ?? ""}`.toLowerCase();
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  const counts = {
    all: allCoaches.length,
    pending:  allCoaches.filter((c: any) => c.status === "pending").length,
    approved: allCoaches.filter((c: any) => c.status === "approved").length,
    rejected: allCoaches.filter((c: any) => c.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
              }`}>
              {s === "all" ? "Visi" : statusLabels[s]} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ieškoti..." className="w-56" />
          <Button variant="outline" size="sm" onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}>
            {sortDirection === "asc" ? "A→Z" : "Z→A"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ["admin-coaches"] });
            qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
          }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
          </Button>
        </div>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {isError && <div className="py-12 text-center text-muted-foreground">Nepavyko įkelti trenerių.</div>}

      {!isLoading && !isError && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Treneris</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Sportas</th>
                <th className="text-left px-4 py-3 font-medium">Statusas</th>
                <th className="text-right px-4 py-3 font-medium">Peržiūra</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Trenerių nerasta</td></tr>
              )}
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setReviewCoach(c)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4 text-primary/50" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          {c._source === "roleRequest" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Prašymas
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                        {c.rejectionReason && (
                          <div className="text-xs text-red-400 mt-0.5">❌ {c.rejectionReason}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {c.sports?.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${statusColors[c.status ?? "pending"]}`}>
                      {statusLabels[c.status ?? "pending"]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                      onClick={e => { e.stopPropagation(); setReviewCoach(c); }}>
                      <Eye className="w-3.5 h-3.5" /> Peržiūrėti
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CoachReviewDialog
        coach={reviewCoach}
        open={reviewCoach !== null}
        onClose={() => setReviewCoach(null)}
        onApprove={() => reviewCoach && approveMutation.mutate(reviewCoach)}
        onReject={(reason) => reviewCoach && rejectMutation.mutate({ coach: reviewCoach, reason })}
        isPendingApprove={approveMutation.isPending}
        isPendingReject={rejectMutation.isPending}
      />
    </div>
  );
}

// ─── Owners Panel ─────────────────────────────────────────────────────────────
interface OwnerRoleRequest {
  userId: string;
  role: string;
  pendingRole: string | null;
  requestData: string | null;
  status: string;
  createdAt: string;
}

function OwnersPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reviewRequest, setReviewRequest] = useState<OwnerRoleRequest | null>(null);
  const [rejectDialog, setRejectDialog] = useState<OwnerRoleRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: allRequests, isLoading, isError } = useQuery<OwnerRoleRequest[]>({
    queryKey: ["admin-role-requests"],
    queryFn: () => customFetch<OwnerRoleRequest[]>("/api/admin/role-requests"),
    retry: false,
  });

  const ownerRequests = (allRequests ?? []).filter(r => r.pendingRole === "owner");

  const approveMutation = useMutation({
    mutationFn: (userId: string) =>
      customFetch(`/api/admin/role-requests/${userId}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Savininkas patvirtintas" });
      setReviewRequest(null);
    },
    onError: () => toast({ title: "Klaida patvirtinant", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      customFetch(`/api/admin/role-requests/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      toast({ title: "Prašymas atmestas" });
      setRejectDialog(null);
      setReviewRequest(null);
      setRejectReason("");
    },
    onError: () => toast({ title: "Klaida atmestant", variant: "destructive" }),
  });

  const getReqData = (r: OwnerRoleRequest) => {
    try { return r.requestData ? JSON.parse(r.requestData) : {}; } catch { return {}; }
  };

  const BIZ_FIELD_LABELS: Record<string, string> = {
    companyName: "Juridinis pavadinimas", registrationCode: "Įmonės kodas",
    vatNumber: "PVM kodas", websiteUrl: "Svetainė", address: "Adresas",
    city: "Miestas", postcode: "Pašto kodas", phone: "Telefonas",
    email: "El. paštas", description: "Aprašymas",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {ownerRequests.length === 0
            ? "Nėra laukiančių savininko prašymų."
            : `${ownerRequests.length} laukiantis prašymas.`}
        </p>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-role-requests"] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
        </Button>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {isError && <div className="py-8 text-center text-muted-foreground">Nepavyko įkelti prašymų.</div>}

      {!isLoading && ownerRequests.length === 0 && !isError && (
        <div className="py-16 flex flex-col items-center text-muted-foreground gap-2">
          <Building2 className="w-10 h-10 opacity-20" />
          <p>Šiuo metu nėra laukiančių savininko prašymų</p>
        </div>
      )}

      {!isLoading && ownerRequests.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Pareiškėjas</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Įmonė</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Pateikta</th>
                <th className="text-right px-4 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {ownerRequests.map(r => {
                const data = getReqData(r);
                return (
                  <tr key={r.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setReviewRequest(r)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-primary/50" />
                        </div>
                        <div>
                          <code className="text-xs font-mono text-muted-foreground/70">{r.userId.slice(0, 22)}…</code>
                          {data.email && <div className="text-xs text-muted-foreground">{data.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="font-medium">{data.companyName ?? "—"}</div>
                      {data.registrationCode && <div className="text-xs text-muted-foreground">{data.registrationCode}</div>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("lt-LT")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); setReviewRequest(r); }}>
                          <Eye className="w-3.5 h-3.5" /> Peržiūrėti
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={reviewRequest !== null} onOpenChange={open => { if (!open) setReviewRequest(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Savininko prašymas
            </DialogTitle>
          </DialogHeader>
          {reviewRequest && (() => {
            const data = getReqData(reviewRequest);
            return (
              <div className="space-y-4 pt-1">
                <div className="bg-muted/30 border rounded-xl p-4 space-y-2 text-sm">
                  {Object.entries(BIZ_FIELD_LABELS).map(([key, label]) =>
                    data[key] ? (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-muted-foreground min-w-32 text-xs pt-0.5">{label}</span>
                        <span className="font-medium text-foreground break-all">{String(data[key])}</span>
                      </div>
                    ) : null
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/5"
                    onClick={() => { setRejectDialog(reviewRequest); setReviewRequest(null); }}>
                    Atmesti
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(reviewRequest.userId)}
                    disabled={approveMutation.isPending}>
                    {approveMutation.isPending ? "Tvirtinama..." : "✓ Patvirtinti"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={rejectDialog !== null} onOpenChange={open => { if (!open) { setRejectDialog(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atmesti prašymą</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea
              placeholder="Atmetimo priežastis (neprivaloma)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(""); }}>Atšaukti</Button>
              <Button variant="destructive" disabled={rejectMutation.isPending}
                onClick={() => rejectDialog && rejectMutation.mutate({ userId: rejectDialog.userId, reason: rejectReason })}>
                {rejectMutation.isPending ? "Atmetama..." : "Atmesti"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Edit Approvals Panel ──────────────────────────────────────────────────────
interface EditRequest {
  id: number;
  ownerUserId: string;
  entityType: string;
  requestedData: string;
  currentData: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
}

function EditRequestsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reviewReq, setReviewReq] = useState<EditRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const { data: allReqs, isLoading, isError } = useQuery<EditRequest[]>({
    queryKey: ["admin-edit-requests"],
    queryFn: () => customFetch<EditRequest[]>("/api/admin/edit-requests"),
    retry: false,
  });

  const filtered = (allReqs ?? []).filter(r => filter === "all" || r.status === filter);

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/admin/edit-requests/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-edit-requests"] });
      toast({ title: "Pakeitimai patvirtinti" });
      setReviewReq(null);
    },
    onError: () => toast({ title: "Klaida patvirtinant", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      customFetch(`/api/admin/edit-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-edit-requests"] });
      toast({ title: "Prašymas atmestas" });
      setReviewReq(null);
      setRejectNotes("");
    },
    onError: () => toast({ title: "Klaida atmestant", variant: "destructive" }),
  });

  const parseJson = (s: string | null | undefined) => {
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  };

  const FIELD_LABELS: Record<string, string> = {
    companyName: "Juridinis pavadinimas", registrationCode: "Įmonės kodas",
    vatNumber: "PVM kodas", websiteUrl: "Svetainė", address: "Adresas",
    city: "Miestas", postcode: "Pašto kodas", description: "Aprašymas",
  };

  const counts = {
    all: (allReqs ?? []).length,
    pending: (allReqs ?? []).filter(r => r.status === "pending").length,
    approved: (allReqs ?? []).filter(r => r.status === "approved").length,
    rejected: (allReqs ?? []).filter(r => r.status === "rejected").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/60"
              }`}>
              {s === "all" ? "Visi" : s === "pending" ? "Laukiama" : s === "approved" ? "Patvirtinta" : "Atmesta"} ({counts[s]})
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-edit-requests"] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
        </Button>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {isError && <div className="py-8 text-center text-muted-foreground">Nepavyko įkelti prašymų.</div>}

      {!isLoading && filtered.length === 0 && !isError && (
        <div className="py-16 flex flex-col items-center text-muted-foreground gap-2">
          <FileText className="w-10 h-10 opacity-20" />
          <p>Šiuo metu nėra redagavimo prašymų</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Savininkas</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Laukai</th>
                <th className="text-left px-4 py-3 font-medium">Statusas</th>
                <th className="text-right px-4 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const requested = parseJson(r.requestedData);
                const fields = Object.keys(requested).map(k => FIELD_LABELS[k] ?? k);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setReviewReq(r)}>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-muted-foreground/70">{r.ownerUserId.slice(0, 22)}…</code>
                      <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("lt-LT")}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {fields.join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={e => { e.stopPropagation(); setReviewReq(r); }}>
                          <Eye className="w-3.5 h-3.5" /> Peržiūrėti
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={reviewReq !== null} onOpenChange={open => { if (!open) { setReviewReq(null); setRejectNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Verslo informacijos redagavimo prašymas
            </DialogTitle>
          </DialogHeader>
          {reviewReq && (() => {
            const requested = parseJson(reviewReq.requestedData);
            const current = parseJson(reviewReq.currentData);
            return (
              <div className="space-y-4 pt-1">
                <div className="bg-muted/30 border rounded-xl p-4 space-y-2 text-sm">
                  {Object.entries(requested).map(([key, newVal]) => (
                    <div key={key} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{FIELD_LABELS[key] ?? key}</p>
                      {current[key] && current[key] !== newVal && (
                        <p className="line-through text-muted-foreground/50 text-xs">{String(current[key])}</p>
                      )}
                      <p className="font-medium text-green-400">{String(newVal)}</p>
                    </div>
                  ))}
                </div>
                {reviewReq.status === "pending" ? (
                  <div className="space-y-3">
                    <Textarea placeholder="Pastabos (neprivaloma)..." value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)} rows={2} />
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/5"
                        disabled={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate({ id: reviewReq.id, notes: rejectNotes })}>
                        {rejectMutation.isPending ? "Atmetama..." : "Atmesti"}
                      </Button>
                      <Button onClick={() => approveMutation.mutate(reviewReq.id)} disabled={approveMutation.isPending}>
                        {approveMutation.isPending ? "Tvirtinama..." : "✓ Patvirtinti"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StatusBadge status={reviewReq.status} />
                    {reviewReq.adminNotes && <span>{reviewReq.adminNotes}</span>}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type AdminTab = "courts" | "users" | "facilities" | "coaches" | "owners" | "editRequests";

export default function AdminDashboard() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const initialTab = (): AdminTab => {
    const p = new URLSearchParams(window.location.search).get("tab");
    const valid: AdminTab[] = ["courts", "users", "facilities", "coaches", "owners", "editRequests"];
    return valid.includes(p as AdminTab) ? (p as AdminTab) : "facilities";
  };
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  if (roleLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Prieiga draudžiama</h1>
          <p className="text-muted-foreground max-w-sm">
            Šis puslapis skirtas tik administratoriams.
          </p>
        </div>
      </Layout>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "facilities",   label: "Objektai",     icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "courts",       label: "Aikštelės",    icon: <Building2 className="w-4 h-4" /> },
    { id: "coaches",      label: "Treneriai",    icon: <GraduationCap className="w-4 h-4" /> },
    { id: "owners",       label: "Savininkai",   icon: <Trophy className="w-4 h-4" /> },
    { id: "editRequests", label: "Redavimai",    icon: <FileText className="w-4 h-4" /> },
    { id: "users",        label: "Vartotojai",   icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administravimas</h1>
          <p className="text-muted-foreground mt-1">Objektų, aikštelių, trenerių patvirtinimas ir vartotojų valdymas.</p>
        </div>

        {/* Top-level tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        {activeTab === "facilities"   && <FacilitiesPanel />}
        {activeTab === "courts"       && <CourtsPanel />}
        {activeTab === "coaches"      && <CoachesPanel />}
        {activeTab === "owners"       && <OwnersPanel />}
        {activeTab === "editRequests" && <EditRequestsPanel />}
        {activeTab === "users"        && <UsersPanel />}
      </div>
    </Layout>
  );
}
