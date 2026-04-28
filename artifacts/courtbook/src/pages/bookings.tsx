import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListBookings, useCancelBooking, useCreateReview, getListBookingsQueryKey, customFetch, useGetRefundPreview } from "@workspace/api-client-react";
import { format, parseISO, isFuture, isToday } from "date-fns";
import { lt } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, XCircle, Star, MapPin, Calendar, ChevronRight, Image as ImageIcon, X, Loader2, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";

type SortKey = "dateAsc" | "dateDesc" | "createdDesc" | "createdAsc";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_URL = `${BASE_URL}/api`;

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
              star <= (hovered || value) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

interface RateDialogProps {
  open: boolean;
  onClose: () => void;
  booking: { id: number; courtName?: string; courtId: number; customerName: string } | null;
}

function RateDialog({ open, onClose, booking }: RateDialogProps) {
  const t = useT();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createReview = useCreateReview();
  const { toast } = useToast();

  const ratingLabels = ["", t("rating.1"), t("rating.2"), t("rating.3"), t("rating.4"), t("rating.5")];

  const handlePhotoUpload = async (files: FileList) => {
    const remaining = 3 - photos.length;
    if (remaining <= 0) return;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`${API_URL}/upload/court-image`, { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          setPhotos(prev => [...prev, data.path].slice(0, 3));
        }
      }
    } catch {
      toast({ title: "Klaida", description: "Nepavyko įkelti nuotraukos", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

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
          photos: photos.length > 0 ? photos : undefined,
        },
      });
      toast({ title: "Ačiū už atsiliepimą! 🌟", description: "Jūsų įvertinimas išsaugotas." });
      setRating(0);
      setReviewText("");
      setPhotos([]);
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
          <DialogTitle>{t("bookings.rateDialog.title")}</DialogTitle>
          <DialogDescription>{booking?.courtName || `#${booking?.courtId}`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="text-center">
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && <p className="text-sm font-medium mt-2 text-primary">{ratingLabels[rating]}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t("bookings.rateDialog.commentLabel")}</Label>
            <Textarea
              placeholder={t("bookings.rateDialog.commentPlaceholder")}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Nuotraukos (iki 3)
            </Label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                  <img src={`${BASE_URL}/${p}`} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  <span className="text-[10px]">{uploading ? "Keliama..." : "Pridėti"}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) handlePhotoUpload(e.target.files); e.target.value = ""; }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("bookings.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || createReview.isPending}>
            {createReview.isPending ? "..." : t("bookings.rateDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BookingItem = {
  id: number;
  courtId: number;
  courtName?: string;
  customerName: string;
  customerEmail: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt?: string;
  refundAmount?: number;
};

function CancelBookingDialog({
  bookingId,
  onClose,
  onConfirmed,
}: {
  bookingId: number | null;
  onClose: () => void;
  onConfirmed: (id: number) => Promise<void>;
}) {
  const t = useT();
  const open = bookingId !== null;
  const { data: preview, isLoading } = useGetRefundPreview(bookingId ?? 0, {
    query: { enabled: open },
  });
  const [submitting, setSubmitting] = useState(false);

  const hours = preview?.hoursBeforeStart ?? 0;
  const refundEur = preview?.refundAmount ?? 0;
  const isFreeSlot = (preview?.totalPrice ?? 0) <= 0;
  const isLate = !preview?.refundable;
  const tierKey = (preview?.refundPercent ?? 0) >= 80
    ? "bookings.cancel.tier80"
    : (preview?.refundPercent ?? 0) >= 50
      ? "bookings.cancel.tier50"
      : "bookings.cancel.tier0";

  const handleConfirm = async () => {
    if (!bookingId) return;
    setSubmitting(true);
    try {
      await onConfirmed(bookingId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.cancel.title")}</DialogTitle>
          <DialogDescription>
            {isLoading || !preview
              ? t("bookings.cancel.loading")
              : preview.canCancel
              ? isFreeSlot
                ? t("bookings.cancel.freeSlot").replace("{hours}", hours.toFixed(1))
                : t(tierKey)
              : preview.reason ?? t("bookings.cancel.notAllowed")}
          </DialogDescription>
        </DialogHeader>

        {preview && preview.canCancel && !isFreeSlot && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("bookings.cancel.totalPaid")}</span>
              <span className="font-medium">€{preview.totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("bookings.cancel.refundPercent")}</span>
              <span className="font-medium">{preview.refundPercent}%</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="font-semibold">{t("bookings.cancel.refundAmount")}</span>
              <span className={`font-bold ${isLate ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                €{refundEur.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("bookings.cancel.policyShort")}</p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("bookings.cancel.keep")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !preview?.canCancel}
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {t("bookings.cancel.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getStatusBadge(status: string, t: ReturnType<typeof useT>, refundAmount?: number) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />{t("bookings.status.confirmed")}</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs"><Clock className="w-3 h-3 mr-1" />{t("bookings.status.pending")}</Badge>;
    case "cancelled": {
      const r = Number(refundAmount ?? 0);
      const label = r > 0
        ? `${t("bookings.status.cancelled")} · ${t("bookings.cancel.refunded")} €${r.toFixed(2)}`
        : `${t("bookings.status.cancelled")} · ${t("bookings.cancel.noRefund")}`;
      return <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />{label}</Badge>;
    }
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

function BookingCard({
  booking,
  isUpcoming,
  onRate,
  onCancel,
  cancelling,
}: {
  booking: BookingItem;
  isUpcoming: boolean;
  onRate: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const t = useT();
  const [, setLocation] = useLocation();

  const dateLabel = format(booking.date, "yyyy-MM-dd");
  const dayLabel = format(booking.date, "EEEE", { locale: lt });
  const createdLabel = booking.createdAt
    ? format(new Date(booking.createdAt), "yyyy-MM-dd HH:mm")
    : null;

  return (
    <div
      className="bg-card border rounded-xl p-4 space-y-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
      onClick={() => setLocation(`/bookings/${booking.id}`)}
    >
      {/* Top row: court name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
            {booking.courtName || `Kortas #${booking.courtId}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {getStatusBadge(booking.status, t, booking.refundAmount)}
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
      </div>

      {/* Date/time + price row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span className="capitalize">{dayLabel},</span>
          <span>{dateLabel}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {booking.startTime} – {booking.endTime}
        </span>
      </div>
      {createdLabel && (
        <div className="text-xs text-muted-foreground/70">
          {t("bookings.bookedAt")}: {createdLabel}
        </div>
      )}

      {/* Price + actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <span className="text-sm font-semibold">
          {booking.totalPrice > 0 ? `€${Number(booking.totalPrice).toFixed(2)}` : "Nemokama"}
        </span>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          {!isUpcoming && booking.status === "confirmed" && (
            <Button
              variant="outline"
              size="sm"
              className="text-yellow-600 hover:text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:border-yellow-900 dark:hover:bg-yellow-900/20 gap-1 h-8 text-xs"
              onClick={onRate}
            >
              <Star className="h-3 w-3" />
              {t("bookings.rate")}
            </Button>
          )}
          {isUpcoming && booking.status === "confirmed" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
              onClick={onCancel}
              disabled={cancelling}
            >
              {t("bookings.cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const t = useT();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [sortKey, setSortKey] = useState<SortKey>("dateAsc");
  const [ratingBooking, setRatingBooking] = useState<{
    id: number; courtName?: string; courtId: number; customerName: string;
  } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const { data: bookings, isLoading } = useListBookings({});
  const cancelBooking = useCancelBooking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCancelConfirmed = async (id: number) => {
    try {
      const result = await cancelBooking.mutateAsync({ id });
      const refunded = Number((result as any)?.refundAmount ?? 0);
      toast({
        title: t("bookings.status.cancelled"),
        description: refunded > 0
          ? t("bookings.cancel.toastRefunded").replace("{amount}", refunded.toFixed(2))
          : t("bookings.cancel.toastNoRefund"),
      });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["court-activity"] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.some(
          (k) => typeof k === "string" && k.includes("/availability"),
        ),
      });
    } catch {
      toast({ title: "Klaida", variant: "destructive" });
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = (bookings ?? []).slice().sort((a, b) => {
    if (sortKey === "createdDesc" || sortKey === "createdAsc") {
      const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortKey === "createdDesc" ? cb - ca : ca - cb;
    }
    const da = new Date(a.date).getTime();
    const db2 = new Date(b.date).getTime();
    if (da !== db2) return sortKey === "dateAsc" ? da - db2 : db2 - da;
    return sortKey === "dateAsc"
      ? a.startTime.localeCompare(b.startTime)
      : b.startTime.localeCompare(a.startTime);
  });

  const localCancelledIds: number[] = (() => {
    try { return JSON.parse(sessionStorage.getItem("cancelledBookingIds") ?? "[]"); } catch { return []; }
  })();
  const upcomingBookings = sorted.filter(b => {
    const d = new Date(b.date);
    d.setHours(0, 0, 0, 0);
    return d >= today && b.status !== "cancelled" && !localCancelledIds.includes(b.id);
  });

  const pastBookings = sorted.filter(b => {
    const d = new Date(b.date);
    d.setHours(0, 0, 0, 0);
    return d < today || b.status === "cancelled";
  });

  const displayed = tab === "upcoming" ? upcomingBookings : pastBookings;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("bookings.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("bookings.subtitle")}</p>
        </div>

        {/* Tabs + Sort */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex bg-muted p-1 rounded-lg w-fit">
            <button
              onClick={() => setTab("upcoming")}
              className={`px-5 py-2 text-sm font-medium rounded-md transition-colors relative ${
                tab === "upcoming" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ateinančios
              {upcomingBookings.length > 0 && !isLoading && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {upcomingBookings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("past")}
              className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === "past" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Praeitos
            </button>
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-9 w-auto min-w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dateAsc">{t("bookings.sort.dateAsc")}</SelectItem>
              <SelectItem value="dateDesc">{t("bookings.sort.dateDesc")}</SelectItem>
              <SelectItem value="createdDesc">{t("bookings.sort.createdDesc")}</SelectItem>
              <SelectItem value="createdAsc">{t("bookings.sort.createdAsc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{tab === "upcoming" ? "Nėra ateinančių rezervacijų" : "Nėra praeities rezervacijų"}</p>
              <p className="text-sm mt-1">
                {tab === "upcoming" ? "Rezervuokite aikštelę ir ji pasirodys čia." : "Jūsų praeitos rezervacijos bus rodomos čia."}
              </p>
            </div>
          ) : (
            displayed.map((booking) => {
              const d = new Date(booking.date);
              d.setHours(0, 0, 0, 0);
              const isUpcoming = d >= today && booking.status !== "cancelled";
              return (
                <BookingCard
                  key={booking.id}
                  booking={{
                    ...booking,
                    date: new Date(booking.date),
                    refundAmount: Number((booking as any).refundAmount ?? 0),
                  }}
                  isUpcoming={isUpcoming}
                  onRate={() => setRatingBooking({
                    id: booking.id,
                    courtName: booking.courtName ?? undefined,
                    courtId: booking.courtId,
                    customerName: booking.customerName,
                  })}
                  onCancel={() => setCancelTargetId(booking.id)}
                  cancelling={cancelBooking.isPending}
                />
              );
            })
          )}
        </div>
      </div>

      <RateDialog
        open={!!ratingBooking}
        onClose={() => setRatingBooking(null)}
        booking={ratingBooking}
      />

      <CancelBookingDialog
        bookingId={cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        onConfirmed={handleCancelConfirmed}
      />
    </Layout>
  );
}
