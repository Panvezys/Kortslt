import { Layout } from "@/components/layout";
import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Kontaktai</h1>
          <p className="text-muted-foreground mb-10">
            Susisiekite su mumis bet kuriuo iš žemiau nurodytų būdų — atsakysime per 1–2 darbo dienas.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <a href="mailto:hello@korts.lt" className="rounded-2xl border bg-card p-5 flex flex-col gap-2 hover:border-primary transition-colors">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">El. paštas</h3>
              <p className="text-sm text-muted-foreground break-all">hello@korts.lt</p>
            </a>
            <a href="tel:+37060000000" className="rounded-2xl border bg-card p-5 flex flex-col gap-2 hover:border-primary transition-colors">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Telefonas</h3>
              <p className="text-sm text-muted-foreground">+370 600 00000</p>
            </a>
            <div className="rounded-2xl border bg-card p-5 flex flex-col gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Adresas</h3>
              <p className="text-sm text-muted-foreground">Vilnius, Lietuva</p>
            </div>
          </div>
          <div className="mt-12 rounded-2xl border bg-muted/30 p-6">
            <h2 className="font-semibold mb-1">UAB Korts Digital</h2>
            <p className="text-sm text-muted-foreground">Įm. kodas 306 214 857 · PVM LT100012345678</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
