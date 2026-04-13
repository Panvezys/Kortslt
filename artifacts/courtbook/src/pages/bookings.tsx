import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListBookings, useCancelBooking, useCreateReview, getListBookingsQueryKey } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, XCircle, Star } from "lucide-react";
import { ListBookingsStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`h-9 w-9 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const ratingLabels = ["", "Bloga", "Patenkinama", "Gera", "Puiki", "Nuostabi"];

interface RateDialogProps {
  open: boolean;
  onClose: () => void;
  booking: { id: number; courtName?: string; courtId: number; customerName: string } | null;
}

function RateDialog({ open, onClose, booking }: RateDialogProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const createReview = useCreateReview();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!booking || rating === 0) return;
    try {
      await createReview.mutateAsync({
        id: booking.courtId,
        data: {
          bookingId: booking.id,
          rating,
          reviewText: reviewText.trim() || undefined,
          reviewerName: booking.customerName,
        },
      });
      toast({ title: "Ačiū už atsiliepimą! 🌟", description: "Jūsų įvertinimas išsaugotas." });
      setRating(0);
      setReviewText("");
      onClose();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Nepavyko išsaugoti atsiliepimo.";
      toast({ title: "Klaida", description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Įvertinkite kortą</DialogTitle>
          <DialogDescription>
            {booking?.courtName || `Kortas #${booking?.courtId}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-sm font-medium mt-2 text-primary">{ratingLabels[rating]}</p>
            )}
            {rating === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Spustelėkite žvaigždutę norėdami įvertinti</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Atsiliepimas (neprivaloma)</Label>
            <Textarea
              placeholder="Papasakokite apie savo patirtį..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Atšaukti</Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || createReview.isPending}
          >
            {createReview.isPending ? "Saugoma..." : "Išsaugoti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Bookings() {
  const [statusFilter, setStatusFilter] = useState<ListBookingsStatus | "all">("all");
  const [ratingBooking, setRatingBooking] = useState<{
    id: number;
    courtName?: string;
    courtId: number;
    customerName: string;
  } | null>(null);

  const queryStatus = statusFilter === "all" ? undefined : statusFilter;

  const { data: bookings, isLoading } = useListBookings({ status: queryStatus });

  const cancelBooking = useCancelBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCancel = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await cancelBooking.mutateAsync({ id });
      toast({ title: "Rezervacija atšaukta" });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    } catch {
      toast({ title: "Nepavyko atšaukti rezervacijos", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Patvirtinta</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Laukiama</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Atšaukta</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mano rezervacijos</h1>
            <p className="text-muted-foreground mt-1">Valdykite savo kortų rezervacijas.</p>
          </div>

          <div className="flex bg-muted p-1 rounded-lg">
            {(["all", "confirmed", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === f ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Visos" : f === "confirmed" ? "Patvirtintos" : "Laukiančios"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Kortas</TableHead>
                <TableHead>Data ir laikas</TableHead>
                <TableHead>Klientas</TableHead>
                <TableHead>Kaina</TableHead>
                <TableHead>Statusas</TableHead>
                <TableHead className="text-right">Veiksmai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : bookings && bookings.length > 0 ? (
                bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      <Link href={`/courts/${booking.courtId}`} className="hover:text-primary hover:underline">
                        {booking.courtName || `Kortas #${booking.courtId}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{format(parseISO(booking.date), "yyyy MMMM d")}</span>
                        <span className="text-xs text-muted-foreground">{booking.startTime} - {booking.endTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{booking.customerName}</span>
                        <span className="text-xs text-muted-foreground">{booking.customerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{booking.totalPrice}€</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {booking.status === "confirmed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:bg-yellow-50 gap-1"
                            onClick={() =>
                              setRatingBooking({
                                id: booking.id,
                                courtName: booking.courtName ?? undefined,
                                courtId: booking.courtId,
                                customerName: booking.customerName,
                              })
                            }
                          >
                            <Star className="h-3 w-3" />
                            Vertinti
                          </Button>
                        )}
                        {booking.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleCancel(booking.id)}
                            disabled={cancelBooking.isPending}
                          >
                            Atšaukti
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Rezervacijų nerasta.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RateDialog
        open={!!ratingBooking}
        onClose={() => setRatingBooking(null)}
        booking={ratingBooking}
      />
    </Layout>
  );
}
