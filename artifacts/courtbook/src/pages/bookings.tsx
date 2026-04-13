import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListBookings, useCancelBooking, getListBookingsQueryKey } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ListBookingsStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";

export default function Bookings() {
  const [statusFilter, setStatusFilter] = useState<ListBookingsStatus | "all">("all");
  
  const queryStatus = statusFilter === "all" ? undefined : statusFilter;
  
  const { data: bookings, isLoading } = useListBookings({
    status: queryStatus
  });

  const cancelBooking = useCancelBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCancel = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      await cancelBooking.mutateAsync({ id });
      toast({ title: "Booking cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    } catch (error) {
      toast({ title: "Failed to cancel booking", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Confirmed</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1"/> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
            <p className="text-muted-foreground mt-1">Manage your upcoming and past court reservations.</p>
          </div>
          
          <div className="flex bg-muted p-1 rounded-lg">
            <button 
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            <button 
              onClick={() => setStatusFilter("confirmed")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === "confirmed" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Confirmed
            </button>
            <button 
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === "pending" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pending
            </button>
          </div>
        </div>

        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Court</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                        {booking.courtName || `Court #${booking.courtId}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{format(parseISO(booking.date), "MMM d, yyyy")}</span>
                        <span className="text-xs text-muted-foreground">{booking.startTime} - {booking.endTime}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{booking.customerName}</span>
                        <span className="text-xs text-muted-foreground">{booking.customerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">${booking.totalPrice}</TableCell>
                    <TableCell>{getStatusBadge(booking.status)}</TableCell>
                    <TableCell className="text-right">
                      {booking.status !== "cancelled" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelBooking.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No bookings found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
