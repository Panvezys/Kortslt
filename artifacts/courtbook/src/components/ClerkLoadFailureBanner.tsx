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
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: 560,
        width: "calc(100% - 24px)",
        padding: "12px 16px",
        background: "rgba(19, 45, 76, 0.96)",
        color: "#fff",
        borderRadius: 12,
        border: "1px solid #C5E041",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        fontSize: 13,
        lineHeight: 1.5,
        backdropFilter: "blur(8px)",
      }}
      data-testid="banner-clerk-load-failure"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#C5E041" }}>
            Sign-in unavailable in this browser
          </div>
          <div>
            Clerk (the login service) couldn't start. In development this is
            usually because <strong>third-party cookies are blocked</strong>{" "}
            (common in Chrome incognito). Fixes:
          </div>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>Allow third-party cookies for this site, or</li>
            <li>Use a regular (non-incognito) browser window, or</li>
            <li>
              Test on the deployed app:{" "}
              <a
                href="https://korts.lt"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#C5E041", textDecoration: "underline" }}
              >
                korts.lt
              </a>
            </li>
          </ul>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          data-testid="button-dismiss-clerk-banner"
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
