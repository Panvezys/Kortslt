import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <Layout>
      <div className="container flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          <XCircle className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
          <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-8">
            Your payment was cancelled. Your booking has not been confirmed and no charges were made.
          </p>
          <div className="flex gap-4">
            <Link href="/courts" className="w-full block">
              <Button className="w-full">Browse Courts</Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
