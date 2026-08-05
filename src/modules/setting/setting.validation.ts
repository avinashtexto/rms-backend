import { z } from 'zod';

export const createReasonCodeSchema = z.object({
  code: z.string().toUpperCase().min(1),
  label: z.string().min(1),
  appliesTo: z.string().min(1) // e.g. "LOCATION_OVERRIDE", "REFILE_REJECT"
});

export const companyPreferencesSchema = z.object({
  defaultLocationCapacity: z.number().int().min(1).max(99).optional(),
  timezone: z.string().min(1).optional()
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  defaultLocationCapacity: z.number().int().min(1).max(99).optional(),
  timezone: z.string().min(1).optional()
});
