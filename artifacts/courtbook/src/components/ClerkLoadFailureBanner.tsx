import { useEffect, useState } from "react";
import { useSafeAuth } from "@/lib/safeAuth";

const isDevClerk =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.startsWith(
    "pk_test_",
  ) ?? false;

export function ClerkLoadFailureBanner() {
  const { isLoaded, isSignedIn } = useSafeAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isDevClerk) return;
    if (isLoaded && isSignedIn) {
      setShowBanner(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (!isSignedIn) setShowBanner(true);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [isLoaded, isSignedIn]);

  if (!isDevClerk || !showBanner || dismissed) return null;

  return (
    <div data-testid="banner-clerk-load-failure" />
  );
}
