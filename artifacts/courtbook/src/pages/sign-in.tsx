import { SignIn, useSignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { Chrome, X } from "lucide-react";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HERO_IMAGE = "courts/court_2_bernardinu.webp";

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

        {/* Logo */}
        <div className="relative z-10 p-10">
          <button onClick={() => setLocation("/")} className="text-white font-extrabold text-2xl tracking-tight hover:opacity-80 transition-opacity">
            korts.lt
          </button>
        </div>

        {/* Centre copy */}
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

        {/* Sport pills */}
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
        {/* Close button */}
        <button
          onClick={() => setLocation("/")}
          className="absolute top-5 right-5 z-10 p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mobile logo */}
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
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!isLoaded || isGoogleLoading}
              className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Chrome className="h-4 w-4" />
              {isGoogleLoading ? "Jungiama..." : "Sign in with Google"}
            </button>

            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
              appearance={{
                layout: {
                  showOptionalFields: false,
                  shimmer: false,
                  socialButtonsPlacement: "top",
                  socialButtonsVariant: "iconButton",
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
                  socialButtonsBlockButton:
                    "border border-border bg-muted hover:bg-muted/80 text-foreground rounded-xl h-11 font-medium transition-colors",
                  socialButtonsBlockButtonText: "font-medium",
                  dividerLine: "bg-border",
                  dividerText: "text-muted-foreground text-xs",
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
