import { z } from 'zod';

export const trackGpsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  deviceId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable()
});

export const historyQuerySchema = z.object({
  start: z.string().transform((val) => new Date(val)),
  end: z.string().transform((val) => new Date(val))
});
