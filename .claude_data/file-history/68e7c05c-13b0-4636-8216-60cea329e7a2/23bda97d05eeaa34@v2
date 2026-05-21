import { useState, useEffect, type ReactNode, type ComponentType } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  MessageSquare,
  Settings,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useRole } from "@/lib/useRole";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
  match: (location: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Apžvalga",
    href: "/coach/dashboard",
    match: (l) => l.startsWith("/coach/dashboard"),
  },
  {
    icon: CalendarDays,
    label: "Tvarkaraštis",
    href: "/coach/schedule",
    match: (l) => l.startsWith("/coach/schedule"),
  },
  {
    icon: Users,
    label: "Mokiniai",
    href: "/coach/students",
    match: (l) => l.startsWith("/coach/students"),
  },
  {
    icon: MessageSquare,
    label: "Žinutės",
    href: "/coach/messages",
    match: (l) => l.startsWith("/coach/messages"),
  },
  {
    icon: Settings,
    label: "Nustatymai",
    href: "/coach/settings",
    match: (l) => l.startsWith("/coach/settings"),
  },
];

// Navigation-only role switcher. Roles are additive in this system — clicking
// "Savininkas" just routes to /owner; it does not change the user's primary
// role. Only options the user actually has access to are shown.
function RoleSwitcher() {
  const [, navigate] = useLocation();
  const { isCoach, isOwner } = useRole();
  const [open, setOpen] = useState(false);

  const options: Array<{ label: string; href: string }> = [];
  options.push({ label: "Žaidėjas", href: "/" });
  if (isOwner) options.push({ label: "Savininkas", href: "/owner" });
  if (isCoach) options.push({ label: "Treneris", href: "/coach/dashboard" });

  if (options.length < 2) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium bg-muted/40 hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            Rodinys
          </span>
          <span>Treneris</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-10 rounded-lg border bg-card shadow-md overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(opt.href);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <a
      href={`${BASE_URL}${item.href}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(item.href);
      }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
    </a>
  );
}

interface CoachSidebarProps {
  open: boolean;
  onClose: () => void;
}

function CoachSidebar({ open, onClose }: CoachSidebarProps) {
  const [location, navigate] = useLocation();

  const onNavigate = (href: string) => {
    onClose();
    navigate(href);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-[55] md:hidden" onClick={onClose} />
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
          <span className="text-sm font-semibold">Trenerio valdymas</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Uždaryti meniu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 py-3 border-b border-border/60 shrink-0">
          <RoleSwitcher />
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pb-2">
            Trenerio sritis
          </p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              active={item.match(location)}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}

export interface CoachLayoutProps {
  title?: string;
  children: ReactNode;
}

export function CoachLayout({ title, children }: CoachLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  return (
    <Layout>
      <div className="flex bg-muted/20 min-h-[calc(100dvh-4rem)]">
        <CoachSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
              {title ?? "Trenerio valdymas"}
            </span>
          </div>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </Layout>
  );
}
