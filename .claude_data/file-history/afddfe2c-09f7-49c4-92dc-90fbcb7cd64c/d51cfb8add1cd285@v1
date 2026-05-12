import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Plus,
  UserPlus,
  Swords,
  Trophy,
  CheckCircle2,
  Star,
  Users,
  ClipboardCheck,
  Mail,
  TrendingUp,
  Shield,
  ChevronRight,
  Zap,
  Info,
  BarChart3,
} from "lucide-react";
import { useUser } from "@clerk/react";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const CREATE_STEPS = [
  {
    step: "01",
    icon: Plus,
    title: "Sukurkite žaidimą",
    description:
      "Pasirinkite sporto šaką, lygį, miestą, datą ir žaidėjų skaičių. Nurodykite ar žaidimas bus laisvas (be ELO) ar reitinginis (ELO keičiasi).",
  },
  {
    step: "02",
    icon: Users,
    title: "Pakvieskite žaidėjus",
    description:
      "Siųskite kvietimus el. paštu arba dalinkitės nuoroda. Žaidimas rodomas viešame sąraše — kiti žaidėjai gali prašytis patys.",
  },
  {
    step: "03",
    icon: Swords,
    title: "Žaiskite",
    description:
      "Susitikite aikštelėje nustatytu laiku. Laisvi žaidimai — be jokio spaudimo. Reitinginiai žaidimai — kovoja dėl ELO taškų.",
  },
  {
    step: "04",
    icon: ClipboardCheck,
    title: "Pranešk rezultatą",
    description:
      "Po žaidimo įveskite galutinį rezultatą. Kiti dalyviai turi 24 valandas patvirtinti arba ginčyti. Patvirtinus — ELO atnaujinamas automatiškai.",
  },
];

const JOIN_STEPS = [
  {
    step: "01",
    icon: Trophy,
    title: "Raskite žaidimą",
    description:
      "Filtruokite pagal sporto šaką, miestą arba žaidimo tipą. Reitinginiams žaidimams rodoma kūrėjo ELO — žinokite, prieš ką žaisite.",
  },
  {
    step: "02",
    icon: UserPlus,
    title: "Prisijunkite",
    description:
      'Paspauskite "Prisijungti". Jeigu žaidimas privatus — kūrėjas turi patvirtinti jūsų paraiškos. Viešiems žaidimams — prisijungiate iš karto.',
  },
  {
    step: "03",
    icon: CheckCircle2,
    title: "Patvirtinkite rezultatą",
    description:
      "Po žaidimo jūs gausite pranešimą apie rezultatą. Jeigu sutinkate — patvirtinkite. Nesutinkate — ginčykite per 24 valandas.",
  },
];

const ELO_TIERS = [
  {
    name: "Bronze",
    ltName: "Bronza",
    range: "0 – 1199",
    color: "#cd7c2f",
    bg: "rgba(205,124,47,0.12)",
    border: "rgba(205,124,47,0.35)",
    emoji: "🥉",
    desc: "Pradedantysis žaidėjas. Kiekvienas žaidimas — galimybė pakilti.",
  },
  {
    name: "Silver",
    ltName: "Sidabras",
    range: "1200 – 1399",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.35)",
    emoji: "🥈",
    desc: "Vidutiniu lygiu žaidėjas. Pažįstate žaidimo taktiką ir taisykles.",
  },
  {
    name: "Gold",
    ltName: "Auksas",
    range: "1400 – 1599",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    emoji: "🥇",
    desc: "Pažengęs žaidėjas. Reguliariai žaidžiate ir turite gerą techniką.",
  },
  {
    name: "Diamond",
    ltName: "Deimantas",
    range: "1600+",
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    border: "rgba(34,211,238,0.35)",
    emoji: "💎",
    desc: "Elitas. Nuolat žaidžiantis, labai geras žaidėjas.",
  },
];

const FAQ = [
  {
    q: "Ar ELO įtakoja laisvus žaidimus?",
    a: 'Ne. ELO keičiasi tik po reitinginių žaidimų, kurie pažymėti kaip "Reitinginis". Laisvi žaidimai neįtakoja jūsų reitingo.',
  },
  {
    q: "Kaip skaičiuojamas ELO?",
    a: "Naudojame standartinę ELO formulę su K=32. Nugalėtojas gauna taškus iš pralaimėjusiojo. Kuo stipresnis priešininkas — tuo daugiau taškų galite laimėti.",
  },
  {
    q: "Kas atsitinka jei rezultatas ginčijamas?",
    a: "Jei dalyviai nesutinka su rezultatu, jis perkeliamas į ginčo būseną. ELO nekeičiamas tol, kol ginčas neišsprendžiamas arba nesibaigus 24 val. patvirtinimo laikui.",
  },
  {
    q: "Ar galiu žaisti su draugais privačiai?",
    a: "Taip! Kuriant žaidimą pažymėkite jį kaip privatų. Privatūs žaidimai nerodomi viešame sąraše — prisijungti galima tik su kvietimu arba nuoroda.",
  },
  {
    q: "Kiek žaidėjų gali būti viename žaidime?",
    a: "Jūs nusprendžiate kiek žaidėjų reikia — nuo 2 iki 22. Sistema automatiškai paskirsto žaidėjus į komandas A ir B pagal prisijungimo eilę.",
  },
  {
    q: "Ar galiu kviesti žaidėjus el. paštu?",
    a: "Taip. Žaidimo puslapyje galite siųsti kvietimus el. paštu — net žmonėms, kurie dar nėra registruoti korts.lt platformoje.",
  },
];

const STATS = [
  { value: "15", label: "Sporto šakų" },
  { value: "K=32", label: "ELO koeficientas" },
  { value: "1200", label: "Pradinis ELO reitingas" },
  { value: "24h", label: "Rezultato patvirtinimas" },
];

export default function GamesGuidePage() {
  const { isSignedIn } = useUser();

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 z-0">
          <img
            src={`${base}/coaches/coach_banner_2.webp`}
            srcSet={`${base}/coaches/coach_banner_2-480.webp 480w, ${base}/coaches/coach_banner_2-800.webp 800w, ${base}/coaches/coach_banner_2.webp 1200w`}
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1200}
            height={655}
            className="absolute inset-0 w-full h-full object-cover object-top"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#132D4C]/95 via-[#132D4C]/82 to-[#132D4C]/55" />
        </div>

        <div className="container mx-auto px-4 relative z-10 py-24 md:py-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Swords className="h-3.5 w-3.5" />
              Konkurencinga sporto ekosistema
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
              Žaisk. Kovok.{" "}
              <span style={{ color: "#C5E041" }}>Kilk reitinge.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/75 mb-8 max-w-xl leading-relaxed">
              Sukurk žaidimą, rask partnerių ar varžovų ir matuok savo progresą
              realiu ELO reitingu — skirtingose sporto šakose.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                asChild
                className="font-semibold text-base px-8 h-12 rounded-xl gap-2"
                style={{ background: "#C5E041", color: "#132D4C" }}
              >
                <Link href="/matches">
                  Eiti į žaidimus
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a href="#how-to-create">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 font-semibold text-base px-8 h-12 rounded-xl"
                >
                  Kaip tai veikia?
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-10">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {s.value}
                  </div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mt-0.5">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Match types ribbon */}
      <div className="bg-muted/40 border-y">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap shrink-0">
              Žaidimo tipai
            </span>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-background border-primary/40 text-primary">
                <Trophy className="w-3.5 h-3.5" />
                Laisvas žaidimas — ELO nekinta
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-background border-purple-500/40 text-purple-500">
                <Swords className="w-3.5 h-3.5" />
                Reitinginis žaidimas — ELO keičiasi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How to create a game */}
      <section
        id="how-to-create"
        className="py-16 md:py-24 bg-background scroll-mt-20"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Plus className="h-3.5 w-3.5" />
              Žaidimo kūrimas
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Kaip sukurti žaidimą?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Nuo idėjos iki žaidimo — vos 4 žingsniai. Kvieskite draugus arba
              raskite naujų varžovų iš Lietuvos sporto bendruomenės.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {CREATE_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="relative flex flex-col gap-4 p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow"
                >
                  <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}>
                    {s.step}
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1.5">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to join */}
      <section className="py-16 md:py-24 bg-muted/30 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-semibold mb-4">
                  <UserPlus className="h-3.5 w-3.5" />
                  Prisijungimas
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Kaip prisijungti prie žaidimo?
                </h2>
                <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                  Raskite žaidimą, kuris tinka jūsų lygiui ir tvarkaraščiui.
                  Filtruokite pagal sporto šaką, miestą ar žaidimo tipą.
                </p>
                <div className="space-y-5">
                  {JOIN_STEPS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.step} className="flex gap-4">
                        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border"
                          style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)", borderColor: "#1a3d6644" }}>
                          <Icon className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm mb-0.5">{s.title}</div>
                          <div className="text-sm text-muted-foreground leading-relaxed">
                            {s.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border shadow-lg"
                style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}>
                <div className="p-6 text-white">
                  <div className="flex items-center gap-2 mb-5">
                    <Mail className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">El. pašto kvietimai</span>
                  </div>
                  <p className="text-white/75 text-sm leading-relaxed mb-5">
                    Žaidimo kūrėjai gali siųsti kvietimus el. paštu — net
                    žmonėms, kurie dar nėra registruoti korts.lt. Gavę kvietimą,
                    jie gali užsiregistruoti ir iš karto prisijungti prie žaidimo.
                  </p>
                  <div className="rounded-xl p-4 border border-white/10 bg-white/5 text-xs text-white/60 font-mono">
                    📧 Kviečiame jus žaisti tenisą su Marius V. ir dar 2 žaidėjais...
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: "#C5E041", color: "#132D4C" }}>
                        Prisijungti prie žaidimo →
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 px-6 py-4">
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <Shield className="w-3.5 h-3.5" />
                    Kvietimų nuorodos yra unikalios ir saugios
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ELO System */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 text-xs font-semibold mb-4">
              <TrendingUp className="h-3.5 w-3.5" />
              ELO sistema
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Kaip veikia ELO reitingas?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              ELO — pasaulyje naudojama reitingų sistema, kuri matuoja žaidėjų
              lygį. Korts.lt kiekvienas žaidėjas turi atskirus ELO reitingus
              kiekvienoje sporto šakoje.
            </p>
          </div>

          {/* ELO explanation box */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-2xl border bg-card p-5 text-center">
                <div className="text-3xl font-bold mb-1 text-foreground">
                  1200
                </div>
                <div className="text-sm font-semibold mb-2">Pradinis reitingas</div>
                <p className="text-xs text-muted-foreground">
                  Visi žaidėjai pradeda nuo 1200 taškų kiekvienoje sporto
                  šakoje.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-5 text-center">
                <div className="text-3xl font-bold mb-1" style={{ color: "#C5E041" }}>
                  K=32
                </div>
                <div className="text-sm font-semibold mb-2">K-koeficientas</div>
                <p className="text-xs text-muted-foreground">
                  Maksimalus taškų pokytis per vieną žaidimą. Kuo lygesni
                  varžovai — tuo mažiau keičiasi.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-5 text-center">
                <div className="text-3xl font-bold mb-1 text-purple-500">
                  2–32
                </div>
                <div className="text-sm font-semibold mb-2">Taškų pokytis</div>
                <p className="text-xs text-muted-foreground">
                  Nugalėtojas gauna taškų iš pralaimėjusiojo. Stipresnio nugalėjimas
                  duoda mažiau; silpnesnio — daugiau.
                </p>
              </div>
            </div>
          </div>

          {/* Tiers */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-center mb-6">Reitingų lygiai</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ELO_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-2xl border p-5 flex flex-col gap-3"
                  style={{ background: tier.bg, borderColor: tier.border }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{tier.emoji}</span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: tier.color }}>
                        {tier.ltName}
                      </div>
                      <div className="text-xs text-muted-foreground">{tier.range}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tier.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Komandiniuose žaidimuose</strong>{" "}
                  ELO skaičiuojamas pagal komandos vidurkį. Visos komandos narių
                  reitingai keičiasi vienodai — laimėjusieji gauna taškų iš
                  pralaimėjusiųjų.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Result verification */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-xs font-semibold mb-4">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Rezultatų patvirtinimas
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Sąžininga rezultatų sistema
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Kiekvieną rezultatą turi patvirtinti dalyviai. Tai užtikrina, kad
                ELO reitingas atspindi tikrą žaidėjų lygį.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: ClipboardCheck,
                  color: "#3b82f6",
                  bg: "rgba(59,130,246,0.08)",
                  border: "rgba(59,130,246,0.2)",
                  title: "Žaidimo kūrėjas praneša",
                  desc: "Po žaidimo kūrėjas įveda galutinį rezultatą (pvz. 6:4, 21:18). Sistema užregistruoja pranešimą.",
                },
                {
                  icon: Users,
                  color: "#f97316",
                  bg: "rgba(249,115,22,0.08)",
                  border: "rgba(249,115,22,0.2)",
                  title: "Dalyviai patvirtina",
                  desc: "Kiti dalyviai turi 24 valandas — patvirtinti arba ginčyti. Ginčas sustabdo ELO pakeitimą.",
                },
                {
                  icon: BarChart3,
                  color: "#22c55e",
                  bg: "rgba(34,197,94,0.08)",
                  border: "rgba(34,197,94,0.2)",
                  title: "ELO atnaujinamas",
                  desc: "Patvirtinus arba praėjus 24h — ELO automatiškai atnaujinamas. Reitinginis žaidimas baigiamas.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border p-5 flex flex-col gap-3"
                    style={{ background: item.bg, borderColor: item.border }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: item.color + "22" }}>
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="font-semibold text-sm">{item.title}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Dažnai užduodami klausimai
              </h2>
              <p className="text-muted-foreground">
                Neradote atsakymo? Rašykite mums per kontaktų puslapį.
              </p>
            </div>
            <div className="space-y-3">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border bg-card p-5"
                >
                  <div className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm mb-1.5">{item.q}</div>
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-16 md:py-24 text-white"
        style={{ background: "linear-gradient(135deg, #132D4C, #1a3d66)" }}
      >
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-6">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Pradėkite šiandien
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Pasiruošę žaisti?
          </h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            Prisijunkite prie Lietuvos sporto bendruomenės. Raskite varžovų,
            kelkite savo ELO ir tapkite savo sporto šakos lyderiu.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              size="lg"
              asChild
              className="font-semibold text-base px-8 h-12 rounded-xl gap-2"
              style={{ background: "#C5E041", color: "#132D4C" }}
            >
              <Link href="/games">
                Peržiūrėti žaidimus
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {!isSignedIn && (
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-white/25 text-white hover:bg-white/10 font-semibold text-base px-8 h-12 rounded-xl"
              >
                <Link href="/sign-up">Registruotis nemokamai</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
