import { useEffect, useRef, lazy, Suspense } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useClerk, useAuth } from "@clerk/react";
import { SafeShow, SafeAuthBridge, useSafeAuth } from "@/lib/safeAuth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { ltLT } from "@/lib/lt-localization";
import { enUS, ruRU } from "@clerk/localizations";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import { useRole } from "@/lib/useRole";
import { FavoritesProvider } from "@/lib/FavoritesContext";
import { ClerkLoadFailureBanner } from "@/components/ClerkLoadFailureBanner";

import Home from "@/pages/home";
import Courts from "@/pages/courts";
import FacilityPage from "@/pages/facility";
import CourtDetail from "@/pages/court-detail";
import Bookings from "@/pages/bookings";
import BookingDetail from "@/pages/booking-detail";
import GuestBooking from "@/pages/guest-booking";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import BookingConfirmed from "@/pages/booking-confirmed";
import OwnerFacilities from "@/pages/owner-facilities";
import OwnerFacilityDetail from "@/pages/owner-facility-detail";
import Profile from "@/pages/profile";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import CoachPage from "@/pages/coach";
import CoachesPage from "@/pages/coaches";
import TournamentsPage from "@/pages/tournaments";
import TournamentDetail from "@/pages/tournament-detail";
import ListYourCourt from "@/pages/list-your-court";
import GameDetailPage from "@/pages/game-detail";
import GamesGuidePage from "@/pages/games-guide";
import MessagesPage from "@/pages/messages";
import FAQPage from "@/pages/faq";
import OwnersInfoPage from "@/pages/owners-info";
import PrivacyPage from "@/pages/privacy";
import DeleteAccountPage from "@/pages/delete-account";
import TermsPage from "@/pages/terms";
import ContactPage from "@/pages/contact";
import WelcomePage from "@/pages/welcome";
import BecomeCoachPage from "@/pages/become-coach";
import BecomeOwnerPage from "@/pages/become-owner";
import FavoritesPage from "@/pages/favorites";
import SettingsPage from "@/pages/settings";
import RanksPage from "@/pages/ranks";
import JoinBookingPage from "@/pages/join-booking";
import OpenMatchesPage from "@/pages/open-matches";
import MyMatchesPage from "@/pages/my-matches";

const AdminDashboard = lazy(() => import("@/pages/admin"));
const AdminApprovalsPage = lazy(() => import("@/pages/admin/approvals"));
const OwnerDashboard = lazy(() => import("@/pages/owner/dashboard"));
const OwnerSettings = lazy(() => import("@/pages/owner/settings"));
const OwnerPayments = lazy(() => import("@/pages/owner/payments"));
const OwnerCoaches = lazy(() => import("@/pages/owner/coaches"));
const OwnerCourtCreate = lazy(() => import("@/pages/owner/court-create"));
const OwnerCourtCoaches = lazy(() => import("@/pages/owner/court-coaches"));
const OwnerCourtMemberships = lazy(() => import("@/pages/owner/court-memberships"));
const OwnerCourtDashboard = lazy(() => import("@/pages/owner/court-dashboard"));
const OwnerTournaments = lazy(() => import("@/pages/owner/tournaments"));
const OwnerTournamentCreate = lazy(() => import("@/pages/owner/tournament-create"));
const OwnerFacilityMessages = lazy(() => import("@/pages/owner-facility-messages"));

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const isLiveClerk = clerkPubKey?.startsWith("pk_live_") ?? false;
const CLERK_DOMAIN = isLiveClerk ? "clerk.korts.lt" : undefined;

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
  const { isLoaded: authLoaded, isSignedIn } = useSafeAuth();
  const { isOwner, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isOwner) return <Redirect to="/become-owner" />;
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

  useEffect(() => {
    if (authLoaded && isSignedIn) refresh();
  }, [authLoaded, isSignedIn, refresh]);

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <Redirect to="/" />;
  return (
    <Suspense fallback={null}>
      <AdminDashboard />
    </Suspense>
  );
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
  return (
    <Suspense fallback={null}>
      <AdminApprovalsPage />
    </Suspense>
  );
}

function CoachRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
  const { isCoach, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isCoach) return <Redirect to="/become-coach" />;
  return <>{children}</>;
}

/** Allows owners (incl. admins) and coaches — used for tournament-organizer pages. */
function CreatorRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useSafeAuth();
  const { isOwner, isCoach, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isOwner && !isCoach) return <Redirect to="/tournaments" />;
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
      <Route path="/facilities/:id" component={FacilityPage} />
      <Route path="/bookings/:id" component={BookingDetail} />
      <Route path="/bookings" component={BookingsRoute} />
      <Route path="/guest/booking/:token" component={GuestBooking} />
      <Route path="/owner/dashboard" component={() => <OwnerRoute><Suspense fallback={null}><OwnerDashboard /></Suspense></OwnerRoute>} />
      <Route path="/owner/settings" component={() => <OwnerRoute><Suspense fallback={null}><OwnerSettings /></Suspense></OwnerRoute>} />
      <Route path="/owner/payments" component={() => <OwnerRoute><Suspense fallback={null}><OwnerPayments /></Suspense></OwnerRoute>} />
      <Route path="/owner/coaches" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCoaches /></Suspense></OwnerRoute>} />
      <Route path="/owner/tournaments" component={() => <OwnerRoute><Suspense fallback={null}><OwnerTournaments /></Suspense></OwnerRoute>} />
      <Route path="/owner/tournaments/new" component={() => <CreatorRoute><Suspense fallback={null}><OwnerTournamentCreate /></Suspense></CreatorRoute>} />
      <Route path="/owner/facility/:id/court/new" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCreate /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:id/court/:courtId/edit" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCreate /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId/coaches" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCoaches /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId/memberships" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtMemberships /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtDashboard /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:id/messages" component={() => <OwnerRoute><Suspense fallback={null}><OwnerFacilityMessages /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:id" component={OwnerFacilityDetailRoute} />
      <Route path="/owner" component={OwnerFacilitiesRoute} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/admin/approvals" component={AdminApprovalsRoute} />
      <Route path="/admin/roles">
        <Redirect to="/admin?tab=users" />
      </Route>
      <Route path="/admin" component={AdminRoute} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/booking-confirmed" component={BookingConfirmed} />
      <Route path="/payment-cancel" component={PaymentCancel} />
      <Route path="/coaches" component={CoachesPage} />
      <Route path="/tournaments" component={TournamentsPage} />
      <Route path="/tournaments/:id" component={TournamentDetail} />
      <Route path="/games/guide" component={GamesGuidePage} />
      <Route path="/games/:id">
        {(params) => <Redirect to={`/matches/${params.id}`} />}
      </Route>
      <Route path="/matches/mine" component={MyMatchesPage} />
      <Route path="/matches/:id" component={GameDetailPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/list-your-court" component={ListYourCourt} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/owners" component={OwnersInfoPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/ranks" component={RanksPage} />
      <Route path="/join/:token" component={JoinBookingPage} />
      <Route path="/matches" component={OpenMatchesPage} />
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

function ClerkAuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

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
  const { locale } = useI18n();
  const clerkLocalization = locale === "lt" ? ltLT : locale === "ru" ? ruRU : enUS;

  if (!clerkPubKey) {
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
      localization={clerkLocalization}
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
