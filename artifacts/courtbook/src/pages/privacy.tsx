import { Layout } from "@/components/layout";

const LAST_UPDATED = "2026-04-27";

export default function PrivacyPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">Privatumo politika</h1>
          <p className="text-sm text-muted-foreground mb-10">
            Paskutinį kartą atnaujinta: {LAST_UPDATED}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-5">
            <p>
              Ši privatumo politika paaiškina, kaip <strong className="text-foreground">UAB Korts Digital</strong>{" "}
              („mes", „mūsų") renka, naudoja ir saugo jūsų asmens duomenis, kai naudojatės{" "}
              <strong className="text-foreground">korts.lt</strong> svetaine ir mobiliąja programėle
              (toliau – Paslauga). Naudodamiesi Paslauga sutinkate su šia politika.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">1. Kokius duomenis renkame</h2>
            <p>Renkame tik tuos duomenis, kurių reikia rezervacijoms vykdyti ir paskyrai administruoti:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-foreground">Paskyros duomenys:</strong> vardas, pavardė ir el. pašto adresas,
                kuriuos pateikiate registracijos metu (taip pat per Google paskyrą).
              </li>
              <li>
                <strong className="text-foreground">Rezervacijų duomenys:</strong> jūsų užsakytos sporto aikštelės,
                datos, laikai, kainos ir užsakymo istorija.
              </li>
              <li>
                <strong className="text-foreground">Mokėjimų duomenys:</strong> mokėjimus tvarko mūsų partneris
                Stripe. Mes <em>nesaugome</em> jūsų banko kortelės numerio – matome tik mokėjimo statusą ir paskutinius
                4 kortelės skaitmenis.
              </li>
              <li>
                <strong className="text-foreground">Techniniai duomenys:</strong> įrenginio tipas, naršyklė, IP adresas
                ir slapukai, naudojami autentifikacijai bei svetainės veikimui užtikrinti.
              </li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground pt-2">2. Kodėl renkame šiuos duomenis</h2>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Sukurti ir tvarkyti jūsų paskyrą.</li>
              <li>Vykdyti sporto aikštelių rezervacijas ir siųsti patvirtinimus.</li>
              <li>Apdoroti mokėjimus per Stripe ir grąžinti pinigus, kai reikia.</li>
              <li>Teikti klientų aptarnavimą ir atsakyti į užklausas.</li>
              <li>Tobulinti Paslaugą ir užtikrinti jos saugumą.</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground pt-2">3. Mokėjimai ir Stripe</h2>
            <p>
              Visi mokėjimai apdorojami per <strong className="text-foreground">Stripe Payments Europe, Ltd.</strong>,
              sertifikuotą PCI-DSS Level 1 paslaugų teikėją. Pateikdami kortelės duomenis juos perduodate tiesiogiai
              Stripe – mes prie jų prieigos neturime. Stripe privatumo politika:{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                stripe.com/privacy
              </a>.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">4. Su kuo dalijamės duomenimis</h2>
            <p>
              Jūsų duomenų neparduodame ir neperduodame trečiosioms šalims rinkodaros tikslais. Dalinamės jais tik
              tiek, kiek būtina:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-foreground">Aikštelių savininkais:</strong> rezervacijos atveju savininkas
                mato jūsų vardą ir užsakymo informaciją.
              </li>
              <li>
                <strong className="text-foreground">Stripe</strong> – mokėjimams apdoroti.
              </li>
              <li>
                <strong className="text-foreground">Clerk</strong> – paskyros autentifikacijai.
              </li>
              <li>Teisėsaugos institucijoms, kai to reikalauja įstatymai.</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground pt-2">5. Duomenų saugojimas</h2>
            <p>
              Paskyros duomenys saugomi tol, kol jūsų paskyra aktyvi. Rezervacijų ir mokėjimų įrašai saugomi 10 metų,
              kaip reikalauja Lietuvos Respublikos buhalterinės apskaitos teisės aktai.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">6. Jūsų teisės</h2>
            <p>Pagal BDAR (GDPR) jūs turite teisę:</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Susipažinti su savo duomenimis ir gauti jų kopiją.</li>
              <li>Ištaisyti netikslius duomenis.</li>
              <li>Reikalauti ištrinti savo paskyrą ir asmens duomenis.</li>
              <li>Atšaukti sutikimą tvarkyti duomenis.</li>
              <li>Pateikti skundą Valstybinei duomenų apsaugos inspekcijai (vdai.lrv.lt).</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground pt-2">7. Slapukai</h2>
            <p>
              Naudojame būtinus slapukus prisijungimo sesijai palaikyti ir analitinius slapukus, padedančius mums
              suprasti, kaip naudojate Paslaugą. Slapukus galite valdyti savo naršyklės nustatymuose.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">8. Vaikų privatumas</h2>
            <p>
              Paslauga neskirta jaunesniems nei 16 metų asmenims. Jei sužinome, kad surinkome duomenis iš nepilnamečio
              be tėvų sutikimo, nedelsdami juos ištriname.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">9. Politikos pakeitimai</h2>
            <p>
              Šią politiką galime atnaujinti. Apie esminius pakeitimus pranešime el. paštu arba per Paslaugą prieš
              jiems įsigaliojant.
            </p>

            <h2 className="text-xl font-semibold text-foreground pt-2">10. Susisiekite su mumis</h2>
            <p>
              Klausimais dėl privatumo rašykite:{" "}
              <a href="mailto:privacy@korts.lt" className="text-primary hover:underline">
                privacy@korts.lt
              </a>
              <br />
              UAB Korts Digital, Gedimino pr. 45-7, Vilnius LT-01504, Lietuva
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
