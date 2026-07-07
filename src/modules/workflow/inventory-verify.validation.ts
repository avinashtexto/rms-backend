import { z } from 'zod';

export const startVerifySessionSchema = z.object({
  boxId: z.string().uuid()
});

export const submitVerifyScanSchema = z.object({
  fileBarcode: z.string().min(1),
  clientEventId: z.string().uuid(),
  scannedAt: z.preprocess((val) => new Date(val as string), z.date())
});
