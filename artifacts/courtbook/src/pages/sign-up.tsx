import { SignUp } from "@clerk/react";
import { useLocation } from "wouter";
import { X } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const HERO_IMAGE = "courts/padel/padel_court_indoor_1.jpg";

export default function SignUpPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex">
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
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <SignUp />
      </div>
      <button onClick={() => setLocation("/")} className="absolute top-4 right-4 z-20">
        <X />
      </button>
    </div>
  );
}
