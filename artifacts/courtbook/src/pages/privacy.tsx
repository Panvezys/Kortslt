import { Layout } from "@/components/layout";

export default function PrivacyPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Privatumo politika</h1>
          <div className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4">
            <p>
              Mes tvarkome tik tuos duomenis, kurių reikia rezervacijoms, paskyroms ir
              pranešimams. Duomenys nenaudojami neatskleistiems tikslams.
            </p>
            <h2 className="text-xl font-semibold text-foreground">Kokius duomenis renkame</h2>
            <p>Vardas, el. paštas, telefono numeris, rezervacijų istorija ir mokėjimų informacija.</p>
            <h2 className="text-xl font-semibold text-foreground">Kaip naudojame duomenis</h2>
            <p>Rezervacijoms tvarkyti, klientų aptarnavimui ir paslaugos tobulinimui.</p>
            <h2 className="text-xl font-semibold text-foreground">Jūsų teisės</h2>
            <p>
              Galite bet kada peržiūrėti, atnaujinti arba ištrinti savo paskyros duomenis.
              Klausimais kreipkitės: hello@korts.lt
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
