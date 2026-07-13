import { z } from 'zod';

export const splashStatusSchema = z.object({
  deviceId: z.string().trim().optional(),
  appVersion: z.string().trim().optional()
});
