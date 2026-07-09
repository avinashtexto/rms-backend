import { z } from 'zod';

export const createFileRecordSchema = z.object({
  boxId: z.string().uuid(),
  barcode: z.string().min(1),
  title: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED']).optional()
});

export const updateFileRecordSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED']).optional(),
  boxId: z.string().uuid().optional()
});
