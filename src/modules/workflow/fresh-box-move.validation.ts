import { z } from 'zod';

export const startSessionSchema = z.object({
  deviceId: z.string().uuid().optional().nullable()
});

export const submitScanSchema = z.object({
  locationBarcode: z.string().min(1),
  boxBarcode: z.string().min(1),
  clientEventId: z.string().uuid(),
  gpsLat: z.number().optional().nullable(),
  gpsLng: z.number().optional().nullable(),
  scannedAt: z.preprocess((val) => new Date(val as string), z.date())
});
