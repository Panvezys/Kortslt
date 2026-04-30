import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Flame, ArrowLeft, Info } from "lucide-react";
import { SportIcon, sportColor } from "@/components/sport-icon";

const TIERS = [
  {
    name: "Diamond",
    emoji: "💎",
    elo: "1600+",
    color: "from-cyan-500/20 to-cyan-600/10",
    border: "border-cyan-400/30",
    text: "text-cyan-400",
    desc: "Elitinis žaidėjas. Mažiau nei 5% žaidėjų pasiekia šį rangą.",
    badge: "bg-cyan-500/15 text-cyan-400 border-cyan-400/30",
  },
  {
    name: "Gold",
    emoji: "🥇",
    elo: "1400–1599",
    color: "from-yellow-500/20 to-yellow-600/10",
    border: "border-yellow-400/30",
    text: "text-yellow-500",
    desc: "Patyręs žaidėjas, nuolat gerinantis rezultatus ir dominuojantis savo sporto šakoje.",
    badge: "bg-yellow-500/15 text-yellow-500 border-yellow-400/30",
  },
  {
    name: "Silver",
    emoji: "🥈",
    elo: "1200–1399",
    color: "from-slate-400/20 to-slate-500/10",
    border: "border-slate-300/30",
    text: "text-slate-400",
    desc: "Pradinis taškas visiems žaidėjams (ELO 1200). Solid tarpinis žaidėjas.",
    badge: "bg-slate-400/15 text-slate-400 border-slate-300/30",
  },
  {
    name: "Bronze",
    emoji: "🥉",
    elo: "0–1199",
    color: "from-orange-700/20 to-orange-800/10",
    border: "border-orange-500/30",
    text: "text-orange-600",
    desc: "Pradedantysis arba žaidėjas, kuriam sunkiau sekasi. Nusimink – geriau negu nieko!",
    badge: "bg-orange-700/15 text-orange-600 border-orange-500/30",
  },
];

const SPORTS = [
  { key: "tennis", label: "Tenisas" }, { key: "basketball", label: "Krepšinis" },
  { key: "padel", label: "Padelis" }, { key: "football", label: "Futbolas" },
  { key: "badminton", label: "Badmintonas" }, { key: "table_tennis", label: "Stalo tenisas" },
  { key: "squash", label: "Skvošas" }, { key: "golf", label: "Golfas" },
  { key: "bowling", label: "Boulingas" }, { key: "snooker", label: "Snukeris" },
];

const ELO_EXAMPLES = [
  { match: "1200 vs 1200", aWin: "+16", bWin: "+16" },
  { match: "1400 vs 1200", aWin: "+8", bWin: "+24" },
  { match: "1600 vs 1200", aWin: "+4", bWin: "+28" },
];

export default function RanksPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/games"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rango sistema</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Supraskite, kaip veikia ELO ir rangų ženklai</p>
          </div>
        </div>

        {/* How ELO works */}
        <section className="mb-10">
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Kaip veikia ELO?</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ELO reitingas matuoja jūsų žaidimo lygį kiekvienoje sporto šakoje atskirai. 
              Pradedantysis ELO: <strong className="text-foreground">1200</strong>. 
              Koeficientas K = <strong className="text-foreground">32</strong> (greitesni pokyčiai).
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Laimėjęs prieš stipresnį varžovą — gausite daugiau taškų. Pralaimėjęs silpnesniam — 
              prarasite daugiau. Tik <strong className="text-foreground">reitinginiai</strong> žaidimai 
              (🗡️ Rated) keičia ELO.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-muted-foreground font-medium">Žaidimas</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">A laimi → A gauna</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">B laimi → B gauna</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ELO_EXAMPLES.map(ex => (
                    <tr key={ex.match}>
                      <td className="py-2 font-mono text-xs">{ex.match}</td>
                      <td className="py-2 text-center text-green-500 font-semibold">{ex.aWin}</td>
                      <td className="py-2 text-center text-green-500 font-semibold">{ex.bWin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tiers */}
        <section className="mb-10">
          <h2 className="font-bold text-xl mb-4">Rangai</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {TIERS.map(tier => (
              <div key={tier.name} className={`rounded-2xl border ${tier.border} bg-gradient-to-br ${tier.color} p-5 space-y-2`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tier.emoji}</span>
                  <div>
                    <div className={`font-bold text-lg ${tier.text}`}>{tier.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">ELO {tier.elo}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tier.desc}</p>
                <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${tier.badge}`}>
                  {tier.emoji} {tier.name} žaidėjas
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sport-specific icons */}
        <section className="mb-10">
          <h2 className="font-bold text-xl mb-4">Sporto šakų ženklai</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Kiekviena sporto šaka turi savo ikoną. Kiekvienam žaidėjui rodoma sporto ikona + rango spalva.
          </p>
          <div className="rounded-2xl border bg-card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SPORTS.map(s => (
                <div key={s.key} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <SportIcon sport={s.key} size={20} strokeWidth={1.75} style={{ color: sportColor[s.key] ?? "#84cc16" }} />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* On Fire */}
        <section className="mb-10">
          <div className="rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/10 to-red-500/5 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              <h2 className="font-bold text-lg">„On Fire" serija</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Laimėkite <strong className="text-foreground">3 ar daugiau</strong> reitinginių žaidimų iš eilės — 
              ir jūsų profilį puoš liepsnos animacija 🔥. Tai rodo, kad šiuo metu esate fantastinėje formoje!
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[1,2,3,4,5].map(i => (
                <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${i <= 3 ? "bg-green-500/15 text-green-600 border-green-400/30" : "bg-orange-500/15 text-orange-500 border-orange-400/30"}`}>
                  {i <= 3 ? "✓ W" : <><Flame className="w-3 h-3" />W</>}
                </span>
              ))}
              <span className="text-xs text-muted-foreground ml-1">= 5 iš eilės laimėta 🔥🔥</span>
            </div>
          </div>
        </section>

        {/* Team games */}
        <section>
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <h2 className="font-bold text-lg">Komandų žaidimai</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Komandiniuose žaidimuose naudojamas <strong className="text-foreground">vidutinis</strong> komandos ELO. 
              Visi komandos nariai gauna vienodą ELO pokytį.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
