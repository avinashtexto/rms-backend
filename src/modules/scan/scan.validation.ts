import { z } from 'zod';

export const lookupBarcodeSchema = z.object({
  barcode: z.string().min(1)
});

export const submitScanSchema = z.object({
  clientOpId: z.string().uuid(),
  barcode: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scannedAt: z.string().datetime().optional()
});
