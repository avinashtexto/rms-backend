import { z } from 'zod';

export const recordsImportRowSchema = z.object({
  clientCode: z.string().trim().optional(),
  clientName: z.string().trim().optional(),
  locationBarcode: z.string().trim().optional(),
  boxBarcode: z.string().trim().min(1),
  fileBarcode: z.string().trim().optional(),
});

export const recordsImportSchema = z.object({
  rows: z.array(recordsImportRowSchema).min(1).max(5000),
});

export const segregationPlanRowSchema = z.object({
  oldBoxBarcode: z.string().trim().min(1),
  fileBarcode: z.string().trim().min(1),
});

export const segregationPlanImportSchema = z.object({
  rows: z.array(segregationPlanRowSchema).min(1).max(5000),
});
