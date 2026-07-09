import { z } from 'zod';

export const segregateBoxSchema = z.object({
  oldBoxId: z.string().uuid(),
  newBoxId: z.string().uuid(),
  fileRecordIds: z.array(z.string().uuid()).min(1)
});

export const mergeBoxesSchema = z.object({
  sourceBoxId: z.string().uuid(),
  targetBoxId: z.string().uuid()
});

export const initiateTransferSchema = z.object({
  boxBarcode: z.string(),
  destinationLocation: z.string(),
  reason: z.string().optional()
});
