import { z } from 'zod';
import { BoxStatus, FileRecordStatus } from '@prisma/client';

const paginationFields = {
  page: z.preprocess(
    (val) => (val === undefined ? 1 : parseInt(val as string, 10)),
    z.number().int().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? 20 : parseInt(val as string, 10)),
    z.number().int().min(1).max(200).default(20)
  ),
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(['barcode', 'description', 'title', 'status', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc')
};

export const listBoxesQuerySchema = z.object({
  ...paginationFields,
  sortBy: z.enum(['barcode', 'description', 'status', 'updatedAt']).optional().default('updatedAt'),
  status: z.nativeEnum(BoxStatus).optional(),
  clientId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional()
});

export const listFilesQuerySchema = z.object({
  ...paginationFields,
  sortBy: z.enum(['barcode', 'title', 'status', 'updatedAt']).optional().default('updatedAt'),
  status: z.nativeEnum(FileRecordStatus).optional(),
  boxId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional()
});

export const updateBoxRecordSchema = z
  .object({
    label: z.string().min(1).optional(),
    fileCapacity: z.number().int().min(0).optional()
  })
  .refine((data) => data.label !== undefined || data.fileCapacity !== undefined, {
    message: 'At least one of label or fileCapacity must be provided'
  });

export const updateFileRecordSchema = z
  .object({
    label: z.string().min(1).optional(),
    homeBoxId: z.string().uuid().optional()
  })
  .refine((data) => data.label !== undefined || data.homeBoxId !== undefined, {
    message: 'At least one of label or homeBoxId must be provided'
  });

export const recordIdParamSchema = z.object({
  id: z.string().min(1)
});
