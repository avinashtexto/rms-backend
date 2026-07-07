import { z } from 'zod';

export const submitRefileScanSchema = z.object({
  fileBarcode: z.string().min(1),
  scannedBoxBarcode: z.string().min(1),
  scannedLocationBarcode: z.string().min(1),
  clientEventId: z.string().uuid(),
  scannedAt: z.preprocess((val) => new Date(val as string), z.date())
});
