import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetCourtQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

const SPORT_OPTIONS = [
  { value: "tennis", label: "Tenisas" },
  { value: "basketball", label: "Krepšinis" },
  { value: "padel", label: "Padelis" },
  { value: "football", label: "Futbolas" },
  { value: "badminton", label: "Badmintonas" },
  { value: "squash", label: "Skvoše" },
  { value: "table_tennis", label: "Stalo tenisas" },
  { value: "golf", label: "Golfas" },
  { value: "snooker", label: "Snukeris" },
  { value: "bowling", label: "Boulingas" },
];

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Puiki" },
  { value: "very_good", label: "Labai gera" },
  { value: "good", label: "Gera" },
  { value: "fair", label: "Patenkinama" },
];

function useUpdateCourt(courtId: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      customFetch(`/api/courts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courts"] });
      if (courtId !== undefined) qc.invalidateQueries({ queryKey: getGetCourtQueryKey(courtId) });
      qc.invalidateQueries({ queryKey: ["owner-facilities"] });
      qc.invalidateQueries({ queryKey: ["owner-courts"] });
    },
  });
}

export function CourtEditDialog({ court, open, onClose, showOwnerContext = true }: { court: any; open: boolean; onClose: () => void; showOwnerContext?: boolean; }) {
  const { toast } = useToast();
  const updateMutation = useUpdateCourt(court?.id);
  const [name, setName] = useState("");
  const [type, setType] = useState("tennis");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [peakPricePerHour, setPeakPricePerHour] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isIndoor, setIsIndoor] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [surface, setSurface] = useState("");
  const [condition, setCondition] = useState("good");

  useEffect(() => {
    if (!court) return;
    setName(court.name ?? "");
    setType(court.type ?? "tennis");
    setDescription(court.description ?? "");
    setAddress(court.address ?? "");
    setCity(court.city ?? "");
    setPostcode(court.postcode ?? "");
    setLatitude(court.latitude ?? 0);
    setLongitude(court.longitude ?? 0);
    setPricePerHour(court.pricePerHour ?? 0);
    setPeakPricePerHour(court.peakPricePerHour != null ? String(court.peakPricePerHour) : "");
    setImageUrl(court.imageUrl ?? "");
    setIsIndoor(court.isIndoor ?? false);
    setMaxPlayers(court.maxPlayers ?? 4);
    setSurface(court.surface ?? "");
    setCondition(court.condition ?? "good");
  }, [court]);

  if (!court) return null;

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: court.id,
        data: {
          name,
          type,
          description,
          address,
          city,
          postcode,
          latitude,
          longitude,
          pricePerHour: Number(pricePerHour),
          peakPricePerHour: peakPricePerHour !== "" ? Number(peakPricePerHour) : undefined,
          imageUrl: imageUrl || undefined,
          isIndoor,
          maxPlayers: Number(maxPlayers),
          surface: surface || undefined,
          condition,
          amenities: court.amenities ?? [],
          ownerName: court.ownerName,
          ownerEmail: court.ownerEmail,
          facilityId: court.facilityId,
          workingHours: court.workingHours,
          rentableItems: court.rentableItems,
          amenityPhotos: court.amenityPhotos,
          socialFacebook: court.socialFacebook,
          socialInstagram: court.socialInstagram,
          socialWhatsapp: court.socialWhatsapp,
          socialWebsite: court.socialWebsite,
          bufferMinutes: court.bufferMinutes ?? 0,
        },
      });
      toast({ title: "Aikštelė atnaujinta ✓" });
      onClose();
    } catch {
      toast({ title: "Klaida išsaugant", variant: "destructive" });
    }
  };

  const field = "space-y-1.5";
  const label = "block text-xs font-medium text-muted-foreground";
  const inp = "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Redaguoti aikštelę — <span className="text-muted-foreground font-normal text-sm">{court.name}</span>
          </DialogTitle>
        </DialogHeader>

        {showOwnerContext && (
          <div className="rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span><span className="font-medium text-foreground">Savininkas:</span> {court.ownerName}</span>
            <span><span className="font-medium text-foreground">El. paštas:</span> {court.ownerEmail}</span>
            <span><span className="font-medium text-foreground">ID:</span> {court.id}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className={field}><label className={label}>Pavadinimas *</label><input className={inp} value={name} onChange={e => setName(e.target.value)} /></div>
          <div className={field}><label className={label}>Sporto šaka *</label><select className={inp} value={type} onChange={e => setType(e.target.value)}>{SPORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className={`${field} sm:col-span-2`}><label className={label}>Aprašymas</label><textarea className={`${inp} min-h-[80px] resize-y`} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className={field}><label className={label}>Miestas *</label><input className={inp} value={city} onChange={e => setCity(e.target.value)} /></div>
          <div className={field}><label className={label}>Adresas *</label><input className={inp} value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div className={field}><label className={label}>Pašto kodas</label><input className={inp} value={postcode} onChange={e => setPostcode(e.target.value)} /></div>
          <div className={field}><label className={label}>Nuotraukos URL</label><input className={inp} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." /></div>
          <div className={field}><label className={label}>Kaina / val. (€) *</label><input className={inp} type="number" min={0} step={0.5} value={pricePerHour} onChange={e => setPricePerHour(Number(e.target.value))} /></div>
          <div className={field}><label className={label}>Piko valandų kaina / val. (€)</label><input className={inp} type="number" min={0} step={0.5} value={peakPricePerHour} placeholder="Palikite tuščią jei nėra" onChange={e => setPeakPricePerHour(e.target.value)} /></div>
          <div className={field}><label className={label}>Maks. žaidėjų</label><input className={inp} type="number" min={1} max={50} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} /></div>
          <div className={field}><label className={label}>Būklė</label><select className={inp} value={condition} onChange={e => setCondition(e.target.value)}>{CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className={field}><label className={label}>Dangos tipas</label><input className={inp} value={surface} onChange={e => setSurface(e.target.value)} placeholder="pvz. Kietoji, Žolė..." /></div>
          <div className={`${field} flex items-center gap-3 pt-5`}><input type="checkbox" id="isIndoor" checked={isIndoor} onChange={e => setIsIndoor(e.target.checked)} className="w-4 h-4 accent-primary" /><label htmlFor="isIndoor" className="text-sm font-medium cursor-pointer">Vidaus aikštelė</label></div>
          <div className={field}><label className={label}>Platuma (latitude)</label><input className={inp} type="number" step="any" value={latitude} onChange={e => setLatitude(Number(e.target.value))} /></div>
          <div className={field}><label className={label}>Ilguma (longitude)</label><input className={inp} type="number" step="any" value={longitude} onChange={e => setLongitude(Number(e.target.value))} /></div>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Atšaukti</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}><Pencil className="w-3.5 h-3.5 mr-1.5" />{updateMutation.isPending ? "Saugoma..." : "Išsaugoti pakeitimus"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
