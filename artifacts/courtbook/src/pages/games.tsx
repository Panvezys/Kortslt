import { Layout } from "@/components/layout";
import { Trophy } from "lucide-react";

export default function GamesPage() {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="relative h-52 sm:h-64 md:h-72 overflow-hidden">
          <img
            src="/coaches/coach_banner_2_small.png"
            alt="Partneriai"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(19,45,76,0.4), rgba(19,45,76,0.3), rgba(19,45,76,0.85))" }} />
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 pb-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#C5E041]/20 backdrop-blur-sm border border-[#C5E041]/30 flex items-center justify-center">
                <Trophy className="w-4.5 h-4.5 text-[#C5E041]" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">Žaidimai</h1>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
