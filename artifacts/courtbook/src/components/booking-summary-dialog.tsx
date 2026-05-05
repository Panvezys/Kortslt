import { format } from "date-fns";
import { lt } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CreditCard, Euro, Loader2, ShoppingBag, Users } from "lucide-react";
import { getSportLabel } from "@/components/sport-icon";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const EQUIPMENT_ICONS: Record<string, string> = {
  "Raketė": "🎾",
  "Teniso raketė": "🎾",
  "Kamuliukai": "⚪",
  "Kamuoliukas": "⚪",
  "Rankšluostis": "🧺",
  "Badmintono raketė": "🏸",
  "Volanas": "🏸",
  "Kamuolys": "🏐",
  "Futbolo kamuolys": "⚽",
  "Krepšinio kamuolys": "🏀",
  "Tinklinio kamuolys": "🏐",
};

export interface BookingSummarySlot {
  startTime: string;
  endTime: string;
  durationLabel: string;
  courtPrice: number;
  totalPrice: number;
  slotCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtName: string;
  courtImageUrl?: string | null;
  sport?: string | null;
  date: Date;
  slotRange: BookingSummarySlot;
  selectedEquipment: Map<string, number>;
  availableEquipment: Array<{ name: string; pricePerSlot: number; stock: number }>;
  splitEnabled?: boolean;
  splitCount?: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function BookingSummaryDialog({
  open,
  onOpenChange,
  courtName,
  courtImageUrl,
  sport,
  date,
  slotRange,
  selectedEquipment,
  availableEquipment,
  splitEnabled = false,
  splitCount = 4,
  onConfirm,
  isPending,
}: Props) {
  const dateLabel = format(date, "EEEE, yyyy-MM-dd", { locale: lt });
  const isFree = slotRange.totalPrice <= 0;

  const equipmentItems: Array<{ name: string; qty: number; unitPrice: number; subtotal: number }> = [];
  selectedEquipment.forEach((qty, name) => {
    if (qty <= 0) return;
    const item = availableEquipment.find(e => e.name === name);
    if (!item) return;
    const subtotal = item.pricePerSlot * qty * Math.max(1, slotRange.slotCount);
    equipmentItems.push({ name, qty, unitPrice: item.pricePerSlot, subtotal });
  });

  const pricePerPerson = splitEnabled ? slotRange.totalPrice / splitCount : slotRange.totalPrice;

  const imageUrl = courtImageUrl
    ? (courtImageUrl.startsWith("http") ? courtImageUrl : `${BASE}/${courtImageUrl}`)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary shrink-0" />
            Rezervacijos santrauka
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh]">
          {/* Court image */}
          {imageUrl && (
            <div className="h-36 overflow-hidden mx-5 rounded-xl mb-4">
              <img src={imageUrl} alt={courtName} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Court info */}
          <div className="px-5 mb-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-base leading-snug">{courtName}</h2>
              {sport && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {getSportLabel(sport)}
                </Badge>
              )}
            </div>
          </div>

          {/* Date & time */}
          <div className="px-5 space-y-2.5 mb-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="capitalize font-medium">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{slotRange.startTime} – {slotRange.endTime}</span>
              <span className="text-muted-foreground text-xs">{slotRange.durationLabel}</span>
            </div>
          </div>

          <Separator className="mx-5 w-auto" style={{ width: "calc(100% - 2.5rem)" }} />

          {/* Price breakdown */}
          <div className="px-5 py-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Kainodara</p>

            {/* Court hire */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aikštelės nuoma</span>
              <span className="font-medium">{slotRange.courtPrice.toFixed(2)} €</span>
            </div>

            {/* Equipment items */}
            {equipmentItems.length > 0 && (
              <>
                {equipmentItems.map((item) => {
                  const icon = EQUIPMENT_ICONS[item.name] ?? "📦";
                  return (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {icon} {item.name}
                        {item.qty > 1 && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md">×{item.qty}</span>}
                      </span>
                      <span className="font-medium">{item.subtotal.toFixed(2)} €</span>
                    </div>
                  );
                })}
              </>
            )}

            <Separator />

            {/* Split breakdown */}
            {splitEnabled ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Visa kaina ({splitCount} žaidėjai)
                  </span>
                  <span className="font-medium">{slotRange.totalPrice.toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Euro className="w-3.5 h-3.5 text-primary" />
                    Jūsų dalis (1/{splitCount})
                  </span>
                  <span className="text-lg font-bold text-primary">{pricePerPerson.toFixed(2)} €</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5 text-primary" />
                  Iš viso
                </span>
                <span className="text-xl font-bold text-primary">{slotRange.totalPrice.toFixed(2)} €</span>
              </div>
            )}
          </div>

          {/* Policy note */}
          {!isFree && (
            <div className="px-5 pb-4">
              <p className="text-[11px] text-muted-foreground/80 leading-snug bg-muted/60 rounded-lg px-3 py-2">
                Rezervuodami sutinkate su atšaukimo sąlygomis: už atšaukimą likus daugiau nei 24 val. grąžinama 80%, likus 12–24 val. — 50%, mažiau nei 12 val. — negrąžinama.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-card gap-2 flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="flex-1"
          >
            Grįžti
          </Button>
          <Button
            className="button-primary flex-1 font-semibold gap-2"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kraunama…</>
            ) : isFree ? (
              "Patvirtinti"
            ) : splitEnabled ? (
              <><Euro className="w-4 h-4" /> Mokėti {pricePerPerson.toFixed(2)} €</>
            ) : (
              <><Euro className="w-4 h-4" /> Mokėti {slotRange.totalPrice.toFixed(2)} €</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
