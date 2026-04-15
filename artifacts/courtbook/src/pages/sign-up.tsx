import { SignUp } from "@clerk/react";
import { useLocation } from "wouter";
import { X } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HERO_IMAGE = "courts/padel/padel_court_indoor_1.jpg";

export default function SignUpPage() {
  const [, setLocation] = useLocation();

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
            Prisijunkite prie<br />
            <span className="text-lime-400">sporto bendruomenės</span><br />
            Lietuvoje.
          </h1>
          <p className="text-white/70 text-base max-w-xs">
            Registruokitės nemokamai ir pradėkite rezervuoti kortus jau šiandien.
          </p>
        </div>

        {/* Benefit pills */}
        <div className="relative z-10 px-10 pb-10 flex flex-col gap-2.5">
          {[
            { icon: "✓", text: "Rezervuokite kortus internetu 24/7" },
            { icon: "✓", text: "Išsaugokite mėgstamiausius kortus" },
            { icon: "✓", text: "Peržiūrėkite visas rezervacijas vienoje vietoje" },
            { icon: "✓", text: "Raskite trenerius pagal sporto šaką" },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-2.5">
              <span className="text-lime-400 font-bold text-lg leading-none">{b.icon}</span>
              <span className="text-white/85 text-sm">{b.text}</span>
            </div>
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
              <h2 className="text-2xl font-bold mb-1">Sukurti paskyrą</h2>
              <p className="text-muted-foreground text-sm">Registracija nemokama ir trunka vos kelias sekundes.</p>
            </div>

            <SignUp
              routing="path"
              path={`${basePath}/sign-up`}
              signInUrl={`${basePath}/sign-in`}
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
              Jau turite paskyrą?{" "}
              <button
                onClick={() => setLocation("/sign-in")}
                className="font-semibold text-lime-600 hover:text-lime-700 transition-colors"
              >
                Prisijungti
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
