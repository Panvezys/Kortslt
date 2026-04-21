import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth } from "@clerk/react";
import { enUS, ruRU } from "@clerk/localizations";
import { ltLT } from "@/lib/lt-localization";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import { useRole } from "@/lib/useRole";
import { FavoritesProvider } from "@/lib/FavoritesContext";

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
    </>
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
