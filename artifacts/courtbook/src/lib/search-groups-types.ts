export interface SearchGroupResult {
  facilityId: number;
  facilityName: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cancellationPolicy: "standard" | "strict";
  sport: string;
  courtCount: number;
  startingPrice: number | null;
  photos: string[];
  isPromoted: boolean;
  groupRating: number | null;
  isIndoorAvailable: boolean;
  isOutdoorAvailable: boolean;
}

export interface GroupDetailCourt {
  id: number;
  name: string;
  surface: string | null;
  isIndoor: boolean;
  maxPlayers: number;
  effectiveHourlyPrice: number;
  rating: number | null;
  photos: string[];
  amenities: string[];
  workingHours: string | null;
  hasSmartLock: boolean;
  accessInstructions: string | null;
}

export interface GroupDetailFacility {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  cancellationPolicy: "standard" | "strict";
  businessHours: string | null;
  phone: string | null;
  email: string | null;
  equipment: string[];
  socialFacebook: string | null;
  socialInstagram: string | null;
  socialWhatsapp: string | null;
}

export interface GroupMembership {
  id: number;
  name: string;
  description: string | null;
  pricePerYear: number;
  pricePerMonth: number | null;
  weeklySlots: number;
  discountPercent: number | null;
  conditions: string | null;
}

export interface GroupOpenGame {
  id: number;
  datetime: string;
  durationMinutes: number;
  joinedCount: number;
  playersNeeded: number;
  pricePerSlot: number;
  splitInviteToken: string;
  minSkillLevel: number | null;
  maxSkillLevel: number | null;
  creatorName: string;
}

export interface GroupDetailResult {
  facility: GroupDetailFacility;
  sport: string;
  courtCount: number;
  startingPrice: number | null;
  groupRating: number | null;
  mergedPhotos: string[];
  mergedAmenities: string[];
  surfacesAvailable: string[];
  isIndoorAvailable: boolean;
  isOutdoorAvailable: boolean;
  availableSports: string[];
  courts: GroupDetailCourt[];
  memberships: GroupMembership[];
  lastBookedAt: string | null;
  openGames: GroupOpenGame[];
}

export interface SearchGroupFilters {
  sport?: string;
  city?: string;
  surface?: string;
  condition?: string;
  isIndoor?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export function buildDetailHref(group: SearchGroupResult, filters: SearchGroupFilters): string {
  const p = new URLSearchParams({ sport: group.sport });
  if (filters.isIndoor !== undefined) p.set("isIndoor", String(filters.isIndoor));
  if (filters.surface)   p.set("surface",   filters.surface);
  if (filters.condition) p.set("condition", filters.condition);
  return `/facility/${group.facilityId}?${p.toString()}`;
}
