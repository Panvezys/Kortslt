import { Link, useLocation } from "wouter";
import { ThemeProvider, useTheme } from "./theme-provider";
import { useUser, useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, CalendarDays, LayoutDashboard, Menu, X, Globe, Sun, Moon, UserCircle, ShieldCheck, Trophy, Dumbbell, Heart } from "lucide-react";

import { useState } from "react";
import { useI18n, useT, type Locale } from "@/lib/i18n";
import { useRole } from "@/lib/useRole";
import { NotificationBell } from "@/components/notification-bell";

function TennisCourtIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        maskImage: "url(/icons/court-icon.png)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: "url(/icons/court-icon.png)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function LogoBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-bold text-xl tracking-tight"
    >
      <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="kg-bg" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <clipPath id="kg-clip">
            <rect width="34" height="34" rx="8" />
          </clipPath>
        </defs>
        <rect width="34" height="34" rx="8" fill="url(#kg-bg)" />
        <g clipPath="url(#kg-clip)">
          <rect x="0" y="0" width="34" height="5.7" fill="rgba(255,255,255,0.055)" />
          <rect x="0" y="11.3" width="34" height="5.7" fill="rgba(255,255,255,0.055)" />
          <rect x="0" y="22.6" width="34" height="5.7" fill="rgba(255,255,255,0.055)" />
          <line x1="5" y1="6" x2="29" y2="6" stroke="rgba(255,255,255,0.28)" strokeWidth="0.85" />
          <line x1="5" y1="28" x2="29" y2="28" stroke="rgba(255,255,255,0.28)" strokeWidth="0.85" />
          <line x1="5" y1="6" x2="5" y2="28" stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
          <line x1="29" y1="6" x2="29" y2="28" stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
          <line x1="5" y1="17" x2="29" y2="17" stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
          <line x1="17" y1="6" x2="17" y2="28" stroke="rgba(255,255,255,0.13)" strokeWidth="0.6" />
        </g>
        <text x="17" y="24" textAnchor="middle" fontFamily="'Arial Black','Impact',Arial,sans-serif" fontSize="19" fontWeight="900" fill="white" letterSpacing="-0.5">K</text>
      </svg>
      <span>
        k
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "0.72em",
            height: "0.72em",
            verticalAlign: "middle",
            backgroundColor: "currentColor",
            maskImage: "url(/icons/tennis-ball.png)",
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: "url(/icons/tennis-ball.png)",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
        rts.lt
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center justify-center w-8 h-8 rounded-md border border-border hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

const LOCALES: { code: Locale; label: string }[] = [
  { code: "lt", label: "LT" },
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold border border-border hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          {locale.toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-28 min-w-0">
        {LOCALES.map(({ code, label }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={`text-sm font-medium ${locale === code ? "text-primary font-bold" : ""}`}
          >
            {label}
            {locale === code && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const t = useT();
  const { isAdmin, isOwner } = useRole();

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.fullName || t("nav.account")}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/profile")}>
          <UserCircle className="mr-2 h-4 w-4" />
          {t("nav.myProfile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/bookings")}>
          <CalendarDays className="mr-2 h-4 w-4" />
          {t("nav.myBookings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/profile?tab=favorites")}>
          <Heart className="mr-2 h-4 w-4 text-red-500" />
          Mėgstamiausi
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/coach/me")}>
          <Trophy className="mr-2 h-4 w-4" />
          Trenerio profilis
        </DropdownMenuItem>
        {isOwner && (
          <DropdownMenuItem onClick={() => setLocation("/owner")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("nav.ownerDashboard")}
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onClick={() => setLocation("/admin")} className="text-amber-500 focus:text-amber-400">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Administravimas
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileUserAvatar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const t = useT();
  const { isAdmin, isOwner } = useRole();

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="md:hidden flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open profile menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.imageUrl} alt={user.fullName ?? "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName || t("nav.account")}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/profile")}>
          <UserCircle className="mr-2 h-4 w-4" />
          {t("nav.myProfile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/bookings")}>
          <CalendarDays className="mr-2 h-4 w-4" />
          {t("nav.myBookings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/profile?tab=favorites")}>
          <Heart className="mr-2 h-4 w-4 text-red-500" />
          Mėgstamiausi
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/coach/me")}>
          <Trophy className="mr-2 h-4 w-4" />
          Trenerio profilis
        </DropdownMenuItem>
        {isOwner && (
          <DropdownMenuItem onClick={() => setLocation("/owner")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("nav.ownerDashboard")}
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onClick={() => setLocation("/admin")} className="text-amber-500 focus:text-amber-400">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Administravimas
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useT();

  return (
    <ThemeProvider>
      <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <LogoBrand />

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/courts" className="transition-colors hover:text-primary flex items-center gap-1.5">
                <TennisCourtIcon className="w-3.5 h-3.5" />
                {t("nav.findCourts")}
              </Link>
              <Link href="/coaches" className="transition-colors hover:text-primary flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5" />
                Treneriai
              </Link>
              <Link href="/tournaments" className="transition-colors hover:text-primary flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Turnyrai
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
              <Show when="signed-out">
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sign-in">{t("nav.signIn")}</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/sign-up">{t("nav.register")}</Link>
                  </Button>
                </div>
              </Show>
              <Show when="signed-in">
                <NotificationBell />
                <div className="hidden md:block">
                  <UserMenu />
                </div>
                <MobileUserAvatar />
              </Show>

              <button
                className="md:hidden p-2 rounded-md hover:bg-accent"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t bg-background px-4 py-4 flex flex-col gap-3 text-sm font-medium">
              <Link
                href="/courts"
                className="transition-colors hover:text-primary flex items-center gap-1.5"
                onClick={() => setMobileMenuOpen(false)}
              >
                <TennisCourtIcon className="w-3.5 h-3.5" />
                {t("nav.findCourts")}
              </Link>
              <Link href="/coaches" className="transition-colors hover:text-primary flex items-center gap-1.5" onClick={() => setMobileMenuOpen(false)}>
                <Dumbbell className="w-3.5 h-3.5" />
                Treneriai
              </Link>
              <Link href="/tournaments" className="transition-colors hover:text-primary flex items-center gap-1.5" onClick={() => setMobileMenuOpen(false)}>
                <Trophy className="w-3.5 h-3.5" />
                Turnyrai
              </Link>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/sign-up"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.register")}
                </Link>
              </Show>
            </div>
          )}
        </header>

        <main className="flex-1 w-full">{children}</main>

        <footer className="border-t py-6 md:py-0 bg-muted/30 mt-auto">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 text-sm text-muted-foreground">
            <p>{t("footer.tagline")}</p>
            <div className="flex gap-4">
              <Link href="/courts" className="hover:text-primary transition-colors">
                {t("footer.courts")}
              </Link>
              <Link href="/bookings" className="hover:text-primary transition-colors">
                {t("footer.bookings")}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
