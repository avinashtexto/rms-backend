import { z } from 'zod';

export const createReasonCodeSchema = z.object({
  code: z.string().toUpperCase().min(1),
  label: z.string().min(1),
  appliesTo: z.string().min(1) // e.g. "LOCATION_OVERRIDE", "REFILE_REJECT"
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional()
});
