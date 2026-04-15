import {
  Lightbulb, ShowerHead, DoorOpen, Droplets, Car, Bath,
  Wifi, Coffee, HeartPulse, Thermometer, Wind, Lock, Flame, CheckCircle2,
} from "lucide-react";

export type AmenityIconType = typeof CheckCircle2;

export const AMENITY_META: Record<string, { label: string; icon: AmenityIconType }> = {
  floodlights:      { label: "Prožektoriai",           icon: Lightbulb },
  showers:          { label: "Dušai",                  icon: ShowerHead },
  changing_rooms:   { label: "Persirengimo kambariai", icon: DoorOpen },
  water_station:    { label: "Vandens stotis",         icon: Droplets },
  parking:          { label: "Parkavimas",             icon: Car },
  toilets:          { label: "Tualetai",               icon: Bath },
  wifi:             { label: "Wi-Fi",                  icon: Wifi },
  cafe:             { label: "Kavinė / Baras",         icon: Coffee },
  first_aid:        { label: "Pirmoji pagalba",        icon: HeartPulse },
  heating:          { label: "Šildymas",               icon: Thermometer },
  air_conditioning: { label: "Oro kondicionierius",    icon: Wind },
  lockers:          { label: "Spintelės",              icon: Lock },
  sauna:            { label: "Pirtis",                 icon: Flame },
  // Lithuanian-word fallbacks (legacy stored values)
  Pirtis:           { label: "Pirtis",                 icon: Flame },
  "Kavinė":         { label: "Kavinė",                 icon: Coffee },
  Dušai:            { label: "Dušai",                  icon: ShowerHead },
  Parkingas:        { label: "Parkavimas",             icon: Car },
  Apšvietimas:      { label: "Prožektoriai",           icon: Lightbulb },
  Tualetai:         { label: "Tualetai",               icon: Bath },
  "Wi-Fi":          { label: "Wi-Fi",                  icon: Wifi },
  "Šildymas":       { label: "Šildymas",               icon: Thermometer },
  Spintelės:        { label: "Spintelės",              icon: Lock },
};

export const AMENITY_FALLBACK_ICON = CheckCircle2;

export function getAmenityMeta(id: string): { label: string; icon: AmenityIconType } {
  return AMENITY_META[id] ?? { label: id, icon: AMENITY_FALLBACK_ICON };
}
