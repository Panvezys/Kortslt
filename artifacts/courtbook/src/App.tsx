import { useEffect, useRef, lazy, Suspense, type ComponentType } from "react";
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

// Wraps a lazy-loaded page in its own Suspense so it works directly as a
// Wouter <Route component={X}> without per-route Suspense boilerplate.
function lazyPage(fn: () => Promise<{ default: ComponentType }>) {
  const Comp = lazy(fn);
  function Page() { return <Suspense fallback={null}><Comp /></Suspense>; }
  return Page;
}

// The /courts pages were removed; old links (printed QR codes, sent emails)
// resolve the court's facility+sport and land on the group page instead.
function LegacyCourtRedirect({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/courts/${params.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((c: { facilityId?: number | null; type?: string | null } | null) => {
        if (cancelled) return;
        navigate(
          c?.facilityId != null && c?.type
            ? `/facility/${c.facilityId}?sport=${c.type.replace(/-/g, "_")}`
            : "/explore",
          { replace: true },
        );
      })
      .catch(() => { if (!cancelled) navigate("/explore", { replace: true }); });
    return () => { cancelled = true; };
  }, [params.id, navigate]);
  return null;
}

// Consumer pages — excluded from the initial bundle
const FacilityPage       = lazyPage(() => import("@/pages/facility"));
const Bookings           = lazyPage(() => import("@/pages/bookings"));
const BookingDetail      = lazyPage(() => import("@/pages/booking-detail"));
const GuestBooking       = lazyPage(() => import("@/pages/guest-booking"));
const PaymentSuccess     = lazyPage(() => import("@/pages/payment-success"));
const PaymentCancel      = lazyPage(() => import("@/pages/payment-cancel"));
const BookingConfirmed   = lazyPage(() => import("@/pages/booking-confirmed"));
const OwnerFacilities    = lazyPage(() => import("@/pages/owner-facilities"));
const OwnerFacilityDetail = lazyPage(() => import("@/pages/owner-facility-detail"));
const Profile            = lazyPage(() => import("@/pages/profile"));
const SignInPage         = lazyPage(() => import("@/pages/sign-in"));
const SignUpPage         = lazyPage(() => import("@/pages/sign-up"));
const CoachPage          = lazyPage(() => import("@/pages/coach"));
const CoachesPage        = lazyPage(() => import("@/pages/coaches"));
const TournamentsPage    = lazyPage(() => import("@/pages/tournaments"));
const TournamentDetail   = lazyPage(() => import("@/pages/tournament-detail"));
const ListYourCourt      = lazyPage(() => import("@/pages/list-your-court"));
const GameDetailPage     = lazyPage(() => import("@/pages/game-detail"));
const GamesGuidePage     = lazyPage(() => import("@/pages/games-guide"));
const MessagesPage       = lazyPage(() => import("@/pages/messages"));
const FAQPage            = lazyPage(() => import("@/pages/faq"));
const OwnersInfoPage     = lazyPage(() => import("@/pages/owners-info"));
const PrivacyPage        = lazyPage(() => import("@/pages/privacy"));
const DeleteAccountPage  = lazyPage(() => import("@/pages/delete-account"));
const TermsPage          = lazyPage(() => import("@/pages/terms"));
const ContactPage        = lazyPage(() => import("@/pages/contact"));
const WelcomePage        = lazyPage(() => import("@/pages/welcome"));
const BecomeCoachPage    = lazyPage(() => import("@/pages/become-coach"));
const BecomeOwnerPage    = lazyPage(() => import("@/pages/become-owner"));
const FavoritesPage      = lazyPage(() => import("@/pages/favorites"));
const SettingsPage       = lazyPage(() => import("@/pages/settings"));
const RanksPage          = lazyPage(() => import("@/pages/ranks"));
const JoinBookingPage    = lazyPage(() => import("@/pages/join-booking"));
const OpenMatchesPage    = lazyPage(() => import("@/pages/open-matches"));
const MyMatchesPage      = lazyPage(() => import("@/pages/my-matches"));
const NotificationsPage  = lazyPage(() => import("@/pages/notifications"));
const ExplorePage        = lazyPage(() => import("@/pages/explore"));
const FacilitySportPage  = lazyPage(() => import("@/pages/facility-sport"));

// Owner/admin management pages (keep as raw lazy() — routes already wrap them in Suspense)
const AdminDashboard = lazy(() => import("@/pages/admin"));
const AdminApprovalsPage = lazy(() => import("@/pages/admin/approvals"));
const OwnerDashboard = lazy(() => import("@/pages/owner/dashboard"));
const OwnerSettings = lazy(() => import("@/pages/owner/settings"));
const OwnerPayments = lazy(() => import("@/pages/owner/payments"));
const OwnerReviews  = lazy(() => import("@/pages/owner/reviews"));
const OwnerCoaches = lazy(() => import("@/pages/owner/coaches"));
const OwnerCourtCreate = lazy(() => import("@/pages/owner/court-create"));
const OwnerCourtCoaches = lazy(() => import("@/pages/owner/court-coaches"));
const OwnerCourtMemberships = lazy(() => import("@/pages/owner/court-memberships"));
const OwnerCourtDashboard = lazy(() => import("@/pages/owner/court-dashboard"));
const OwnerCourtPricing = lazy(() => import("@/pages/owner/court-pricing"));
const OwnerTournaments = lazy(() => import("@/pages/owner/tournaments"));
const OwnerTournamentCreate = lazy(() => import("@/pages/owner/tournament-create"));
const OwnerFacilityMessages = lazy(() => import("@/pages/owner-facility-messages"));
const OwnerMessages = lazy(() => import("@/pages/owner-messages"));
const OwnerNotifications = lazy(() => import("@/pages/owner/notifications"));
const OwnerBookingDetail = lazy(() => import("@/pages/owner/booking-detail"));

// Coach dashboard pages — gated behind CoachRoute.
const CoachDashboardPage = lazy(() => import("@/pages/coach/dashboard"));
const CoachProfilePage   = lazy(() => import("@/pages/coach/profile"));
const CoachServicesPage  = lazy(() => import("@/pages/coach/services"));
const CoachSchedulePage  = lazy(() => import("@/pages/coach/schedule"));
const CoachBookingsPage  = lazy(() => import("@/pages/coach/bookings"));
const CoachStudentsPage  = lazy(() => import("@/pages/coach/students"));
const CoachMessagesPage  = lazy(() => import("@/pages/coach/messages"));
const CoachReviewsPage   = lazy(() => import("@/pages/coach/reviews"));
const CoachSettingsPage  = lazy(() => import("@/pages/coach/settings"));

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
  const { isCoach, isAdmin, isLoading: roleLoading } = useRole();

  if (!authLoaded || roleLoading) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  // Admins get "view-as" access so they can inspect any coach's dashboard
  // pages while moderating. Coach-scoped data endpoints still bind to the
  // verified principal server-side; admins viewing their own /coach/me when
  // they have no coach row will see the empty/404 state from /coaches/me.
  if (!isCoach && !isAdmin) return <Redirect to="/become-coach" />;
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
      <Route path="/explore" component={ExplorePage} />
      {/* Legacy /courts links (old QR codes, emails) → group pages */}
      <Route path="/courts/:id">{(params) => <LegacyCourtRedirect params={params as { id: string }} />}</Route>
      <Route path="/courts"><Redirect to="/explore" /></Route>
      <Route path="/facility/:facilityId" component={FacilitySportPage} />
      <Route path="/facilities/:id" component={FacilityPage} />
      <Route path="/bookings/:id" component={BookingDetail} />
      <Route path="/bookings" component={BookingsRoute} />
      <Route path="/guest/booking/:token" component={GuestBooking} />
      <Route path="/owner/dashboard" component={() => <OwnerRoute><Suspense fallback={null}><OwnerDashboard /></Suspense></OwnerRoute>} />
      <Route path="/owner/settings" component={() => <OwnerRoute><Suspense fallback={null}><OwnerSettings /></Suspense></OwnerRoute>} />
      <Route path="/owner/payments" component={() => <OwnerRoute><Suspense fallback={null}><OwnerPayments /></Suspense></OwnerRoute>} />
      <Route path="/owner/reviews" component={() => <OwnerRoute><Suspense fallback={null}><OwnerReviews /></Suspense></OwnerRoute>} />
      <Route path="/owner/coaches" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCoaches /></Suspense></OwnerRoute>} />
      <Route path="/owner/tournaments" component={() => <OwnerRoute><Suspense fallback={null}><OwnerTournaments /></Suspense></OwnerRoute>} />
      <Route path="/owner/tournaments/new" component={() => <CreatorRoute><Suspense fallback={null}><OwnerTournamentCreate /></Suspense></CreatorRoute>} />
      <Route path="/owner/facility/:id/court/new" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCreate /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:id/court/:courtId/edit" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCreate /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId/coaches" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtCoaches /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId/memberships" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtMemberships /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId/pricing" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtPricing /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:facilityId/court/:courtId" component={() => <OwnerRoute><Suspense fallback={null}><OwnerCourtDashboard /></Suspense></OwnerRoute>} />
      <Route path="/owner/messages" component={() => <OwnerRoute><Suspense fallback={null}><OwnerMessages /></Suspense></OwnerRoute>} />
      <Route path="/owner/facility/:id/messages" component={() => <OwnerRoute><Suspense fallback={null}><OwnerFacilityMessages /></Suspense></OwnerRoute>} />
      <Route path="/owner/notifications" component={() => <OwnerRoute><Suspense fallback={null}><OwnerNotifications /></Suspense></OwnerRoute>} />
      <Route path="/owner/bookings/:id" component={() => <OwnerRoute><Suspense fallback={null}><OwnerBookingDetail /></Suspense></OwnerRoute>} />
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
      {/* Coach dashboard routes — these are literal-path matches and must come
          before `/coach/:id` so wouter doesn't treat "dashboard" as a coach id. */}
      <Route path="/coach/dashboard" component={() => <CoachRoute><Suspense fallback={null}><CoachDashboardPage /></Suspense></CoachRoute>} />
      <Route path="/coach/profile"   component={() => <CoachRoute><Suspense fallback={null}><CoachProfilePage /></Suspense></CoachRoute>} />
      <Route path="/coach/services"  component={() => <CoachRoute><Suspense fallback={null}><CoachServicesPage /></Suspense></CoachRoute>} />
      <Route path="/coach/schedule"  component={() => <CoachRoute><Suspense fallback={null}><CoachSchedulePage /></Suspense></CoachRoute>} />
      <Route path="/coach/bookings"  component={() => <CoachRoute><Suspense fallback={null}><CoachBookingsPage /></Suspense></CoachRoute>} />
      <Route path="/coach/students"  component={() => <CoachRoute><Suspense fallback={null}><CoachStudentsPage /></Suspense></CoachRoute>} />
      <Route path="/coach/messages"  component={() => <CoachRoute><Suspense fallback={null}><CoachMessagesPage /></Suspense></CoachRoute>} />
      <Route path="/coach/reviews"   component={() => <CoachRoute><Suspense fallback={null}><CoachReviewsPage /></Suspense></CoachRoute>} />
      <Route path="/coach/settings"  component={() => <CoachRoute><Suspense fallback={null}><CoachSettingsPage /></Suspense></CoachRoute>} />
      <Route path="/coach/me">
        {() => <CoachRoute><CoachPage /></CoachRoute>}
      </Route>
      <Route path="/coach/:id" component={CoachPage} />
      <Route path="/welcome" component={WelcomeRoute} />
      <Route path="/become-coach" component={BecomeCoachPage} />
      <Route path="/become-owner" component={BecomeOwnerPage} />
      <Route path="/favorites" component={FavoritesRoute} />
      <Route path="/notifications" component={NotificationsPage} />
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
