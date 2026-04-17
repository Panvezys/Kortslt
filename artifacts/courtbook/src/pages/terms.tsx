import { Layout } from "@/components/layout";

export default function TermsPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Naudojimo taisyklės</h1>
          <div className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4">
            <p>
              Naudodamiesi korts.lt platforma sutinkate rezervuoti atsakingai, laikytis
              aikštelės taisyklių ir gerbti kitus vartotojus.
            </p>
            <h2 className="text-xl font-semibold text-foreground">Paskyros</h2>
            <p>Esate atsakingi už savo paskyros saugumą ir veiksmus, atliktus iš jos.</p>
            <h2 className="text-xl font-semibold text-foreground">Rezervacijos ir atšaukimai</h2>
            <p>Atšaukimo sąlygas nustato kiekvienos aikštelės savininkas; jos rodomos prieš patvirtinant rezervaciją.</p>
            <h2 className="text-xl font-semibold text-foreground">Atsakomybė</h2>
            <p>Platforma jungia žaidėjus su aikštelių savininkais ir nėra atsakinga už paslaugas vietoje.</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
