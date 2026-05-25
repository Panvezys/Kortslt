import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@clerk/react";

export const SafeAuthContext = createContext<{ isLoaded: boolean; isSignedIn: boolean }>({
  isLoaded: true,
  isSignedIn: false,
});

// Publishes Clerk auth state to SafeAuthContext.
// If Clerk hasn't loaded after 3 seconds (e.g. dev instance on replit.dev),
// treats the user as signed-out so Show/SafeShow components render normally.
export function SafeAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const effectiveLoaded = isLoaded || timedOut;

  return (
    <SafeAuthContext.Provider
      value={{ isLoaded: effectiveLoaded, isSignedIn: effectiveLoaded ? !!isSignedIn : false }}
    >
      {children}
    </SafeAuthContext.Provider>
  );
}

export function useSafeAuth() {
  return useContext(SafeAuthContext);
}

// Drop-in replacement for Clerk's <Show> — works even when Clerk is stuck loading.
export function SafeShow({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useSafeAuth();
  if (!isLoaded) return null;
  if (when === "signed-in" && isSignedIn) return <>{children}</>;
  if (when === "signed-out" && !isSignedIn) return <>{children}</>;
  return null;
}
