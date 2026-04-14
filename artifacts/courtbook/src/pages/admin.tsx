import { useState } from "react";
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
import {
  Check, X, Eye, ShieldAlert, FileText, RefreshCw,
  Users, Building2, ShieldCheck, User, Gavel, Database,
} from "lucide-react";
import { useRole } from "@/lib/useRole";

const SPORT_LABELS: Record<string, string> = {
  tennis: "Tenisas",
  basketball: "Krepšinis",
  padel: "Padelis",
  football: "Futbolas",
  badminton: "Badmintonas",
  squash: "Skvoše",
  table_tennis: "Stalo tenisas",
  golf: "Golfas",
  snooker: "Snukeris",
  bowling: "Boulingas",
};

type UserRole = "admin" | "owner" | "player";

interface UserRoleRow {
  userId: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
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
  return (
    <Badge className="bg-muted text-muted-foreground border-border gap-1">
      <User className="w-3 h-3" /> Žaidėjas
    </Badge>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useAdminCourts() {
  return useQuery<Court[]>({
    queryKey: ["admin-courts"],
    queryFn: () => customFetch<Court[]>("/api/admin/courts", { method: "GET" }),
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
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: courts, isLoading, isError } = useAdminCourts();
  const approveMutation = useApproveCourt();
  const rejectMutation = useRejectCourt();
  const seedMutation = useSeedCourts();

  const filtered = (courts ?? []).filter(c =>
    filterStatus === "all" ? true : c.status === filterStatus
  );

  const counts = {
    all: courts?.length ?? 0,
    pending: courts?.filter(c => c.status === "pending").length ?? 0,
    approved: courts?.filter(c => c.status === "approved").length ?? 0,
    rejected: courts?.filter(c => c.status === "rejected").length ?? 0,
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMutation.mutateAsync(id);
      toast({ title: "Kortas patvirtintas" });
    } catch {
      toast({ title: "Klaida patvirtinant", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (rejectDialogId === null) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectDialogId, reason: rejectReason || undefined });
      toast({ title: "Kortas atmestas" });
      setRejectDialogId(null);
      setRejectReason("");
    } catch {
      toast({ title: "Klaida atmetant", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Refresh + filter row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
            >
              {s === "all" && `Visi (${counts.all})`}
              {s === "pending" && `Laukiama (${counts.pending})`}
              {s === "approved" && `Patvirtinta (${counts.approved})`}
              {s === "rejected" && `Atmesta (${counts.rejected})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {counts.all === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const result = await seedMutation.mutateAsync();
                  toast({ title: result.message });
                } catch {
                  toast({ title: "Klaida seeding duomenų", variant: "destructive" });
                }
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

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {isError && (
        <div className="py-12 text-center text-muted-foreground">
          Nepavyko įkelti kortų.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium">Kortas</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Savininkas</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sportas</th>
                <th className="text-left px-4 py-3 font-medium">Statusas</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Dokumentas</th>
                <th className="text-right px-4 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Kortų nerasta
                  </td>
                </tr>
              )}
              {filtered.map(court => (
                <tr key={court.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{court.name}</div>
                    <div className="text-xs text-muted-foreground">{court.city}</div>
                    {court.rejectionReason && (
                      <div className="text-xs text-red-400 mt-0.5">❌ {court.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-sm">{court.ownerName}</div>
                    <div className="text-xs text-muted-foreground">{court.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {SPORT_LABELS[court.type] ?? court.type}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={court.status} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {court.ownershipDocUrl ? (
                      <a
                        href={court.ownershipDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                      >
                        <FileText className="w-3.5 h-3.5" /> Peržiūrėti
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {court.status !== "approved" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => handleApprove(court.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {court.status !== "rejected" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => setRejectDialogId(court.id)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" className="h-7 px-2"
                        onClick={() => window.open(`/courts/${court.id}`, "_blank")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog
        open={rejectDialogId !== null}
        onOpenChange={open => { if (!open) { setRejectDialogId(null); setRejectReason(""); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atmesti kortą</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Atmetimo priežastis (neprivaloma)</label>
              <Input
                placeholder="pvz. Trūksta dokumentų..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setRejectDialogId(null); setRejectReason(""); }}>
                Atšaukti
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                {rejectMutation.isPending ? "Atmetama..." : "Atmesti"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Users panel ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Savininkas" },
  { value: "player", label: "Žaidėjas" },
];

function UsersPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user: currentUser } = useUser();
  const { data: users, isLoading, isError } = useAdminUsers();
  const setRoleMutation = useSetUserRole();
  const [confirmDialog, setConfirmDialog] = useState<{
    userId: string;
    newRole: UserRole;
    currentRole: UserRole;
  } | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users ? `${users.length} vartotojai su priskirta role` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atnaujinti
        </Button>
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
                <th className="text-left px-4 py-3 font-medium">Vartotojo ID</th>
                <th className="text-left px-4 py-3 font-medium">Dabartinė rolė</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Prisijungė</th>
                <th className="text-right px-4 py-3 font-medium">Keisti rolę</th>
              </tr>
            </thead>
            <tbody>
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Vartotojų nerasta. Vartotojai atsiranda kai pirmą kartą prisijungia prie programos.
                  </td>
                </tr>
              )}
              {(users ?? []).map(u => {
                const isSelf = u.userId === currentUser?.id;
                return (
                  <tr key={u.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                          {u.userId}
                        </code>
                        {isSelf && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                            Jūs
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role as UserRole} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("lt-LT")}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
                {confirmDialog.newRole === "owner" && "Vartotojas galės valdyti kortus savininko skydelyje."}
                {confirmDialog.newRole === "player" && "Vartotojas neteks specialių teisių ir galės tik rezervuoti kortus."}
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

// ─── Main page ────────────────────────────────────────────────────────────────

type AdminTab = "courts" | "users";

export default function AdminDashboard() {
  const { isAdmin, isLoading: roleLoading } = useRole();
  const [activeTab, setActiveTab] = useState<AdminTab>("courts");

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
    { id: "courts", label: "Kortai", icon: <Building2 className="w-4 h-4" /> },
    { id: "users",  label: "Vartotojai", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administravimas</h1>
          <p className="text-muted-foreground mt-1">Kortų patvirtinimo ir vartotojų valdymo skydelis.</p>
        </div>

        {/* Top-level tabs */}
        <div className="flex gap-1 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
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
        {activeTab === "courts" && <CourtsPanel />}
        {activeTab === "users"  && <UsersPanel />}
      </div>
    </Layout>
  );
}
