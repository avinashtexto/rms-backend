import { z } from 'zod';
import { BoxStatus, FileRecordStatus } from '@prisma/client';

export const createBoxSchema = z.object({
  clientId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  barcode: z.string().min(1).optional(), // optional, auto-generated if omitted
  description: z.string().optional().nullable()
});

export const updateBoxSchema = z.object({
  clientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(BoxStatus).optional()
});

export const createFileRecordSchema = z.object({
  barcode: z.string().min(1).optional(), // optional, auto-generated if omitted
  title: z.string().min(1)
});

export const updateFileRecordSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.nativeEnum(FileRecordStatus).optional()
});

export const listBoxQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(BoxStatus).optional(),
  locationId: z.string().uuid().optional(),
  page: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => parseInt(val as string, 10), z.number().int().min(1).max(100).default(20))
});
