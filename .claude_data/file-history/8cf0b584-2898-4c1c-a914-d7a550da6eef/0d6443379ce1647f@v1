import { z as zod } from "zod";
import { OptionalEmailString, OptionalPhoneString } from "./validators";

export const FacilityItem = zod.object({
  id: zod.number(),
  name: zod.string(),
  description: zod.string().optional(),
  ownerUserId: zod.string(),
  companyName: zod.string().optional(),
  registrationCode: zod.string().optional(),
  address: zod.string().optional(),
  city: zod.string().optional(),
  phone: zod.string().optional(),
  email: zod.string().optional(),
  verificationStatus: zod.string().optional(),
  verificationDocUrl: zod.string().optional(),
  photos: zod.array(zod.string()).optional(),
  equipment: zod.array(zod.string()).optional(),
  createdAt: zod.coerce.date(),
});
export const ListFacilitiesResponse = zod.array(FacilityItem);

export const CreateFacilityBody = zod.object({
  name: zod.string().min(2),
  description: zod.string().optional(),
  companyName: zod.string().optional(),
  registrationCode: zod.string().optional(),
  address: zod.string().min(3),
  city: zod.string().min(2),
  latitude: zod.number().optional(),
  longitude: zod.number().optional(),
  postcode: zod.string().optional(),
  phone: OptionalPhoneString,
  email: OptionalEmailString,
  verificationDocUrl: zod.string().optional(),
  ownershipDocUrl: zod.string().refine(v => /^https:\/\//i.test(v) || /^(\/)?courts\/docs\/[a-zA-Z0-9._-]+$/.test(v), "ownershipDocUrl must be an https URL or a valid uploaded document path").optional(),
  photos: zod.array(zod.string()).optional(),
  equipment: zod.array(zod.string()).optional(),
});

export const UpdateFacilityParams = zod.object({ id: zod.coerce.number() });
export const UpdateFacilityBody = zod.object({
  name: zod.string().min(2),
  description: zod.string().optional(),
  companyName: zod.string().optional(),
  registrationCode: zod.string().optional(),
  address: zod.string().optional(),
  city: zod.string().optional(),
  latitude: zod.number().optional(),
  longitude: zod.number().optional(),
  postcode: zod.string().optional(),
  phone: OptionalPhoneString,
  email: OptionalEmailString,
  verificationDocUrl: zod.string().optional(),
  ownershipDocUrl: zod.string().refine(v => /^https:\/\//i.test(v) || /^(\/)?courts\/docs\/[a-zA-Z0-9._-]+$/.test(v), "ownershipDocUrl must be an https URL or a valid uploaded document path").optional(),
  photos: zod.array(zod.string()).optional(),
  equipment: zod.array(zod.string()).optional(),
});
export const DeleteFacilityParams = zod.object({ id: zod.coerce.number() });
