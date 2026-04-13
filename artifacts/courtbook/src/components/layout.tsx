import { Link, useLocation } from "wouter";
import { ThemeProvider } from "./theme-provider";
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
import { LogOut, User, CalendarDays, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

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
              {user?.fullName || "Account"}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/bookings")}>
          <CalendarDays className="mr-2 h-4 w-4" />
          My Bookings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation("/owner")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Owner Dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground">
                CB
              </div>
              CourtBook
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/courts" className="transition-colors hover:text-primary">
                Find Courts
              </Link>
              <Show when="signed-in">
                <Link href="/bookings" className="transition-colors hover:text-primary">
                  My Bookings
                </Link>
                <Link href="/owner" className="transition-colors hover:text-primary">
                  Owner Dashboard
                </Link>
              </Show>
            </nav>

            <div className="flex items-center gap-3">
              <Show when="signed-out">
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/sign-up">Register</Link>
                  </Button>
                </div>
              </Show>
              <Show when="signed-in">
                <div className="hidden md:block">
                  <UserMenu />
                </div>
              </Show>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-md hover:bg-accent"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t bg-background px-4 py-4 flex flex-col gap-3 text-sm font-medium">
              <Link
                href="/courts"
                className="transition-colors hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Find Courts
              </Link>
              <Show when="signed-in">
                <Link
                  href="/bookings"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Bookings
                </Link>
                <Link
                  href="/owner"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Owner Dashboard
                </Link>
                <UserMenu />
              </Show>
              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="transition-colors hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Register
                </Link>
              </Show>
            </div>
          )}
        </header>

        <main className="flex-1 w-full">{children}</main>

        <footer className="border-t py-6 md:py-0 bg-muted/30 mt-auto">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 text-sm text-muted-foreground">
            <p>Built for athletes. Find your court anywhere.</p>
            <div className="flex gap-4">
              <Link href="/courts" className="hover:text-primary transition-colors">
                Courts
              </Link>
              <Link href="/bookings" className="hover:text-primary transition-colors">
                Bookings
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
