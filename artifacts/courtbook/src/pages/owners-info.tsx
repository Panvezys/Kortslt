import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, CreditCard, BarChart3, Bell, Building2 } from "lucide-react";

export default function OwnersInfoPage() {
  return (
    <Layout>
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest mb-6">
            <Building2 className="h-3.5 w-3.5" />
            Aikštelių savininkams
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
            Turite sportinę aikštelę? <span className="text-primary">Uždirbkite daugiau.</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mb-10 leading-relaxed">
            Prisijunkite prie korts.lt partnerių tinklo. Jūsų skydelyje matysite viską —
            nuo rezervacijų su klientų vardais iki Stripe mokėjimų ir biudžeto analizės.
          </p>

          <ul className="space-y-4 mb-10">
            {[
              { icon: CalendarDays, text: "Rezervacijų tvarkaraštis su klientų vardais realiuoju laiku" },
              { icon: CreditCard, text: "Stripe mokėjimai — transakcijų istorija ir automatiniai išmokėjimai" },
              { icon: BarChart3, text: "Biudžeto ir pajamų valdymas su augimu po mėnesio" },
              { icon: Bell, text: "Momentiniai pranešimai apie naują rezervaciją ar atšaukimą" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-sm md:text-base text-foreground leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Link href="/list-your-court">
              <Button size="lg" className="gap-2">
                Registruoti aikštelę <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">Susisiekti su komanda</Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
