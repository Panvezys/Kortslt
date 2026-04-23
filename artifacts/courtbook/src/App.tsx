import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk, useAuth } from "@clerk/react";
import { SafeShow, SafeAuthBridge, useSafeAuth } from "@/lib/safeAuth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import { useRole } from "@/lib/useRole";
import { FavoritesProvider } from "@/lib/FavoritesContext";
import { ClerkLoadFailureBanner } from "@/components/ClerkLoadFailureBanner";

import Home from "@/pages/home";
import Courts from "@/pages/courts";
import CourtDetail from "@/pages/court-detail";
import Bookings from "@/pages/bookings";
import BookingDetail from "@/pages/booking-detail";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import BookingConfirmed from "@/pages/booking-confirmed";
import OwnerFacilities from "@/pages/owner-facilities";
import OwnerFacilityDetail from "@/pages/owner-facility-detail";
import Profile from "@/pages/profile";
import AdminDashboard from "@/pages/admin";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import CoachPage from "@/pages/coach";
import CoachesPage from "@/pages/coaches";
import TrainersPage from "@/pages/trainers";
import TrainerDetail from "@/pages/trainer-detail";
import TournamentsPage from "@/pages/tournaments";
import TournamentDetail from "@/pages/tournament-detail";
import ListYourCourt from "@/pages/list-your-court";
import OwnerOnboard from "@/pages/owner-onboard";
import GamesPage from "@/pages/games";
import GameDetailPage from "@/pages/game-detail";
import GamesGuidePage from "@/pages/games-guide";
import MessagesPage from "@/pages/messages";
import FAQPage from "@/pages/faq";
import OwnersInfoPage from "@/pages/owners-info";
import OwnerDashboard from "@/pages/owner/dashboard";
import AdminApprovalsPage from "@/pages/admin/approvals";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import ContactPage from "@/pages/contact";
import WelcomePage from "@/pages/welcome";
import BecomeCoachPage from "@/pages/become-coach";
import BecomeOwnerPage from "@/pages/become-owner";
import FavoritesPage from "@/pages/favorites";
import SettingsPage from "@/pages/settings";
import RanksPage from "@/pages/ranks";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
// Only set the production custom domain when using a live key. With dev keys
// (pk_test_…) Clerk must use its default *.clerk.accounts.dev host.
const isLiveClerk = clerkPubKey?.startsWith("pk_live_") ?? false;
const CLERK_DOMAIN = isLiveClerk ? "clerk.korts.lt" : undefined;

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function HomeRoute() {
  return <Home />;
}

function BookingsRoute() {
  return (
    <>
      <SafeShow when="signed-in"><Bookings /></SafeShow>
      <SafeShow when="signed-out"><Redirect to="/sign-in" /></SafeShow>
    </>
  );
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
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
      <SafeShow when="signed-in"><Profile /></SafeShow>
      <SafeShow when="signed-out"><Redirect to="/sign-in" /></SafeShow>
    </>
  );
}

function FavoritesRoute() {
  return (
    <>
      <SafeShow when="signed-in"><FavoritesPage /></SafeShow>
      <SafeShow when="signed-out"><Redirect to="/sign-in" /></SafeShow>
    </>
  );
}

function AdminRoute() {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
  const { isAdmin, isLoading: roleLoading, refresh } = useRole();

  // Force a fresh role check on mount: handles the case where the user was
  // promoted to admin server-side but the cached client state is stale.
  useEffect(() => {
    if (authLoaded && isSignedIn) refresh();
  }, [authLoaded, isSignedIn, refresh]);

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <Redirect to="/" />;
  return <AdminDashboard />;
}

function AdminApprovalsRoute() {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
  const { isAdmin, isLoading: roleLoading, refresh } = useRole();

  useEffect(() => {
    if (authLoaded && isSignedIn) refresh();
  }, [authLoaded, isSignedIn, refresh]);

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <Redirect to="/" />;
  return <AdminApprovalsPage />;
}

function CoachRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
  const { isCoach, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isCoach) return <Redirect to="/become-coach" />;
  return <>{children}</>;
}

function WelcomeRoute() {
  return (
    <>
      <SafeShow when="signed-in"><WelcomePage /></SafeShow>
      <SafeShow when="signed-out"><Redirect to="/sign-in" /></SafeShow>
    </>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
    <ScrollToTop />
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/courts" component={Courts} />
      <Route path="/courts/:id" component={CourtDetail} />
      <Route path="/bookings/:id" component={BookingDetail} />
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
      <Route path="/games/guide" component={GamesGuidePage} />
      <Route path="/games/:id" component={GameDetailPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/list-your-court" component={ListYourCourt} />
      <Route path="/owner/onboard" component={OwnerOnboard} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/owners" component={OwnersInfoPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/ranks" component={RanksPage} />
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
    </>
  );
}

// Registers Clerk's getToken() with customFetch so every API call automatically
// includes "Authorization: Bearer <token>". This is the reliable auth path in
// production where the __session cookie may not be sent (e.g. SameSite restrictions
// or cross-subdomain setups). The getter is cleared on unmount (sign-out/refresh).
function ClerkAuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

// Invalidates the QueryClient cache when the signed-in user changes
// so per-user data (role, bookings, favorites) doesn't leak across sessions.
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    // Fallback so the app still renders if the Clerk key isn't injected yet.
    return (
      <QueryClientProvider client={queryClient}>
        <FavoritesProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </FavoritesProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      domain={CLERK_DOMAIN}
      isSatellite={false}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthTokenBridge />
        <ClerkQueryClientCacheInvalidator />
        <SafeAuthBridge>
          <FavoritesProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
              <ClerkLoadFailureBanner />
            </TooltipProvider>
          </FavoritesProvider>
        </SafeAuthBridge>
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
