import { Layout } from "@/components/layout";
import { Trophy } from "lucide-react";

export default function TournamentsPage() {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="relative h-52 sm:h-64 md:h-72 overflow-hidden">
          <img
            src="/courts/court_17_zalgiris.png"
            alt="Turnyrai"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/75" />
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 pb-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/20 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Trophy className="w-4.5 h-4.5 text-yellow-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow">Turnyrai</h1>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
