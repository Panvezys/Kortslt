import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trash2, Mail, Settings as SettingsIcon, ShieldCheck, AlertTriangle } from "lucide-react";

const LAST_UPDATED = "2026-04-27";
const DELETION_EMAIL = "privacy@korts.lt";

export default function DeleteAccountPage() {
  const mailtoSubject = encodeURIComponent("Paskyros ištrynimo užklausa");
  const mailtoBody = encodeURIComponent(
    [
      "Sveiki,",
      "",
      "Prašau ištrinti mano korts.lt paskyrą ir su ja susijusius duomenis.",
      "",
      "Paskyros el. paštas: ",
      "Vardas (jei skiriasi nuo pašto): ",
      "Priežastis (neprivaloma): ",
      "",
      "Ačiū,",
    ].join("\n"),
  );

  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Ištrinti paskyrą
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-10">
            Paskutinį kartą atnaujinta: {LAST_UPDATED}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-5">
            <p>
              Šiame puslapyje rasite, kaip visam laikui ištrinti savo{" "}
              <strong className="text-foreground">korts.lt</strong> paskyrą ir
              su ja susijusius duomenis. Galite tai padaryti patys per
              programėlę arba atsiųsti mums užklausą el. paštu.
            </p>

            {/* Method 1 — In-app deletion */}
            <div className="not-prose rounded-xl border bg-card p-6 my-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground m-0">
                    1 būdas — ištrinkite patys per nustatymus
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-0">
                    Greičiausias būdas, jei galite prisijungti prie savo paskyros.
                  </p>
                </div>
              </div>

              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground mb-5">
                <li>
                  Prisijunkite prie korts.lt naudodami savo el. paštą arba
                  Google paskyrą.
                </li>
                <li>
                  Eikite į puslapį <strong className="text-foreground">Nustatymai</strong>{" "}
                  (viršuje dešinėje – jūsų avataras → „Nustatymai").
                </li>
                <li>
                  Slinkite žemyn iki skilties{" "}
                  <strong className="text-foreground">Pavojinga zona</strong> ir
                  spauskite mygtuką{" "}
                  <strong className="text-foreground">„Ištrinti paskyrą"</strong>.
                </li>
                <li>
                  Patvirtinimo lange įveskite{" "}
                  <span className="font-mono bg-muted text-foreground px-1.5 py-0.5 rounded text-xs">
                    IŠTRINTI
                  </span>{" "}
                  ir paspauskite „Taip, ištrinti paskyrą".
                </li>
              </ol>

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Eiti į nustatymus
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/sign-in">Prisijungti</Link>
                </Button>
              </div>
            </div>

            {/* Method 2 — Email request */}
            <div className="not-prose rounded-xl border bg-card p-6 my-8">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground m-0">
                    2 būdas — atsiųskite užklausą el. paštu
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-0">
                    Naudokite, jei nepavyksta prisijungti arba reikia papildomos pagalbos.
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                Atsiųskite el. laišką iš to paties el. pašto adreso, kuriuo
                užregistravote korts.lt paskyrą, šiuo adresu:
              </p>

              <a
                href={`mailto:${DELETION_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Mail className="w-4 h-4" />
                {DELETION_EMAIL}
              </a>

              <p className="text-sm text-muted-foreground mt-4 mb-0">
                Į užklausą atsakysime per <strong className="text-foreground">30 dienų</strong>.
                Asmens tapatybei patvirtinti galime paprašyti papildomos informacijos.
              </p>
            </div>

            {/* What gets deleted */}
            <h2 className="text-xl font-semibold text-foreground pt-2">
              Kokie duomenys bus ištrinti
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-foreground">Jūsų prisijungimo paskyra</strong> –
                vardas, pavardė, el. pašto adresas ir profilio nuotrauka,
                saugoma mūsų autentifikacijos partnerio Clerk sistemoje.
              </li>
              <li>
                <strong className="text-foreground">Visos jūsų rezervacijos</strong>{" "}
                korts.lt duomenų bazėje (tiek aktyvios, tiek istorinės).
              </li>
              <li>
                <strong className="text-foreground">Visos prisijungimo sesijos</strong> –
                būsite atjungti nuo visų įrenginių.
              </li>
            </ul>
            <p className="text-sm">
              Po ištrynimo nebegalėsite prisijungti tuo pačiu el. paštu prie
              tos pačios paskyros – jei vėliau persigalvosite, galėsite
              užsiregistruoti iš naujo, tačiau ankstesnių rezervacijų ar
              statistikos atkurti negalėsime.
            </p>

            {/* What we may keep */}
            <div className="not-prose rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 my-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground m-0">
                    Ką galime saugoti net ir po ištrynimo
                  </p>
                  <p className="m-0">
                    Pagal Lietuvos Respublikos teisės aktus tam tikrus duomenis
                    privalome saugoti net ir po paskyros ištrynimo:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 m-0">
                    <li>
                      Apskaitos dokumentus (sąskaitas, mokėjimų įrašus) –{" "}
                      <strong className="text-foreground">10 metų</strong>.
                    </li>
                    <li>
                      Mokėjimų informaciją Stripe sistemoje – pagal Stripe
                      saugojimo politiką.
                    </li>
                  </ul>
                  <p className="m-0">
                    Šie duomenys saugomi atskirai ir nebebus naudojami jokiems
                    rinkodaros ar paskyros tikslams. Daugiau informacijos rasite{" "}
                    <a
                      href="https://korts.lt/privacy"
                      className="text-primary hover:underline"
                    >
                      korts.lt privatumo politikoje
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>

            {/* Consequences */}
            <h2 className="text-xl font-semibold text-foreground pt-2">
              Svarbu žinoti prieš ištrinant
            </h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-foreground">Veiksmas yra negrįžtamas.</strong>{" "}
                Ištrintos paskyros atkurti negalėsime.
              </li>
              <li>
                Jei turite{" "}
                <strong className="text-foreground">aktyvių rezervacijų</strong>,
                jos taip pat bus ištrintos. Rekomenduojame jas atšaukti arba
                įvykdyti prieš tęsiant.
              </li>
              <li>
                Jei esate{" "}
                <strong className="text-foreground">aikštelės savininkas arba treneris</strong>,
                prieš ištrindami paskyrą susisiekite su mumis adresu{" "}
                <a
                  href={`mailto:${DELETION_EMAIL}`}
                  className="text-primary hover:underline"
                >
                  {DELETION_EMAIL}
                </a>{" "}
                – padėsime saugiai perleisti arba uždaryti jūsų aikšteles.
              </li>
            </ul>

            {/* Privacy reference */}
            <div className="not-prose rounded-xl border bg-muted/30 p-5 my-6 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground m-0">
                Daugiau apie tai, kaip tvarkome jūsų asmens duomenis, skaitykite{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  korts.lt privatumo politikoje
                </Link>
                .
              </p>
            </div>

            {/* Contact */}
            <h2 className="text-xl font-semibold text-foreground pt-2">
              Klausimai?
            </h2>
            <p>
              Jei turite klausimų apie paskyros ištrynimą ar jūsų asmens
              duomenis, susisiekite su mumis:{" "}
              <a
                href={`mailto:${DELETION_EMAIL}`}
                className="text-primary hover:underline"
              >
                {DELETION_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
