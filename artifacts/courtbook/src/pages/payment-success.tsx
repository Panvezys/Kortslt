import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useConfirmPayment } from "@workspace/api-client-react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const confirmPayment = useConfirmPayment();
  const hasConfirmed = useRef(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("session_id");

    if (sessionId && !hasConfirmed.current) {
      hasConfirmed.current = true;
      confirmPayment.mutate({ data: { sessionId } });
    }
  }, [confirmPayment.mutate]);

  return (
    <Layout>
      <div className="container flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-lg">
          {confirmPayment.isPending ? (
            <>
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-6" />
              <h1 className="text-2xl font-bold mb-2">Confirming Payment...</h1>
              <p className="text-muted-foreground">Please wait while we verify your booking.</p>
            </>
          ) : confirmPayment.isError ? (
            <>
              <XCircle className="w-16 h-16 mx-auto text-destructive mb-6" />
              <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
              <p className="text-muted-foreground mb-8">We couldn't verify your payment. Please contact support.</p>
              <Button onClick={() => setLocation("/bookings")} className="w-full">
                View My Bookings
              </Button>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-6" />
              <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
              <p className="text-muted-foreground mb-8">
                Your payment was successful and your court is booked. 
                We've sent a confirmation email with details.
              </p>
              <div className="flex gap-4">
                <Button onClick={() => setLocation("/bookings")} className="flex-1">
                  View Bookings
                </Button>
                <Button variant="outline" onClick={() => setLocation("/courts")} className="flex-1">
                  Book Another
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
