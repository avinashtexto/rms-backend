import { z } from 'zod';

export const startSessionSchema = z.object({
  deviceId: z.string().uuid().optional().nullable()
});

export const submitScanSchema = z.object({
  locationBarcode: z.string().min(1),
  boxBarcode: z.string().min(1),
  clientOpId: z.string().uuid(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scannedAt: z.string().datetime().optional()
});

export const endSessionSchema = z.object({
  clientOpId: z.string().uuid(),
  locationBarcode: z.string().min(1),
  boxBarcodes: z.array(z.string().min(1)),
  performedAt: z.string().datetime().optional()
});

export const freshBoxMoveSchema = z.object({
  clientOpId: z.string().uuid(),
  performedAt: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationBarcode: z.string().min(1),
  boxBarcodes: z.array(z.string().min(1))
});
