import { Link } from "wouter";
import { ThemeProvider } from "./theme-provider";

export function Layout({ children }: { children: React.ReactNode }) {
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
              <Link href="/courts" className="transition-colors hover:text-primary">Find Courts</Link>
              <Link href="/bookings" className="transition-colors hover:text-primary">My Bookings</Link>
              <Link href="/owner" className="transition-colors hover:text-primary">Owner Dashboard</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full">
          {children}
        </main>

        <footer className="border-t py-6 md:py-0 bg-muted/30 mt-auto">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 text-sm text-muted-foreground">
            <p>Built for athletes. Find your court anywhere.</p>
            <div className="flex gap-4">
              <Link href="/courts" className="hover:text-primary transition-colors">Courts</Link>
              <Link href="/bookings" className="hover:text-primary transition-colors">Bookings</Link>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
