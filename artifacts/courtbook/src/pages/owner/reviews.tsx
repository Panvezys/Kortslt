import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OwnerLayout } from "@/components/owner-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";
import { courtGroupHref } from "@/lib/court-links";
import { Star, MessageSquare, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

type ReviewStatus = "published" | "hidden" | "flagged";

interface OwnerReviewItem {
  id: number;
  courtId: number;
  courtName: string;
  courtType?: string | null;
  facilityId?: number | null;
  rating: number;
  comment: string | null;
  reviewerName: string;
  status: ReviewStatus;
  ownerReplyText: string | null;
  ownerReplyCreatedAt: string | null;
  createdAt: string;
}

interface OwnerReviewsResponse {
  items: OwnerReviewItem[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  published: "Viešas",
  hidden: "Paslėptas",
  flagged: "Pažymėtas",
};

const STATUS_CLASS: Record<ReviewStatus, string> = {
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  hidden: "bg-muted text-muted-foreground border-border",
  flagged: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

function ReplyDialog({
  reviewId,
  initialText,
  open,
  onClose,
}: {
  reviewId: number | null;
  initialText: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState(initialText ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setText(initialText ?? "");
  }, [open, initialText, reviewId]);

  const submit = async () => {
    if (reviewId == null || submitting) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      await customFetch(`${API}/owner/court-reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      toast({ title: "Atsakymas išsiųstas" });
      qc.invalidateQueries({ queryKey: ["owner-court-reviews"] });
      qc.invalidateQueries({ queryKey: ["court-reviews"] });
      onClose();
    } catch (err) {
      const msg = (err as { data?: { error?: string }; message?: string })?.data?.error
        ?? (err as { message?: string })?.message
        ?? "Nepavyko išsiųsti atsakymo";
      toast({ title: "Klaida", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const clear = useMutation({
    mutationFn: async () => {
      if (reviewId == null) return;
      await customFetch(`${API}/owner/court-reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: null }),
      });
    },
    onSuccess: () => {
      toast({ title: "Atsakymas pašalintas" });
      qc.invalidateQueries({ queryKey: ["owner-court-reviews"] });
      qc.invalidateQueries({ queryKey: ["court-reviews"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Klaida", description: err.message, variant: "destructive" });
    },
  });

  const isEditing = (initialText ?? "").length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Redaguoti atsakymą" : "Atsakyti į atsiliepimą"}</DialogTitle>
          <DialogDescription>
            Atsakymas bus matomas viešai kartu su atsiliepimu aikštelės puslapyje.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          placeholder="Ačiū už atsiliepimą..."
        />
        <DialogFooter className="gap-2">
          {isEditing && (
            <Button
              variant="ghost"
              onClick={() => clear.mutate()}
              disabled={clear.isPending || submitting}
              className="text-destructive hover:text-destructive mr-auto"
            >
              Pašalinti
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Atšaukti
          </Button>
          <Button onClick={submit} disabled={text.trim().length === 0 || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isEditing ? "Išsaugoti" : "Atsakyti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ r, onReply }: { r: OwnerReviewItem; onReply: () => void }) {
  const hasReply = (r.ownerReplyText ?? "").length > 0;
  return (
    <li className="border rounded-2xl bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium">{r.reviewerName}</span>
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLASS[r.status]}`}
              title={`Status: ${r.status}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <Link href={courtGroupHref({ id: r.courtId, facilityId: r.facilityId, type: r.courtType })} className="hover:underline">
              {r.courtName}
            </Link>
            {" · "}
            {new Date(r.createdAt).toLocaleDateString("lt-LT", { year: "numeric", month: "short", day: "numeric" })}
          </p>
        </div>
      </div>
      {r.comment && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{r.comment}</p>
      )}
      {hasReply ? (
        <div className="rounded-lg bg-muted/40 border-l-2 border-primary/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">Jūsų atsakymas</span>
            <button
              type="button"
              onClick={onReply}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Redaguoti
            </button>
          </div>
          <p className="text-sm text-foreground whitespace-pre-line">{r.ownerReplyText}</p>
          {r.ownerReplyCreatedAt && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(r.ownerReplyCreatedAt).toLocaleDateString("lt-LT", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={onReply} className="gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Atsakyti
        </Button>
      )}
    </li>
  );
}

export default function OwnerReviewsPage() {
  const [replyTarget, setReplyTarget] = useState<{ id: number; text: string | null } | null>(null);

  const { data, isLoading } = useQuery<OwnerReviewsResponse>({
    queryKey: ["owner-court-reviews"],
    queryFn: () => customFetch<OwnerReviewsResponse>(`${API}/owner/court-reviews`),
  });

  const items = data?.items ?? [];

  return (
    <OwnerLayout title="Atsiliepimai">
      <div className="px-4 md:px-6 py-6 max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Atsiliepimai</h1>
          <p className="text-sm text-muted-foreground">
            Atsiliepimai apie visas jūsų aikšteles. Atsakymai matomi viešai aikštelės puslapyje.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-card px-6 py-12 text-center">
            <Star className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Atsiliepimų dar nėra.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <ReviewRow
                key={r.id}
                r={r}
                onReply={() => setReplyTarget({ id: r.id, text: r.ownerReplyText })}
              />
            ))}
          </ul>
        )}
      </div>

      <ReplyDialog
        open={replyTarget != null}
        reviewId={replyTarget?.id ?? null}
        initialText={replyTarget?.text ?? null}
        onClose={() => setReplyTarget(null)}
      />
    </OwnerLayout>
  );
}
