import { SignIn, useSignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HERO_IMAGE = "courts/court_2_bernardinu.webp";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { signIn, isLoaded } = useSignIn();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setIsGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sign-in`,
        redirectUrlComplete: `${window.location.origin}${basePath}/`,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — branded hero panel */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden"
        style={{
          backgroundImage: `url(${basePath}/${HERO_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-lime-900/60" />

        <div className="relative z-10 p-10">
          <button onClick={() => setLocation("/")} className="text-white font-extrabold text-2xl tracking-tight hover:opacity-80 transition-opacity">
            korts.lt
          </button>
        </div>

        <div className="relative z-10 px-10 pb-4">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-3">
            Raskite ir rezervuokite<br />
            <span className="text-lime-400">sportinį kortą</span><br />
            per kelias sekundes.
          </h1>
          <p className="text-white/70 text-base max-w-xs">
            Tenisas, krepšinis, padelis, futbolas ir dar 6 sporto šakos — 24+ miestų visoje Lietuvoje.
          </p>
        </div>

        <div className="relative z-10 px-10 pb-10 flex flex-wrap gap-2">
          {["🎾 Tenisas", "🏀 Krepšinis", "🏸 Badmintonas", "⚽ Futbolas", "🏓 Stalo tenisas", "🏌️ Golfas"].map(s => (
            <span key={s} className="bg-white/10 backdrop-blur border border-white/20 text-white/90 text-xs px-3 py-1.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Right — auth form panel */}
      <div className="flex flex-col flex-1 lg:max-w-[480px] w-full bg-background relative">
        <button
          onClick={() => setLocation("/")}
          className="absolute top-5 right-5 z-10 p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="lg:hidden px-8 pt-8 pb-2">
          <button onClick={() => setLocation("/")} className="font-extrabold text-xl tracking-tight">
            korts.lt
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1">Prisijungti</h2>
              <p className="text-muted-foreground text-sm">Pasveikiname sugrįžus! Prašome prisijungti.</p>
            </div>

            {/* Google OAuth button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!isLoaded || isGoogleLoading}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {isGoogleLoading ? "Jungiama..." : "Prisijungti su Google"}
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">arba</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
              appearance={{
                layout: {
                  showOptionalFields: false,
                  shimmer: false,
                },
                variables: {
                  colorPrimary: "#84cc16",
                  colorBackground: "var(--background)",
                  colorText: "var(--foreground)",
                  colorInputBackground: "var(--muted)",
                  colorInputText: "var(--foreground)",
                  borderRadius: "0.75rem",
                  fontFamily: "inherit",
                  fontSize: "0.875rem",
                },
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-0 p-0 bg-transparent w-full",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  header: "hidden",
                  socialButtons: "hidden",
                  dividerRow: "hidden",
                  formFieldLabel: "text-sm font-medium text-foreground",
                  formFieldInput:
                    "bg-muted border border-border rounded-xl h-11 text-foreground placeholder:text-muted-foreground focus:border-lime-500 focus:ring-lime-500/20",
                  formButtonPrimary:
                    "bg-lime-500 hover:bg-lime-600 text-black font-semibold rounded-xl h-11 transition-colors",
                  footerAction: { display: "none" },
                  footer: { display: "none" },
                  identityPreviewText: "text-foreground",
                  formResendCodeLink: "text-lime-600 hover:text-lime-700",
                  otpCodeFieldInput:
                    "border border-border rounded-xl bg-muted text-foreground",
                  alertText: "text-sm",
                  formFieldSuccessText: "text-lime-600",
                  formFieldErrorText: "text-destructive text-xs",
                },
              }}
            />

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Neturite paskyros?{" "}
              <button
                onClick={() => setLocation("/sign-up")}
                className="font-semibold text-lime-600 hover:text-lime-700 transition-colors"
              >
                Registruotis
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
