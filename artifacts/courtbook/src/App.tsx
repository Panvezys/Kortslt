import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { enUS, ruRU } from "@clerk/localizations";
import { ltLT } from "@/lib/lt-localization";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useRole } from "@/lib/useRole";
import { FavoritesProvider } from "@/lib/FavoritesContext";

const Home = lazy(() => import("@/pages/home"));
const Courts = lazy(() => import("@/pages/courts"));
const CourtDetail = lazy(() => import("@/pages/court-detail"));
const Bookings = lazy(() => import("@/pages/bookings"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const PaymentCancel = lazy(() => import("@/pages/payment-cancel"));
const BookingConfirmed = lazy(() => import("@/pages/booking-confirmed"));
const OwnerFacilities = lazy(() => import("@/pages/owner-facilities"));
const OwnerFacilityDetail = lazy(() => import("@/pages/owner-facility-detail"));
const Profile = lazy(() => import("@/pages/profile"));
const AdminDashboard = lazy(() => import("@/pages/admin"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const CoachPage = lazy(() => import("@/pages/coach"));
const CoachesPage = lazy(() => import("@/pages/coaches"));
const TrainersPage = lazy(() => import("@/pages/trainers"));
const TrainerDetail = lazy(() => import("@/pages/trainer-detail"));
const TournamentsPage = lazy(() => import("@/pages/tournaments"));
const TournamentDetail = lazy(() => import("@/pages/tournament-detail"));
const ListYourCourt = lazy(() => import("@/pages/list-your-court"));
const OwnerOnboard = lazy(() => import("@/pages/owner-onboard"));
const GamesPage = lazy(() => import("@/pages/games"));
const GameDetailPage = lazy(() => import("@/pages/game-detail"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const FAQPage = lazy(() => import("@/pages/faq"));
const OwnersInfoPage = lazy(() => import("@/pages/owners-info"));
const OwnerDashboard = lazy(() => import("@/pages/owner/dashboard"));
const AdminApprovalsPage = lazy(() => import("@/pages/admin/approvals"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ContactPage = lazy(() => import("@/pages/contact"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const BecomeCoachPage = lazy(() => import("@/pages/become-coach"));
const BecomeOwnerPage = lazy(() => import("@/pages/become-owner"));
const FavoritesPage = lazy(() => import("@/pages/favorites"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// NOTE: in dev this env var will be empty, in prod it will be automatically set
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Home />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function BookingsRoute() {
  return (
    <>
      <Show when="signed-in">
        <Bookings />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { isOwner, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isOwner) return <Redirect to="/owner/onboard" />;
  return <>{children}</>;
}

function OwnerFacilitiesRoute() {
  return <OwnerRoute><OwnerFacilities /></OwnerRoute>;
}

function OwnerFacilityDetailRoute() {
  return <OwnerRoute><OwnerFacilityDetail /></OwnerRoute>;
}

function ProfileRoute() {
  return (
    <>
      <Show when="signed-in">
        <Profile />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function FavoritesRoute() {
  return (
    <>
      <Show when="signed-in">
        <FavoritesPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function AdminRoute() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <Redirect to="/" />;
  return <AdminDashboard />;
}

function AdminApprovalsRoute() {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <Redirect to="/" />;
  return <AdminApprovalsPage />;
}

function CoachRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { isCoach, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isCoach) return <Redirect to="/become-coach" />;
  return <>{children}</>;
}

function WelcomeRoute() {
  return (
    <>
      <Show when="signed-in"><WelcomePage /></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

// Invalidates React Query cache when the signed-in user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function PrefetchPages() {
  useEffect(() => {
    const t = setTimeout(() => {
      import("@/pages/courts");
      import("@/pages/court-detail");
      import("@/pages/coaches");
      import("@/pages/trainers");
      import("@/pages/tournaments");
      import("@/pages/games");
      import("@/pages/profile");
      import("@/pages/bookings");
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

function PageLoadingFallback() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur h-16" />
      {/* Spinner */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ScrollToTop />
      <PrefetchPages />
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/courts" component={Courts} />
        <Route path="/courts/:id" component={CourtDetail} />
        <Route path="/bookings" component={BookingsRoute} />
        <Route path="/owner/dashboard" component={OwnerDashboard} />
        <Route path="/owner/facility/:id" component={OwnerFacilityDetailRoute} />
        <Route path="/owner" component={OwnerFacilitiesRoute} />
        <Route path="/profile" component={ProfileRoute} />
        <Route path="/admin/approvals" component={AdminApprovalsRoute} />
        <Route path="/admin" component={AdminRoute} />
        <Route path="/payment-success" component={PaymentSuccess} />
        <Route path="/booking-confirmed" component={BookingConfirmed} />
        <Route path="/payment-cancel" component={PaymentCancel} />
        <Route path="/coaches" component={CoachesPage} />
        <Route path="/trainers" component={TrainersPage} />
        <Route path="/trainers/:id" component={TrainerDetail} />
        <Route path="/tournaments" component={TournamentsPage} />
        <Route path="/tournaments/:id" component={TournamentDetail} />
        <Route path="/games" component={GamesPage} />
        <Route path="/games/:id" component={GameDetailPage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/list-your-court" component={ListYourCourt} />
        <Route path="/owner/onboard" component={OwnerOnboard} />
        <Route path="/faq" component={FAQPage} />
        <Route path="/owners" component={OwnersInfoPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/coach/me">
          {() => <CoachRoute><CoachPage /></CoachRoute>}
        </Route>
        <Route path="/coach/:id" component={CoachPage} />
        <Route path="/welcome" component={WelcomeRoute} />
        <Route path="/become-coach" component={BecomeCoachPage} />
        <Route path="/become-owner" component={BecomeOwnerPage} />
        <Route path="/favorites" component={FavoritesRoute} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

const clerkLocales = { lt: ltLT, en: enUS, ru: ruRU } as const;

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { locale } = useI18n();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      localization={clerkLocales[locale]}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <FavoritesProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </FavoritesProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <I18nProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </I18nProvider>
  );
}

export default App;
