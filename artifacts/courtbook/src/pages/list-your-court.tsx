import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  BarChart3,
  Shield,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  Zap,
  Globe,
  Smartphone,
  HeadphonesIcon,
  Euro,
  Camera,
  Settings,
  Bell,
  QrCode,
  Printer,
} from "lucide-react";
import { SportIcon, sportColor } from "@/components/sport-icon";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

const STEPS = [
  {
    step: "01",
    icon: Settings,
    title: "Sukurkite paskyrą",
    description: "Užsiregistruokite kaip korto savininkas. Procesas užtrunka vos 2 minutes — jokių sudėtingų formų ar dokumentų.",
  },
  {
    step: "02",
    icon: Camera,
    title: "Pridėkite savo kortą",
    description: "Įkelkite nuotraukas, nurodykite sporto tipą, adresą, patogumus ir darbo valandas. Mes viską patvirtiname per 24 valandas.",
  },
  {
    step: "03",
    icon: Euro,
    title: "Nustatykite kainas",
    description: "Lanksti kainodara — nustatykite skirtingas kainas skirtingoms valandoms, savaitgaliams ar šventėms. Viskas jūsų rankose.",
  },
  {
    step: "04",
    icon: Calendar,
    title: "Priimkite rezervacijas",
    description: "Klientai randa jūsų kortą, pasirenka laiką ir sumoka online. Jūs gaunate patvirtinimą ir mokėjimą automatiškai.",
  },
];

const BENEFITS = [
  {
    icon: Users,
    title: "450+ aktyvių žaidėjų",
    description: "Prieiga prie augančios Lietuvos sporto bendruomenės. Jūsų kortas matomas tūkstančiams ieškančių žaidėjų.",
    color: "#84cc16",
  },
  {
    icon: CreditCard,
    title: "Automatiniai mokėjimai",
    description: "Stripe mokėjimų sistema užtikrina greitus ir saugius atsiskaitymus. Pinigai patenka tiesiai į jūsų sąskaitą.",
    color: "#3b82f6",
  },
  {
    icon: BarChart3,
    title: "Savininko valdymo pultas",
    description: "Stebėkite rezervacijas, pajamas, užimtumą ir klientų atsiliepimus realiuoju laiku iš bet kurio įrenginio.",
    color: "#f97316",
  },
  {
    icon: Clock,
    title: "Sutaupykite laiko",
    description: "Jokių telefoninių skambučių ar žinučių. Automatinė rezervacijų sistema veikia 24/7 — net kai jūs miegate.",
    color: "#a855f7",
  },
  {
    icon: Shield,
    title: "Apsauga nuo nepasirodymų",
    description: "Išankstinis mokėjimas užtikrina, kad klientai tikrai atvyks. Mažiau tuščių laiko tarpų, daugiau pajamų.",
    color: "#22c55e",
  },
  {
    icon: Globe,
    title: "Daugiakalbė platforma",
    description: "Jūsų kortas pasiekiamas lietuvių, anglų ir rusų kalbomis. Pritraukite tarptautinius klientus be jokio papildomo darbo.",
    color: "#06b6d4",
  },
  {
    icon: Bell,
    title: "Pranešimai realiu laiku",
    description: "Gaukite pranešimus apie naujas rezervacijas, atšaukimus ir klientų žinutes tiesiogiai į savo telefoną.",
    color: "#f43f5e",
  },
  {
    icon: Star,
    title: "Atsiliepimai ir reitingai",
    description: "Geri atsiliepimai pritraukia daugiau klientų. Mūsų reitingų sistema padeda jūsų kortui išsiskirti.",
    color: "#ca8a04",
  },
  {
    icon: QrCode,
    title: "QR kodas kiekvienam kortui",
    description: "Sugeneruokite profesionalų QR kodą, išspausdinkite ir pakabinkite ant tvoros. Žaidėjai nuskeanuoja ir iš karto rezervuoja.",
    color: "#84cc16",
  },
];

const SPORTS = ["tennis", "basketball", "padel", "football", "badminton", "squash", "table_tennis", "golf", "snooker", "bowling"] as const;

const STATS = [
  { value: "450+", label: "Registruotų kortų" },
  { value: "24+", label: "Lietuvos miestų" },
  { value: "10", label: "Sporto šakų" },
  { value: "0%", label: "Komisinis mokestis*" },
];

const FAQ = [
  {
    q: "Kiek kainuoja registracija?",
    a: "Registracija yra visiškai nemokama. Mes taikome mažą komisinį mokestį tik nuo sėkmingų rezervacijų — jokių mėnesinių mokesčių ar paslėptų išlaidų.",
  },
  {
    q: "Ar galiu valdyti savo korto grafiką?",
    a: "Taip! Jūs turite pilną kontrolę — galite blokuoti laikus, keisti kainas, pridėti šventines dienas ir valdyti viską iš savo valdymo pulto.",
  },
  {
    q: "Kaip vyksta mokėjimai?",
    a: "Klientai moka online per saugią Stripe sistemą. Pinigai pervedami į jūsų sąskaitą automatiškai kas savaitę.",
  },
  {
    q: "Ar galiu turėti kelis kortus?",
    a: "Žinoma! Galite pridėti neribotą skaičių kortų — skirtingų sporto šakų, skirtingose vietose. Visi valdomi iš vieno pulto.",
  },
  {
    q: "Kokias sporto šakas palaikote?",
    a: "Palaikome 10 sporto šakų: tenisą, krepšinį, padelį, futbolą, badmintoną, skvošą, stalo tenisą, golfą, snukerį ir boulingą.",
  },
];

export default function ListYourCourt() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative bg-zinc-950 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={`${base}/courts/court_1_seb_arena.png`}
            className="absolute inset-0 w-full h-full object-cover"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/75 to-zinc-950/50" />
        </div>

        <div className="container mx-auto px-4 relative z-10 py-24 md:py-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Zap className="h-3.5 w-3.5" />
              Nemokama registracija
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
              Uždirbkite iš savo sporto aikštelės su{" "}
              <span className="text-primary">korts.lt</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl leading-relaxed">
              Pridėkite savo kortą prie Lietuvos didžiausios sporto aikštelių
              platformos ir pradėkite priimti rezervacijas online jau šiandien.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base px-8 h-12 rounded-xl gap-2">
                  Pradėti nemokamai
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 font-semibold text-base px-8 h-12 rounded-xl">
                  Kaip tai veikia?
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-10">
              {STATS.map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sport types ribbon */}
      <div className="bg-muted/40 border-y">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap shrink-0">
              Palaikomos sporto šakos
            </span>
            <div className="flex gap-2 flex-wrap">
              {SPORTS.map(sport => {
                const color = sportColor[sport] ?? "#84cc16";
                return (
                  <div
                    key={sport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-background"
                    style={{ borderColor: color + "44", color }}
                  >
                    <SportIcon sport={sport} size={12} strokeWidth={2} />
                    <span className="capitalize">{sport.replace("_", " ")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Platform screenshots */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Jūsų kortas — tūkstančių akių centre
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Klientai randa jūsų aikštelę per paiešką, žemėlapį ar filtrą.
              Kiekvienas kortas gauna profesionalų profilį su nuotraukomis,
              atsiliepimais ir realaus laiko kainomis.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div className="group relative rounded-2xl overflow-hidden border shadow-lg hover:shadow-xl transition-shadow">
              <img
                src={`${base}/screenshots/courts-listing.jpg`}
                alt="Kortų sąrašas"
                className="w-full h-auto"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <span className="text-sm font-semibold text-primary">Paieškos puslapis</span>
                <p className="text-white text-sm mt-1">Filtravimas pagal sportą, miestą, kainą ir patogumus</p>
              </div>
            </div>
            <div className="group relative rounded-2xl overflow-hidden border shadow-lg hover:shadow-xl transition-shadow">
              <img
                src={`${base}/screenshots/court-detail.jpg`}
                alt="Korto profilis"
                className="w-full h-auto"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <span className="text-sm font-semibold text-primary">Korto profilis</span>
                <p className="text-white text-sm mt-1">Kalendorius, kainodara, atsiliepimai ir online rezervacija</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-muted/30 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Kaip tai veikia?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Nuo registracijos iki pirmosios rezervacijos — 4 paprasti žingsniai.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative group">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[calc(50%+40px)] right-[-40px] border-t-2 border-dashed border-primary/20" />
                )}
                <div className="bg-background rounded-2xl border p-6 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-[11px] font-bold text-primary/60 uppercase tracking-widest">
                      Žingsnis {s.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Kodėl verta būti <span className="text-primary">korts.lt</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Visos priemonės, reikalingos sėkmingam sporto aikštelės verslui.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {BENEFITS.map(b => (
              <div key={b.title} className="group bg-muted/30 hover:bg-muted/50 border rounded-2xl p-5 transition-all hover:shadow-md">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: b.color + "18" }}
                >
                  <b.icon className="h-5 w-5" style={{ color: b.color }} />
                </div>
                <h3 className="font-bold mb-1.5 text-sm">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Owner dashboard preview */}
      <section className="py-16 md:py-24 bg-zinc-950 text-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold mb-5">
                <BarChart3 className="h-3.5 w-3.5" />
                Savininko valdymo pultas
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                Viskas po ranka —{" "}
                <span className="text-primary">iš vienos vietos</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-8 max-w-lg">
                Valdykite savo kortus, stebėkite pajamas, tvarkykite
                rezervacijas ir komunikuokite su klientais iš patogaus valdymo
                pulto. Veikia tiek kompiuteryje, tiek telefone.
              </p>
              <div className="space-y-4">
                {[
                  "Realaus laiko rezervacijų kalendorius",
                  "Pajamų ir užimtumo statistika",
                  "Laiko blokavimas ir kainų valdymas",
                  "Klientų atsiliepimai ir komunikacija",
                  "Kelių kortų valdymas vienoje vietoje",
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/5 rounded-3xl blur-2xl" />
                <img
                  src={`${base}/screenshots/homepage.jpg`}
                  alt="korts.lt platforma"
                  className="relative rounded-2xl border border-white/10 shadow-2xl w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment & booking flow */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Mokėjimai ir rezervacijos — <span className="text-primary">viskas automatizuota</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Nuo kliento paieškos iki pinigų jūsų sąskaitoje — viskas vyksta
              sklandžiai ir automatiškai.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {[
                {
                  icon: MapPin,
                  title: "Klientas randa jūsų kortą",
                  desc: "Per paiešką, žemėlapį ar filtrus klientas atranda jūsų aikštelę tarp 450+ kortų visoje Lietuvoje.",
                  color: "#84cc16",
                },
                {
                  icon: Calendar,
                  title: "Pasirenka datą ir laiką",
                  desc: "Realaus laiko kalendorius rodo tik laisvus laikus. Klientas pasirenka tinkamą laiką ir trukmę.",
                  color: "#3b82f6",
                },
                {
                  icon: CreditCard,
                  title: "Sumoka saugiai online",
                  desc: "Stripe mokėjimų sistema priima visas pagrindines korteles. Mokėjimas patvirtinamas per sekundes.",
                  color: "#f97316",
                },
                {
                  icon: Bell,
                  title: "Jūs gaunate patvirtinimą",
                  desc: "Automatinis pranešimas jums ir klientui. Rezervacija atsiranda jūsų valdymo pulte akimirksniu.",
                  color: "#a855f7",
                },
                {
                  icon: Euro,
                  title: "Pinigai jūsų sąskaitoje",
                  desc: "Mokėjimai pervedami automatiškai kas savaitę tiesiai į jūsų banko sąskaitą. Jokių vėlavimų.",
                  color: "#22c55e",
                },
              ].map((item, i, arr) => (
                <div key={item.title} className="flex gap-5 mb-2 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10"
                      style={{ background: item.color + "18", border: `2px solid ${item.color}44` }}
                    >
                      <item.icon className="h-4 w-4" style={{ color: item.color }} />
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border my-1" />
                    )}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-bold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Dažniausiai užduodami klausimai
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {FAQ.map(item => (
              <details key={item.q} className="group bg-background border rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 font-semibold text-sm hover:bg-muted/30 transition-colors list-none">
                  {item.q}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-zinc-950 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img
            src={`${base}/courts/padel/padel_court_indoor_3.jpg`}
            className="w-full h-full object-cover"
            alt=""
          />
        </div>
        <div className="absolute inset-0 bg-zinc-950/80" />
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Paruošti pradėti?
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8 text-lg">
            Prisijunkite prie 450+ sporto aikštelių, kurios jau naudoja korts.lt
            platformą. Registracija nemokama, sutarčių nėra.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base px-10 h-13 rounded-xl gap-2">
                Registruotis nemokamai
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:info@korts.lt">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 font-semibold text-base px-8 h-13 rounded-xl">
                Susisiekti su mumis
              </Button>
            </a>
          </div>
          <p className="text-[11px] text-zinc-600 mt-6">
            * Introdukcinis laikotarpis — 0% komisinis mokestis pirmus 3 mėnesius.
          </p>
        </div>
      </section>
    </Layout>
  );
}
