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
import { LogOut, CalendarDays, LayoutDashboard, Menu, X, Globe, Sun, Moon, UserCircle, ShieldCheck, Trophy, Dumbbell, Heart, Mail, Phone, MapPin } from "lucide-react";

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
      className="flex items-center gap-2 font-bold text-xl tracking-tight shrink-0"
    >
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
                <div className="md:hidden">
                  <Button size="sm" className="h-8 text-xs px-3" asChild>
                    <Link href="/sign-in">{t("nav.signIn")}</Link>
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
            </div>
          </div>

          {/* Mobile always-visible nav row */}
          <nav className="md:hidden border-t bg-background/95 flex items-center justify-around px-2 py-1.5 text-xs font-medium">
            <Link href="/courts" className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-accent hover:text-primary transition-colors">
              <TennisCourtIcon className="w-4 h-4" />
              <span>{t("nav.findCourts")}</span>
            </Link>
            <Link href="/coaches" className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-accent hover:text-primary transition-colors">
              <Dumbbell className="w-4 h-4" />
              <span>Treneriai</span>
            </Link>
            <Link href="/tournaments" className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-accent hover:text-primary transition-colors">
              <Trophy className="w-4 h-4" />
              <span>Turnyrai</span>
            </Link>
          </nav>
        </header>

        <main className="flex-1 w-full">{children}</main>

        <footer className="border-t bg-muted/20 mt-auto">
          {/* Main footer grid */}
          <div className="container mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Column 1 — Company */}
            <div className="flex flex-col gap-4">
              <Link href="/" className="font-extrabold text-xl tracking-tight text-foreground">
                korts.lt
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Lietuva pirmaujanti sporto kortų rezervacijos platforma. Raskite, palyginkite ir užsisakykite kortą vos per kelias sekundes.
              </p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-1">
                <a href="mailto:info@korts.lt" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  info@korts.lt
                </a>
                <a href="tel:+37052314567" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  +370 5 231 4567
                </a>
                <span className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Gedimino pr. 45-7, Vilnius LT-01504
                </span>
              </div>

              {/* Social links */}
              <div className="flex items-center gap-3 mt-1">
                <a href="https://instagram.com/korts.lt" target="_blank" rel="noreferrer" aria-label="Instagram"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                </a>
                <a href="https://facebook.com/korts.lt" target="_blank" rel="noreferrer" aria-label="Facebook"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
                <a href="https://t.me/kortslt" target="_blank" rel="noreferrer" aria-label="Telegram"
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M21.95 5.005l-3.306 15.617c-.25 1.118-.9 1.397-1.826.869l-5-3.683-2.415 2.321c-.267.267-.489.489-.999.489l.356-5.045 9.197-8.304c.4-.355-.087-.551-.619-.196L6.11 13.92l-4.92-1.541c-1.07-.333-1.087-1.07.222-1.583l19.16-7.391c.888-.335 1.667.216 1.378 1.6z"/></svg>
                </a>
              </div>

              {/* App store badges */}
              <div className="flex flex-col gap-2 mt-1">
                <span title="Netrukus Google Play parduotuvėje"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 cursor-not-allowed opacity-55 select-none w-fit text-xs">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor"><path d="M3.18 23.76c.3.17.65.2.97.08L14.84 12 3.18.16a1.1 1.1 0 0 0-.97.08C1.86.57 1.5 1.04 1.5 1.56v20.88c0 .52.36.99.68 1.32zM16.5 13.7l2.6-1.5-2.6-1.5-2.18 1.26 2.18 1.24zM4.02 22.5 13.7 12 4.02 1.5l-.34-.34v21.68l.34-.34zM17.72 7.16l-13.7-7.9 10.5 10.5 3.2-2.6zM4.02 24.84l13.7-7.9-3.2-2.6-10.5 10.5z"/></svg>
                  <span className="font-medium text-foreground">Google Play</span>
                  <span className="text-muted-foreground">· Netrukus</span>
                </span>
                <span title="Netrukus App Store parduotuvėje"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 cursor-not-allowed opacity-55 select-none w-fit text-xs">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <span className="font-medium text-foreground">App Store</span>
                  <span className="text-muted-foreground">· Netrukus</span>
                </span>
              </div>
            </div>

            {/* Column 2 — Platform */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Platforma</h4>
              <nav className="flex flex-col gap-2 text-sm">
                {[
                  { href: "/courts", label: "Rasti kortą" },
                  { href: "/coaches", label: "Treneriai" },
                  { href: "/tournaments", label: "Turnyrai" },
                  { href: "/bookings", label: "Mano rezervacijos" },
                  { href: "/profile", label: "Profilis" },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors w-fit">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Column 3 — Sports */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sporto šakos</h4>
              <nav className="flex flex-col gap-2 text-sm">
                {[
                  { type: "tennis", label: "Tenisas" },
                  { type: "basketball", label: "Krepšinis" },
                  { type: "padel", label: "Padelis" },
                  { type: "football", label: "Futbolas" },
                  { type: "badminton", label: "Badmintonas" },
                  { type: "squash", label: "Skvoše" },
                ].map(s => (
                  <Link key={s.type} href={`/courts?type=${s.type}`} className="text-muted-foreground hover:text-foreground transition-colors w-fit">
                    {s.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Column 4 — Support */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pagalba</h4>
              <nav className="flex flex-col gap-2 text-sm">
                {[
                  { href: "#", label: "D.U.K." },
                  { href: "#", label: "Kortų savininkams" },
                  { href: "#", label: "Privatumo politika" },
                  { href: "#", label: "Naudojimo taisyklės" },
                  { href: "#", label: "Kontaktai" },
                ].map(l => (
                  <a key={l.label} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors w-fit">
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t">
            <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} UAB Korts Digital. Visos teisės saugomos.</p>
              <p className="text-center sm:text-right">
                Įm. kodas 306 214 857 · PVM LT100012345678 · Lietuva
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
