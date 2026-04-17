import { Layout } from "@/components/layout";

const ITEMS = [
  { q: "Kaip rezervuoti aikštelę?", a: "Pasirinkite aikštelę, laiką ir patvirtinkite rezervaciją keliais paspaudimais." },
  { q: "Ar galiu pridėti savo aikštelę?", a: "Taip — eikite į savininkų skiltį ir užpildykite registracijos formą." },
  { q: "Ar mokėjimai saugūs?", a: "Taip, platforma naudoja saugius mokėjimo sprendimus." },
  { q: "Ar galiu susisiekti su komanda?", a: "Taip, rašykite mums kontaktų puslapyje." },
  { q: "Ar galiu atšaukti rezervaciją?", a: "Taip, savo rezervacijų puslapyje galite atšaukti aktyvias rezervacijas, atsižvelgiant į aikštelės taisykles." },
  { q: "Kaip gauti pranešimus apie naujus turnyrus?", a: "Prisijungę prie paskyros gausite pranešimus apie aktualius turnyrus jūsų mieste." },
];

export default function FAQPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider mb-4">
            D.U.K.
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">Dažniausiai užduodami klausimai</h1>
          <p className="text-muted-foreground mb-10">Atsakymai į populiariausius klausimus apie korts.lt naudojimą.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {ITEMS.map(item => (
              <div key={item.q} className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
