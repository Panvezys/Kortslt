import { useMemo, useState, useEffect, type ReactNode, type ComponentType } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Trophy,
  CreditCard,
  Settings,
  Menu,
  MessageSquare,
  X,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { getSportLabel } from "@/components/sport-icon";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

export function useFacilityId(): number | undefined {
  const [location] = useLocation();
  return useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const v = new URLSearchParams(window.location.search).get("facility");
    return v ? Number(v) : undefined;
  }, [location]);
}

interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
  match: (location: string) => boolean;
}

function buildNavItems(facilityId?: number): NavItem[] {
  const fq = facilityId ? `?facility=${facilityId}` : "";
  return [
    {
      icon: LayoutDashboard,
      label: "Suvestinė",
      href: `/owner/dashboard${fq}`,
      match: (l) => l.startsWith("/owner/dashboard"),
    },
    {
      icon: Building2,
      label: "Mano aikštelės",
      href: facilityId ? `/owner/facility/${facilityId}` : `/owner`,
      match: (l) =>
        l === "/owner" ||
        (l.startsWith("/owner/facility") && !l.endsWith("/messages") && !l.includes("/court/")),
    },
    {
      icon: Users,
      label: "Treneriai",
      href: `/owner/coaches${fq}`,
      match: (l) => l.startsWith("/owner/coaches"),
    },
    ...(facilityId
      ? [
          {
            icon: MessageSquare,
            label: "Žinutės",
            href: `/owner/facility/${facilityId}/messages`,
            match: (l: string) =>
              l.startsWith(`/owner/facility/${facilityId}/messages`),
          },
        ]
      : []),
    {
      icon: Trophy,
      label: "Turnyrai",
      href: `/owner/tournaments${fq}`,
      match: (l) => l.startsWith("/owner/tournaments"),
    },
    {
      icon: CreditCard,
      label: "Mokėjimai",
      href: `/owner/payments${fq}`,
      match: (l) => l.startsWith("/owner/payments"),
    },
    {
      icon: Settings,
      label: "Nustatymai",
      href: `/owner/settings${fq}`,
      match: (l) => l.startsWith("/owner/settings"),
    },
  ];
}

interface Court {
  id: number;
  name: string;
  type: string;
  status?: string;
}

interface FacilityWithCourts {
  id: number;
  courts?: Court[];
}

interface OwnerSidebarProps {
  open: boolean;
  onClose: () => void;
  facilityId?: number;
  facilityName?: string;
}

function OwnerSidebar({ open, onClose, facilityId, facilityName }: OwnerSidebarProps) {
  const [location, navigate] = useLocation();
  const items = buildNavItems(facilityId);

  const onCourtRoute = facilityId
    ? location.includes(`/owner/facility/${facilityId}/court/`)
    : false;

  const [courtsOpen, setCourtsOpen] = useState(onCourtRoute);

  useEffect(() => {
    if (onCourtRoute) setCourtsOpen(true);
  }, [onCourtRoute]);

  const { data: facilities } = useQuery<FacilityWithCourts[]>({
    queryKey: ["owner-facilities"],
    queryFn: () => customFetch<FacilityWithCourts[]>(`${API_URL}/facilities`),
    enabled: !!facilityId,
    staleTime: 60_000,
  });

  const facilityCourts: Court[] = facilityId
    ? (facilities?.find(f => f.id === facilityId)?.courts ?? [])
    : [];

  const showCourtsDropdown = facilityId && facilityCourts.length > 1;

  const [mano, ...rest] = items;
  const treneriai = rest[0];
  const afterDropdown = rest.slice(1);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-[60] w-60 bg-card border-r border-border flex flex-col
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:sticky md:translate-x-0 md:flex md:self-start md:z-auto
          md:top-16 md:h-[calc(100dvh-4rem)]
        `}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-border shrink-0 md:hidden">
          <span className="text-sm font-semibold">Valdymas</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Uždaryti meniu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {facilityName && (
          <div className="px-4 py-2.5 border-b border-border/60 bg-muted/30 shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">
              Objektas
            </p>
            <p className="text-sm font-medium truncate">{facilityName}</p>
          </div>
        )}
        <div className="shrink-0 border-b border-border/60 p-3">
          <a
            href={`${BASE_URL}/owner`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onClose();
              navigate("/owner");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white transition-colors w-full"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Grįžti į objektus
          </a>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">
            Valdymas
          </p>

          {/* "Mano aikštelės" — first item */}
          {[mano].map((item) => {
            const active = item.match(location);
            return (
              <a
                key={item.label}
                href={`${BASE_URL}${item.href}`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onClose();
                  navigate(item.href);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </a>
            );
          })}

          {/* Courts dropdown — only when facility has 2+ courts */}
          {showCourtsDropdown && (
            <div>
              <button
                type="button"
                onClick={() => setCourtsOpen(o => !o)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 shrink-0 opacity-60" />
                  Kortai
                </span>
                {courtsOpen
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                }
              </button>

              {courtsOpen && (
                <div className="ml-3 mt-0.5 pl-3 border-l border-border/60 space-y-0.5">
                  {facilityCourts.map((court) => {
                    const courtHref = `/owner/facility/${facilityId}/court/${court.id}`;
                    const active = location.startsWith(courtHref);
                    return (
                      <a
                        key={court.id}
                        href={`${BASE_URL}${courtHref}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                          e.preventDefault();
                          onClose();
                          navigate(courtHref);
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="truncate flex-1 min-w-0">{court.name}</span>
                        {court.type && (
                          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                            {getSportLabel(court.type)}
                          </span>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* "Treneriai" and the rest */}
          {[treneriai, ...afterDropdown].map((item) => {
            const active = item.match(location);
            return (
              <a
                key={item.label}
                href={`${BASE_URL}${item.href}`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onClose();
                  navigate(item.href);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export interface OwnerLayoutProps {
  facilityId?: number;
  facilityName?: string;
  title?: string;
  children: ReactNode;
}

export function OwnerLayout({
  facilityId: facilityIdProp,
  facilityName,
  title,
  children,
}: OwnerLayoutProps) {
  const detectedId = useFacilityId();
  const facilityId = facilityIdProp ?? detectedId;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Layout>
      <div className="flex bg-muted/20 min-h-[calc(100dvh-4rem)]">
        <OwnerSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          facilityId={facilityId}
          facilityName={facilityName}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border bg-card">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 -ml-1 rounded hover:bg-muted transition-colors"
              aria-label="Atidaryti meniu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold truncate">
              {title ?? facilityName ?? "Valdymas"}
            </span>
          </div>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </Layout>
  );
}
